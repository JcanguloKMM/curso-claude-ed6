# Arquitectura de la API

La API de Resttek es una aplicación **Node.js con Express 5 y TypeScript** (`packages/api`), con persistencia en SQLite.

En su interior conviven **dos estilos arquitectónicos**. Conocer cuál aplica a cada dominio es lo primero que hay que tener claro antes de tocar código.

---

## Los dos estilos

### 1. Hexagonal + DDD → solo el contexto `employee`

`src/contexts/` es el único sitio donde se aplica arquitectura hexagonal (Ports & Adapters) con DDD. Contiene dos carpetas:

```
src/contexts/
├── employee/        → Empleados, auth, roles
└── shared/          → Value objects y utilidades HTTP comunes
```

El contexto `employee` sigue las tres capas clásicas:

```
contexts/employee/
├── domain/
│   ├── Employee.ts
│   ├── Employee.test.ts
│   ├── IEmployeeRepository.ts
│   ├── IAuthService.ts
│   └── value-objects/
│       ├── Role.ts
│       └── Role.test.ts
├── application/
│   ├── LoginUseCase.ts
│   ├── CreateEmployeeUseCase.ts
│   ├── RegisterClientUseCase.ts
│   ├── *.test.ts
│   └── mocks/
└── infrastructure/
    ├── SqliteEmployeeRepository.ts
    ├── SqliteEmployeeRepository.test.ts
    ├── BcryptAuthService.ts
    └── http/
        ├── AuthController.ts
        ├── EmployeeController.ts
        ├── dependencies.ts
        ├── auth.routes.ts
        ├── employee.routes.ts
        └── restaurant-employee.routes.ts
```

`contexts/shared/` no es un bounded context de negocio: contiene el value object `Email` y los middlewares y el `errorHandler` de Express.

### 2. Por capas → `restaurant`, `dish`, `ingredient`, `order`, `table`

El resto de dominios **no** usan bounded contexts. Se organizan en carpetas transversales por tipo de fichero:

```
src/
├── models/          → Interfaces TypeScript + funciones de normalización
├── repositories/    → Interfaz + implementación SQLite
├── services/        → Lógica de negocio (equivalente a los casos de uso)
├── controllers/     → Adaptadores HTTP
└── routes/          → Definición de rutas y composición de dependencias
```

Con un fichero por dominio en cada carpeta: `models/dish.model.ts`, `services/dish.service.ts`, `repositories/dish.repository.ts`, etc.

**Diferencia clave**: aquí no hay entidades de dominio con comportamiento. `Restaurant`, `Dish`, `Ingredient`, `Order` y `Table` son `interface` planas; la validación vive en los servicios y en funciones sueltas del modelo.

---

## Capa de Dominio (contexto `employee`)

### Entidades

`Employee` es la **única entidad de dominio** del proyecto. Patrón: **constructor privado + factory method `create()`**:

```tsx
export class Employee {
    private constructor(props: { /* ... */ }) { /* asignar campos */ }

    public static create(props: EmployeeProps): Employee {
        if (!props.firstName || props.firstName.trim() === '') {
            throw new FirstNameRequiredError()
        }
        // ... resto de validaciones

        return new Employee({
            ...props,
            email: new Email(props.email),   // Value Object
            role: new Role(props.role)       // Value Object
        })
    }

    get id(): string { return this._id }
    get email(): string { return this._email.getValue() }
    get role(): EmployeeRoleType { return this._role.getValue() }
}
```

**Reglas:**

- Constructor siempre **privado**.
- Validaciones de negocio en `create()`.
- Propiedades con **getters**, sin setters directos.
- Los Value Objects validan dentro de su propio constructor.

### Value Objects

Solo existen **dos clases** Value Object:

| Value Object | Ubicación | Validación |
| --- | --- | --- |
| `Email` | `contexts/shared/domain/value-objects/Email.ts` | Formato email (regex) |
| `Role` | `contexts/employee/domain/value-objects/Role.ts` | admin, manager, camarero, cocinero, cliente |

Los demás conceptos que podrían ser Value Objects **no están implementados como clases**, sino como tipo unión + función de normalización en `models/`:

