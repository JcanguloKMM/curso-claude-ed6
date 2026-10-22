# Modelo de Datos

Esquema de la base de datos SQLite de Resttek.

---

## Diagrama Entidad-Relación

```mermaid
erDiagram
    restaurants ||--o{ employees : "tiene"
    restaurants ||--o{ ingredients : "tiene"
    restaurants ||--o{ dishes : "tiene"
    restaurants ||--o{ orders : "tiene"
    restaurants ||--o{ restaurant_tables : "tiene"
    restaurant_tables |o..o{ orders : "table_id (sin FK)"
    dishes ||--o{ dish_ingredients : "contiene"
    ingredients ||--o{ dish_ingredients : "usado en"
    orders ||--o{ order_items : "contiene"
    dishes ||--o{ order_items : "pedido como"

    restaurants {
        TEXT id PK
        TEXT name
        TEXT address
        TEXT email
        TEXT phone
        TEXT owner_first_name
        TEXT owner_last_name
        TEXT logo_url
        TEXT created_at
        TEXT updated_at
    }

    employees {
        TEXT id PK
        TEXT first_name
        TEXT last_name
        TEXT email UK
        TEXT password_hash
        TEXT role
        TEXT restaurant_id FK
    }

    ingredients {
        TEXT id PK
        TEXT name
        TEXT unit
        REAL current_stock
        TEXT restaurant_id FK
        TEXT created_at
        TEXT updated_at
    }

    dishes {
        TEXT id PK
        TEXT name
        TEXT description
        REAL price
        TEXT category
        INTEGER available
        TEXT restaurant_id FK
        TEXT created_at
        TEXT updated_at
    }

    dish_ingredients {
        TEXT dish_id PK_FK
        TEXT ingredient_id PK_FK
        REAL quantity
    }

    restaurant_tables {
        TEXT id PK
        TEXT restaurant_id FK
        INTEGER number
        TEXT description
        INTEGER capacity
        TEXT status
        TEXT created_at
        TEXT updated_at
    }

    orders {
        TEXT id PK
        TEXT restaurant_id FK
        TEXT table_id
        TEXT client_id
        TEXT created_at
    }

    order_items {
        TEXT id PK
        TEXT order_id FK
        TEXT dish_id FK
        INTEGER quantity
        TEXT notes
        TEXT status
    }
```

---

## Tablas

### `restaurants`

Almacena la información de los restaurantes.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id` | TEXT | No | UUID, clave primaria |
| `name` | TEXT | No | Nombre del restaurante |
| `address` | TEXT | No | Dirección |
| `email` | TEXT | No | Email de contacto |
| `phone` | TEXT | No | Teléfono |
| `owner_first_name` | TEXT | No | Nombre del propietario |
| `owner_last_name` | TEXT | No | Apellido del propietario |
| `logo_url` | TEXT | Sí | URL del logo |
| `created_at` | TEXT | No | Fecha de creación (ISO 8601) |
| `updated_at` | TEXT | No | Fecha de última actualización |

---

### `employees`

Almacena **todos** los usuarios del sistema, incluidos los clientes: no hay tabla de clientes aparte. Un cliente es una fila con `role = 'cliente'` y `restaurant_id` a null.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id` | TEXT | No | UUID, clave primaria |
| `first_name` | TEXT | No | Nombre |
| `last_name` | TEXT | No | Apellido |
| `email` | TEXT | No | Email (único) |
| `password_hash` | TEXT | No | Hash bcrypt de la contraseña |
| `role` | TEXT | No | Rol: admin, manager, camarero, cocinero, cliente |
| `restaurant_id` | TEXT | Sí | FK → `restaurants.id` (null para admin y cliente) |

**Restricciones:**

- `email` es UNIQUE.
- `restaurant_id` es FK a `restaurants.id`.

---

### `ingredients`

Ingredientes disponibles en cada restaurante.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id` | TEXT | No | UUID, clave primaria |
| `name` | TEXT | No | Nombre del ingrediente |
| `unit` | TEXT | No | Unidad: kg, g, l, ml, unidad |
| `current_stock` | REAL | No | Stock actual (default: 0) |
| `restaurant_id` | TEXT | No | FK → `restaurants.id` |
| `created_at` | TEXT | No | Fecha de creación |
| `updated_at` | TEXT | No | Fecha de última actualización |

---

### `dishes`

Platos de la carta de cada restaurante.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id` | TEXT | No | UUID, clave primaria |
| `name` | TEXT | No | Nombre del plato |
| `description` | TEXT | Sí | Descripción |
| `price` | REAL | No | Precio en euros |
| `category` | TEXT | No | Categoría: entrante, principal, postre, bebida |
| `available` | INTEGER | No | Disponibilidad: 1 = sí, 0 = no (default: 1) |
| `restaurant_id` | TEXT | No | FK → `restaurants.id` |
| `created_at` | TEXT | No | Fecha de creación |
| `updated_at` | TEXT | No | Fecha de última actualización |

---

### `dish_ingredients`

Relación muchos-a-muchos entre platos e ingredientes.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `dish_id` | TEXT | No | FK → `dishes.id` (PK compuesta) |
| `ingredient_id` | TEXT | No | FK → `ingredients.id` (PK compuesta) |
| `quantity` | REAL | No | Cantidad del ingrediente necesaria |