| Concepto | Implementación real | Valores válidos |
| --- | --- | --- |
| Unidad de ingrediente | `normalizeIngredientUnit()` en `models/ingredient.model.ts` | kg, g, l, ml, unidad |
| Categoría de plato | `normalizeDishCategory()` en `models/dish.model.ts` | entrante, principal, postre, bebida |
| Estado de pedido | `normalizeOrderStatus()` en `models/order.model.ts` | pendiente, preparando, listo, entregado |
| Estado de mesa | `normalizeTableStatus()` en `models/table.model.ts` | libre, ocupada, reservada |
| Teléfono | `PHONE_REGEX` dentro de `services/restaurant.service.ts` | `/^\+?[\d\s\-()]{7,20}$/` |

Las funciones `normalizeX()` hacen `trim()` + `toLowerCase()` y lanzan el error de dominio correspondiente si el valor no es válido.

### Interfaces de Repositorio

El prefijo `I` **solo** se usa en el contexto `employee` (`IEmployeeRepository`, `IAuthService`). En la capa por capas la interfaz va sin prefijo y convive con su implementación en el mismo fichero:

```tsx
// repositories/restaurant.repository.ts
export interface RestaurantRepository {
    findById(id: string): Promise<Restaurant | null>
    findAll(): Promise<Restaurant[]>
    save(restaurant: Restaurant): Promise<void>
}

export class SqliteRestaurantRepository implements RestaurantRepository { /* ... */ }
```

---

## Capa de Aplicación

### Casos de Uso (solo `employee`)

Clase con un único método `execute()`. Dependencias por **inyección de constructor**. Solo hay tres:

| Caso de uso | Qué hace |
| --- | --- |
| `LoginUseCase` | Valida credenciales y devuelve `{ token, employee }` |
| `CreateEmployeeUseCase` | Alta de empleado por parte de un admin |
| `RegisterClientUseCase` | Auto-registro de cliente; fuerza `role: 'cliente'` y `restaurantId: null`, y devuelve token |

```tsx
export class CreateEmployeeUseCase {
    constructor(
        private readonly employeeRepo: IEmployeeRepository,
        private readonly authService: IAuthService
    ) {}

    async execute(dto: CreateEmployeeDTO): Promise<Employee> {
        const existing = await this.employeeRepo.findByEmail(dto.email)
        if (existing) throw new DuplicatedEmailError()

        const passwordHash = await this.authService.hashPassword(dto.passwordPlain)
        const employee = Employee.create({ id: randomUUID(), ...dto, passwordHash })

        await this.employeeRepo.save(employee)
        return employee
    }
}
```

### Servicios (resto de dominios)

En `restaurant`, `dish`, `ingredient`, `order` y `table` el equivalente al caso de uso es un **servicio con varios métodos**, no una clase por acción:

```tsx
export class RestaurantService {
    constructor(private readonly restaurantRepository: RestaurantRepository) {}

    async create(dto: CreateRestaurantDTO): Promise<Restaurant> {
        const now = new Date().toISOString()
        const restaurant = this.buildRestaurant({ id: randomUUID(), ...dto, createdAt: now, updatedAt: now })
        await this.restaurantRepository.save(restaurant)
        return restaurant
    }

    // update(), getById(), getAll()

    // buildRestaurant() concentra las validaciones que en DDD irían en la entidad
    private buildRestaurant(props): Restaurant { /* validaciones + objeto plano */ }
}
```

### DTOs

Se declaran en el mismo fichero que los consume (el caso de uso o el servicio):

```tsx
export interface CreateRestaurantDTO {
    name: string
    address: string
    email: string
    phone: string
    ownerFirstName: string
    ownerLastName: string
    logoUrl: string | null
}
```

---

## Capa de Infraestructura

### Repositorios SQLite

Todos siguen el mismo patrón: `save()` decide entre UPDATE e INSERT, y un método privado mapea la fila a objeto:

```tsx
export class SqliteRestaurantRepository implements RestaurantRepository {
    constructor(private db: Database) {}

    async save(restaurant: Restaurant): Promise<void> {
        const existing = await this.findById(restaurant.id)
        // UPDATE si existe, INSERT si no
    }

    private mapToRestaurant(row: RestaurantRow): Restaurant {
        return { id: row.id, /* ... */ }   // objeto plano
    }
}
```

En `employee` el mapeo reconstruye la entidad con `Employee.create()`; en el resto devuelve el objeto plano directamente. El renombrado `snake_case` → `camelCase` se hace con alias en el propio SQL (`owner_first_name as ownerFirstName`).

### Controladores y Rutas

Las rutas conectan URLs con controladores y aplican middlewares. La **composición de dependencias se hace en el propio fichero de rutas**:

```tsx
const dishRepository = new SqliteDishRepository(dbConfig)
const dishService = new DishService(dishRepository)
const dishController = new DishController(dishService)

const router = Router({ mergeParams: true })

router.post('/', authenticate, authorize(['admin', 'manager']), dishController.create)
```

La excepción es `employee`: como sus rutas están repartidas en tres ficheros, el cableado se extrae a `contexts/employee/infrastructure/http/dependencies.ts`, que exporta `authController` y `employeeController` ya construidos.

`mergeParams: true` es obligatorio en los routers montados bajo un prefijo con parámetros (`/restaurants/:restaurantId/...`) para poder leer `req.params.restaurantId`.

---

## Endpoints

Todos cuelgan de `/api/v1`. La columna **Roles** indica qué valores de `req.user.role` acepta `authorize()`; “autenticado” significa que basta con un JWT válido, sin filtro de rol.