**Restricciones:**

- PK compuesta: (`dish_id`, `ingredient_id`).
- FK a `dishes.id` **con** `ON DELETE CASCADE`: al borrar un plato desaparecen sus ingredientes asociados.
- FK a `ingredients.id` **sin** cascada.

---

### `restaurant_tables`

Mesas de cada restaurante. La tabla se llama `restaurant_tables` para no chocar con la palabra reservada `TABLE`.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id` | TEXT | No | UUID, clave primaria (en el seed, ids fijos `mesa-rest-1-1`…) |
| `restaurant_id` | TEXT | No | FK → `restaurants.id` |
| `number` | INTEGER | No | Número visible de la mesa (entero ≥ 1) |
| `description` | TEXT | Sí | Descripción libre (ubicación, etc.) |
| `capacity` | INTEGER | No | Número máximo de comensales (entero ≥ 1) |
| `status` | TEXT | No | Estado: libre, ocupada, reservada (default: `libre`) |
| `created_at` | TEXT | No | Fecha de creación |
| `updated_at` | TEXT | No | Fecha de última actualización (alta, edición, cambio de estado y ocupación) |

**Restricciones:**

- UNIQUE (`restaurant_id`, `number`): el número de mesa no se repite dentro de un restaurante.
- FK a `restaurants.id`.
- Que número y capacidad sean enteros ≥ 1 y que el estado sea válido lo comprueba `TableService`, no la BD.

---

### `orders`

Pedidos de los clientes.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id` | TEXT | No | UUID, clave primaria |
| `restaurant_id` | TEXT | No | FK → `restaurants.id` |
| `table_id` | TEXT | Sí | `id` de la mesa (`restaurant_tables.id`) en la que se hizo el pedido (opcional) |
| `client_id` | TEXT | Sí | ID del cliente (opcional) |
| `created_at` | TEXT | No | Fecha de creación |

`table_id` **no tiene clave foránea**: añadirla obligaría a recrear la tabla `orders` en las BD existentes. La API tampoco valida su valor al crear el pedido. Al leer pedidos se hace `LEFT JOIN restaurant_tables` (solo con mesas del mismo restaurante) para devolver `tableNumber`, que es `null` si el pedido no tiene mesa o si `table_id` no corresponde a ninguna mesa (datos antiguos o mesa borrada).

---

### `order_items`

Líneas de pedido. Cada ítem es un plato con cantidad y estado.

| Columna | Tipo | Nullable | Descripción |
| --- | --- | --- | --- |
| `id` | TEXT | No | UUID, clave primaria |
| `order_id` | TEXT | No | FK → `orders.id` |
| `dish_id` | TEXT | No | FK → `dishes.id` |
| `quantity` | INTEGER | No | Cantidad pedida |
| `notes` | TEXT | Sí | Notas del cliente (ej: "sin gluten") |
| `status` | TEXT | No | Estado: pendiente, preparando, listo, entregado |

**Restricciones:**

- ON DELETE CASCADE desde `orders.id`.

---

## Relaciones

| Relación | Tipo | Descripción |
| --- | --- | --- |
| Restaurant → Employees | 1:N | Un restaurante tiene muchos empleados |
| Restaurant → Ingredients | 1:N | Un restaurante tiene muchos ingredientes |
| Restaurant → Dishes | 1:N | Un restaurante tiene muchos platos |
| Restaurant → Orders | 1:N | Un restaurante tiene muchos pedidos |
| Restaurant → Tables | 1:N | Un restaurante tiene muchas mesas (`restaurant_tables`) |
| Table → Orders | 1:N (lógica) | Un pedido puede apuntar a una mesa mediante `orders.table_id`, sin clave foránea |
| Dish ↔ Ingredient | N:M | Un plato usa varios ingredientes (via `dish_ingredients`) |
| Order → OrderItems | 1:N | Un pedido tiene varios ítems |
| Dish → OrderItems | 1:N | Un plato puede estar en varios ítems de pedido |

---

## Notas Técnicas

- **IDs**: Todos son UUID v4 generados con `crypto.randomUUID()`. Excepción: el script de seed usa identificadores fijos para los restaurantes (`rest-1`, `rest-2`), las mesas (`mesa-rest-1-1`…) y el pedido de ejemplo (`order-seed-1` y sus ítems `order-seed-1-item-N`).
- **Fechas**: Almacenadas como TEXT en formato ISO 8601 (`new Date().toISOString()`).
- **Booleanos**: SQLite no tiene tipo BOOLEAN; se usa INTEGER (0 = false, 1 = true).
- **Nomenclatura**: las columnas son `snake_case` y las propiedades TypeScript `camelCase`. La conversión se hace con alias en el propio SQL (`owner_first_name as ownerFirstName`).
- **Migraciones**: Las tablas se crean automáticamente en `Database.initialize()` con `CREATE TABLE IF NOT EXISTS`.
- **Sin migrations framework**: No se usa un sistema de migraciones formal. Los cambios de esquema se hacen modificando `runInitialMigrations()`. Como solo se ejecuta `CREATE TABLE IF NOT EXISTS`, **añadir una columna no afecta a una base de datos ya creada**: hay que borrar `packages/api/resttek.db` y volver a sembrar. En cambio, una **tabla nueva** (como `restaurant_tables`) sí se crea al arrancar sobre una BD existente.