### Públicos (sin autenticación)

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/health` | Healthcheck. Devuelve `{ status: 'ok' }`. **No lleva el prefijo `/api/v1`** |
| `POST` | `/api/v1/auth/login` | Login. Devuelve `{ token, employee }` |
| `POST` | `/api/v1/auth/register` | Auto-registro de cliente. Devuelve `{ token, employee }` (201) |
| `GET` | `/api/v1/public/restaurants` | Listado de restaurantes para la app de clientes |
| `GET` | `/api/v1/public/restaurants/:id` | Detalle de restaurante |
| `GET` | `/api/v1/public/restaurants/:restaurantId/dishes` | Carta pública del restaurante |
| `GET` | `/api/v1/public/restaurants/:restaurantId/tables?people=N` | Mesas `libre` con `capacity >= N`, por capacidad y número. `people` es obligatorio (400 si falta o no es un entero ≥ 1) |

### Restaurantes

| Método | Ruta | Roles |
| --- | --- | --- |
| `POST` | `/api/v1/restaurants` | admin |
| `GET` | `/api/v1/restaurants` | autenticado |
| `GET` | `/api/v1/restaurants/:id` | autenticado |
| `PUT` | `/api/v1/restaurants/:id` | admin |

`GET /api/v1/restaurants` no devuelve lo mismo a todo el mundo: si el rol es `admin` devuelve todos los restaurantes; si no, devuelve un array con el restaurante de `req.user.restaurantId`, o vacío si el usuario no tiene restaurante asignado.

### Empleados

| Método | Ruta | Roles |
| --- | --- | --- |
| `POST` | `/api/v1/employees` | admin |
| `GET` | `/api/v1/employees` | admin — acepta `?limit=`, `?offset=` y `?role=` |
| `GET` | `/api/v1/employees/:id` | admin |
| `GET` | `/api/v1/restaurants/:restaurantId/employees` | admin |

### Platos e ingredientes

| Método | Ruta | Roles |
| --- | --- | --- |
| `POST` | `/api/v1/restaurants/:restaurantId/dishes` | admin, manager |
| `GET` | `/api/v1/restaurants/:restaurantId/dishes` | admin, manager, camarero, cocinero |
| `GET` | `/api/v1/restaurants/:restaurantId/dishes/:id` | admin, manager, camarero, cocinero |
| `PUT` | `/api/v1/restaurants/:restaurantId/dishes/:id` | admin, manager |
| `DELETE` | `/api/v1/restaurants/:restaurantId/dishes/:id` | admin, manager |
| `POST` | `/api/v1/restaurants/:restaurantId/ingredients` | admin |
| `GET` | `/api/v1/restaurants/:restaurantId/ingredients` | admin, manager, cocinero |
| `GET` | `/api/v1/restaurants/:restaurantId/ingredients/:id` | admin, manager, cocinero |
| `PUT` | `/api/v1/restaurants/:restaurantId/ingredients/:id` | admin |
| `DELETE` | `/api/v1/restaurants/:restaurantId/ingredients/:id` | admin |

Los ingredientes son **más restrictivos** que los platos: solo `admin` puede crear, editar o borrar.

### Mesas

El contrato completo (esquemas, códigos de respuesta, orden de las validaciones y ejemplos) está en [`docs/api/openapi-mesas.yaml`](../api/openapi-mesas.yaml) (OpenAPI 3.1).

| Método | Ruta | Roles |
| --- | --- | --- |
| `GET` | `/api/v1/restaurants/:restaurantId/tables` | admin, manager, camarero, cocinero — del restaurante (`authorizeRestaurant`) |
| `GET` | `/api/v1/restaurants/:restaurantId/tables/:id` | admin, manager, camarero, cocinero — del restaurante |
| `POST` | `/api/v1/restaurants/:restaurantId/tables` | admin |
| `PUT` | `/api/v1/restaurants/:restaurantId/tables/:id` | admin |
| `DELETE` | `/api/v1/restaurants/:restaurantId/tables/:id` | admin — 409 si la mesa está `ocupada` |
| `PATCH` | `/api/v1/restaurants/:restaurantId/tables/:id/status` | admin, manager, camarero, cocinero — del restaurante |
| `POST` | `/api/v1/restaurants/:restaurantId/tables/:id/occupy` | cliente — sin `authorizeRestaurant` (los clientes no tienen restaurante) |

Reglas principales (en `TableService`):

- `number` y `capacity` deben ser números JSON enteros ≥ 1; un string se rechaza. `number` es único por restaurante (409 `DuplicatedTableNumberError`).
- `description` es opcional: se le aplica `trim` y, si queda vacía, se guarda `null`.
- En `PUT`, omitir `status` conserva el estado actual (editar una mesa ocupada no la libera); omitir `description` la borra.
- Toda operación sobre una mesa busca por `id` **y** por el `restaurantId` de la URL: una mesa de otro restaurante da 404 `TableNotFoundError`.
- `occupy` es atómica: `UPDATE ... WHERE id = ? AND restaurant_id = ? AND status = 'libre'`. Si no cambia ninguna fila, responde 409 `TableNotAvailableError`. Antes valida `people` (400), que la mesa exista (404) y la capacidad (400 `TableCapacityExceededError`).
- La mesa no se libera sola: la liberan los empleados con el `PATCH` de estado.

### Pedidos

| Método | Ruta | Roles |
| --- | --- | --- |
| `POST` | `/api/v1/orders` | autenticado — el `clientId` se toma del JWT, no del body |
| `GET` | `/api/v1/orders/active` | admin, manager, camarero, cocinero — el admin **requiere `?restaurantId=`** (400 si falta); el resto ve su restaurante |
| `GET` | `/api/v1/orders/mine` | autenticado — pedidos del usuario del JWT |
| `GET` | `/api/v1/orders/:id` | autenticado — solo el admin, el cliente dueño o el personal del restaurante (403 `ForbiddenError`) |
| `PATCH` | `/api/v1/orders/:orderId/items/:itemId/status` | admin, manager, camarero, cocinero — del restaurante del pedido; devuelve 204 sin cuerpo |

**Mesa del pedido:** `POST /orders` acepta `tableId`, que debe ser el `id` de la mesa (no su número); la API no lo valida. `GET /orders/active`, `/orders/mine` y `/orders/:id` devuelven además `tableNumber` (`number | null`), resuelto con `LEFT JOIN restaurant_tables` solo con mesas del mismo restaurante: es `null` si el pedido no tiene mesa o si `tableId` no corresponde a ninguna mesa. La respuesta 201 de `POST /orders` no incluye `tableNumber`.

`GET /orders/active` devuelve los pedidos del restaurante que tengan **al menos un ítem** en estado distinto de `entregado`.

Al crear un pedido, el servicio **expande las cantidades**: un ítem con `quantity: 3` se guarda como 3 filas de `order_items` con `quantity: 1` cada una, para poder seguir el estado de cada unidad por separado.

---

## Middlewares

Definidos en `contexts/shared/infrastructure/http/middlewares.ts`.

| Middleware | Función | Respuesta al fallar |
| --- | --- | --- |
| `authenticate` | Verifica el JWT de `Authorization: Bearer <token>` y vuelca el payload en `req.user` | 401 |
| `authorize(roles)` | Comprueba que `req.user.role` está en la lista | 403 |
| `authorizeRestaurant` | Deja pasar al `admin` o a un usuario cuyo `restaurantId` coincide con `req.params.restaurantId`. Se usa en la lectura y el cambio de estado de mesas | 403 |

Los tres responden directamente, sin pasar por el `errorHandler`, con un cuerpo `{ error: '<texto>' }` sin `message`.

---

## Gestión de Errores

Jerarquía: `Error` → `AppError` (abstracta) → errores específicos en `errors/DomainErrors.ts`. `AppError` asigna `this.name = this.constructor.name`, y el `errorHandler` decide el código HTTP a partir de ese nombre:

- **404**: `EmployeeNotFoundError`, `RestaurantNotFoundError`, `IngredientNotFoundError`, `DishNotFoundError`, `OrderNotFoundError`, `TableNotFoundError`
- **409** (lista `CONFLICT_ERRORS`): `DuplicatedTableNumberError`, `TableOccupiedError`, `TableNotAvailableError`
- **403**: `ForbiddenError`
- **401**: `InvalidCredentialsError`
- **400**: cualquier otro `AppError`
- **500**: errores no controlados, con un cuerpo genérico que no filtra el mensaje interno

El cuerpo es `{ error: err.name, message: err.message }`. Los mensajes de los errores de mesas están en español.

---

## Path Aliases

Definidos en `tsconfig.json` (`baseUrl: ./src`). En tiempo de ejecución los resuelve `tsx`, y en los tests el plugin `vite-tsconfig-paths`.

| Alias | Ruta real |
| --- | --- |
| `@config/*` | `src/config/*` |
| `@errors/*` | `src/errors/*` |
| `@shared/*` | `src/contexts/shared/*` |
| `@employee/*` | `src/contexts/employee/*` |
| `@models/*` | `src/models/*` |
| `@repositories/*` | `src/repositories/*` |
| `@services/*` | `src/services/*` |
| `@controllers/*` | `src/controllers/*` |
| `@routes/*` | `src/routes/*` |
| `@scripts/*` | `src/scripts/*` |

Los imports llevan extensión `.js` (`import { dbConfig } from '@config/database.js'`) porque el paquete es ESM (`"type": "module"`, `module: nodenext`).

---

## Base de Datos

La clase `Database` (`config/database.ts`) encapsula `sqlite3` con una API basada en promesas:

- `initialize()`: abre la conexión y ejecuta `runInitialMigrations()` (`CREATE TABLE IF NOT EXISTS`)
- `run()`: INSERT/UPDATE/DELETE
- `all<T>()`: SELECT de múltiples filas
- `get<T>()`: SELECT de una fila
- `close()`: cierra la conexión
- `getDb()`: acceso crudo; lanza `DatabaseNotInitializedError` si no se ha llamado a `initialize()`

El módulo exporta una **instancia única** (`export const dbConfig = new Database()`) que se importa allá donde hace falta. No es un singleton con `getInstance()`: nada impide construir otra `Database`, y de hecho los tests lo hacen.

La ruta del fichero se decide en el constructor: `:memory:` si `NODE_ENV=test`, y `packages/api/resttek.db` en cualquier otro caso.

---

## Tests

Con **Vitest** (`npm test` desde la raíz, o `npm run test:watch` dentro de `packages/api`). Los tests son unitarios y conviven con el código que prueban:

- Dominio y casos de uso de `employee`, con dobles en `contexts/employee/application/mocks/`
- Servicios y repositorios de `restaurant`, `ingredient`, `order` y `table`, con dobles en `repositories/mocks/` (los repositorios se prueban contra SQLite en memoria)
- `errorHandler` y middlewares, con objetos `res` simulados
- Rutas de pedidos y de mesas con `supertest` (`routes/*.routes.test.ts`): autorización por rol y restaurante y códigos de respuesta
