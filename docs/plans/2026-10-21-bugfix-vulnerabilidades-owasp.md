# Plan: Corrección de vulnerabilidades OWASP Top 10 en la API y web-empleados

- **Tipo:** bug (seguridad)
- **Fecha:** 2026-10-21
- **Estado:** Pendiente

## 1. Resumen

La auditoría de seguridad (OWASP Top 10, 2021) de `packages/api` y de `packages/web-empleados` (+ `packages/web-shared`) ha detectado 18 hallazgos en la API (3 críticos, 6 altos) y 9 en el frontend. Los más graves son: secreto JWT hardcodeado como valor por defecto (cualquiera puede fabricar un token de admin), rutas de pedidos accesibles a cualquier usuario autenticado y falta de aislamiento entre restaurantes. Este plan los corrige por orden de prioridad, con TDD (vitest) en la API.

## 2. Alcance

### Incluye

- API: H-02, H-03, H-04, H-05, H-06, H-07, H-08, H-09, H-10, H-11, H-12, H-13, H-14, H-15 (parcial), H-16, H-17, H-18.
- web-empleados / web-shared: roleGuard, expiración del JWT, actualización de Angular, CSP, limpieza de stores, errores genéricos, validación de `localStorage` y filtrado de origen en el interceptor.

### No incluye

- Revocación real de tokens en servidor y refresh tokens rotatorios (H-15 y H-05 del frontend): requieren diseño propio. Se mitiga con caducidad corta y comprobación en BD de operaciones sensibles, y se deja como plan futuro.
- Migrar el JWT a cookie HttpOnly (H-02 del frontend): implica CSRF y cambios en los tres frontends. Se mitiga con CSP, comprobación de `exp` y saneado; se deja como decisión abierta (sección 8).
- Revisión de `web-admin` y `web-clientes` (comparten `web-shared`, por lo que se benefician de los cambios, pero no se han auditado).
- Cabeceras HTTP del servidor que sirva los frontends en producción (solo se documenta la CSP recomendada).

## 3. Análisis del código actual

Hallazgos verificados leyendo el código (rutas relativas a `packages/`):

**API**

- **H-02 (crítico)**: [middlewares.ts](../../packages/api/src/contexts/shared/infrastructure/http/middlewares.ts) y [BcryptAuthService.ts](../../packages/api/src/contexts/employee/infrastructure/BcryptAuthService.ts) usan `process.env.JWT_SECRET || 'super-secret-resttek-key'`. `dotenv` es dependencia, pero nunca se importa. `jwt.verify` no fija `algorithms`.
- **H-03 (crítico)**: [order.routes.ts](../../packages/api/src/routes/order.routes.ts) solo aplica `authenticate`. En [order.controller.ts](../../packages/api/src/controllers/order.controller.ts), `getById`, `getActiveOrders` y `updateItemStatus` no comprueban rol ni restaurante. Un cliente puede leer cualquier pedido o cambiar el estado de los ítems de cocina. `createOrder` devuelve `error.message` crudo con 400 (H-11).
- **H-04 (alto)**: los controllers de platos e ingredientes ignoran `req.params.restaurantId` frente al `restaurantId` del token. `DishRepository.findById` busca solo por `id`.
- **H-05 (alto)**: las rutas `*.public.routes.ts` devuelven datos del propietario (email, teléfono, nombre).
- **H-06 (alto)**: no hay rate limiting en `/auth/*` ni política de contraseñas (`RegisterClientUseCase`, `CreateEmployeeUseCase`).
- **H-07 (alto)**: `app.use(cors())` abierto y sin `helmet` en [app.ts](../../packages/api/src/app.ts).
- **H-08 (alto)**: `npm audit` informa de 23 vulnerabilidades (13 en producción, sobre todo en el árbol de `sqlite3`).
- **H-09 (alto)**: [order.service.ts](../../packages/api/src/services/order.service.ts) usa `quantity` como contador de un bucle sin validar. Con `quantity: 1e9` se agota la memoria. Tampoco comprueba que el plato exista, esté disponible y pertenezca al restaurante.
- **H-10, H-13**: validación de tipos insuficiente en los servicios de platos, ingredientes y restaurantes; `limit` sin tope en `EmployeeController`; listados públicos sin paginar.
- **H-12**: [errorHandler.ts](../../packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts) no registra los errores 500, y no hay logs de login fallido ni de 403.
- **H-14**: el registro revela si un email existe; en login no se ejecuta bcrypt cuando el usuario no existe (diferencia de tiempo).
- **H-15**: el token incluye `id`, `role` y `restaurantId` (ver `LoginUseCase.ts`), válido 8 h sin posibilidad de revocarlo.
- **H-16/H-17**: `logoUrl` sin validar esquema; `restaurantId` de `createEmployee` sin comprobar contra la BD.
- **H-18**: `resttek.db` no está en [.gitignore](../../.gitignore) (solo ignora `node_modules`).
- Bien protegido (no tocar): consultas SQL parametrizadas, bcrypt con 10 rondas, mensaje genérico en login, registro público fijado a rol `cliente`.

**Frontend**

- **H-01**: [app.routes.ts](../../packages/web-empleados/src/app/app.routes.ts) protege `/cocina`, `/barra` y `/salon` solo con `authGuard` (comprueba `token !== null`). Los permisos por rol solo ocultan enlaces en el shell.
- **H-02**: [auth.store.ts](../../packages/web-shared/src/lib/auth/auth.store.ts) guarda token y usuario en `localStorage`, no comprueba `exp`, hace `JSON.parse` sin `try/catch` y tipa `user` como `any`.
- **H-03**: Angular 21.2.7 con avisos de `npm audit` (XSS por saneado, DoS). Las plantillas solo usan interpolación, por lo que la explotabilidad hoy es baja.
- **H-04**: [index.html](../../packages/web-empleados/src/index.html) sin CSP.
- **H-06/H-07**: [order.store.ts](../../packages/web-empleados/src/app/features/orders/store/order.store.ts) no se limpia al cerrar sesión, `startPolling` no cancela el intervalo previo y muestra `err.message` crudo.
- **H-09 (frontend)**: `restaurantId` sale de `localStorage` (editable). El backend debe derivarlo del JWT (resuelto en T4 y T9).
- [auth.interceptor.ts](../../packages/web-shared/src/lib/http/auth.interceptor.ts) añade el Bearer a todas las peticiones, sin filtrar por origen.

## 4. Diseño de la solución

Se respeta la estructura de capas del proyecto (`routes → controllers → services → repositories → SQLite`) y la convivencia de los dos estilos (hexagonal en `employee`, por capas en el resto).

Decisiones clave:

1. **Configuración centralizada** (`Crear` `src/config/env.ts`): lee `JWT_SECRET` una sola vez y lo valida (obligatorio y de al menos 32 caracteres salvo con `NODE_ENV=test`, donde se usa un valor fijo de test). Los dos usos actuales importan de aquí. `jwt.verify` y `jwt.sign` fijan `HS256`.
2. **Autorización por restaurante**: nuevo middleware `authorizeRestaurant` en `middlewares.ts`: permite el paso si `user.role === 'admin'` o `user.restaurantId === req.params.restaurantId`. Para pedidos, la comprobación se hace en el servicio con el pedido cargado (`order.restaurantId === user.restaurantId`), y el dueño (`clientId === user.id`) puede ver su propio pedido.
3. **Derivar el restaurante del token**: en `GET /orders/active` el servicio usa el `restaurantId` del token; el parámetro de la query solo lo puede usar un admin.
4. **Búsqueda por `(id, restaurant_id)`** en platos e ingredientes, de modo que un id de otro restaurante devuelve 404.
5. **Validación de entrada** sin dependencias nuevas: funciones de validación pequeñas y reutilizables (`Crear` `src/helpers/validation.ts`) para texto, número finito, entero acotado y URL `https`. Se descarta añadir zod para no introducir una dependencia nueva sin acuerdo previo.
6. **Errores**: los controllers de pedidos pasan a `next(error)`; `errorHandler` registra los 500 y mapea `OrderNotFoundError`. Logger mínimo propio sobre `console` con eventos estructurados en JSON (sin dependencias nuevas).
7. **Endurecimiento HTTP**: `helmet`, `express-rate-limit` (nuevas dependencias de seguridad estándar, a confirmar) y `cors` con lista blanca por variable `CORS_ORIGINS`.
8. **Frontend**: `roleGuard(roles)` funcional en `web-shared`; el `AuthStore` decodifica `exp`, valida el JSON de `localStorage` y limpia los stores en `clearSession`; el interceptor solo añade el Bearer a URLs que empiecen por `/api`.

### Cambios en la API

| Método | Ruta | Descripción | Códigos de respuesta |
| ------ | ---- | ----------- | -------------------- |
| POST | `/api/v1/orders` | Validar `items` (array, máx. 50), `quantity` (entero 1-20), plato existente, disponible y del restaurante | 201, 400, 401 |
| GET | `/api/v1/orders/active` | Solo personal (`admin`, `manager`, `camarero`, `cocinero`) de su restaurante | 200, 400, 401, 403 |
| GET | `/api/v1/orders/:id` | Solo dueño del pedido o personal del mismo restaurante | 200, 401, 403, 404 |
| PATCH | `/api/v1/orders/:orderId/items/:itemId/status` | Solo personal del restaurante del pedido | 204, 400, 401, 403, 404 |
| `*` | `/api/v1/restaurants/:restaurantId/{dishes,ingredients}/**` | Exigen pertenencia al restaurante de la ruta (o admin) | 401, 403, 404 |
| GET | `/api/v1/public/restaurants[/:id]` | Respuesta reducida (sin datos del propietario) y paginada | 200, 404 |
| POST | `/api/v1/auth/login`, `/auth/register` | Rate limiting (p. ej. 10 intentos / 15 min por IP) y política de contraseña | 200, 201, 400, 429 |

### Cambios en el modelo de datos

No aplica. No hay cambios de esquema. Los hashes de contraseña existentes siguen siendo válidos, y la política de contraseñas solo afecta a altas nuevas.

## 5. Archivos afectados

| Archivo | Acción | Motivo |
| ------- | ------ | ------ |
| `packages/api/src/config/env.ts` | Crear | Configuración validada (JWT, CORS) |
| `packages/api/src/helpers/validation.ts` | Crear | Validadores reutilizables |
| `packages/api/src/helpers/logger.ts` | Crear | Logger estructurado mínimo |
| `packages/api/src/contexts/shared/infrastructure/http/middlewares.ts` | Modificar | Secreto, `HS256`, `authorizeRestaurant`, log de 403 |
| `packages/api/src/contexts/employee/infrastructure/BcryptAuthService.ts` | Modificar | Usar `env.ts` |
| `packages/api/src/routes/order.routes.ts`, `controllers/order.controller.ts`, `services/order.service.ts` | Modificar | H-03, H-09, H-11 |
| `packages/api/src/routes/dish.routes.ts`, `ingredient.routes.ts` y controllers/services/repositories asociados | Modificar | H-04, H-10 |
| `packages/api/src/controllers/restaurant.controller.ts`, `services/restaurant.service.ts`, `routes/*.public.routes.ts` | Modificar | H-05, H-13, H-17 |
| `packages/api/src/contexts/employee/application/{Register,CreateEmployee,Login}UseCase.ts` | Modificar | H-06, H-14, H-16 |
| `packages/api/src/contexts/employee/infrastructure/http/EmployeeController.ts` | Modificar | Tope de `limit` |
| `packages/api/src/contexts/shared/infrastructure/http/errorHandler.ts` | Modificar | Registrar 500, mapear errores |
| `packages/api/src/app.ts` | Modificar | `helmet`, CORS restringido, rate limit |
| `packages/api/package.json` | Modificar | `helmet`, `express-rate-limit`, actualizar `sqlite3` |
| `.gitignore` | Modificar | Ignorar `*.db` y `.env` |
| `packages/web-shared/src/lib/auth/auth.guard.ts` | Modificar | `roleGuard` y comprobación de `exp` |
| `packages/web-shared/src/lib/auth/auth.store.ts` | Modificar | `JSON.parse` seguro, tipo `User`, `exp` |
| `packages/web-shared/src/lib/http/auth.interceptor.ts` | Modificar | Filtrar por origen |
| `packages/web-empleados/src/app/app.routes.ts` | Modificar | `roleGuard` por ruta |
| `packages/web-empleados/src/app/features/orders/store/order.store.ts` | Modificar | Limpieza, polling, errores genéricos |
| `packages/web-empleados/src/index.html` | Modificar | CSP |
| `package.json` (raíz) y de los frontends | Modificar | Angular >= 21.2.25 |
| `docs/arquitectura/arquitectura-api.md`, `docs/revisiones/` | Modificar | Documentar seguridad |

## 6. Lista de tareas

> Cada tarea debe poder hacerse en 5-10 minutos y tener un resultado verificable. En la API, cada tarea sigue TDD: primero el test que falla (rojo), después el código (verde).

### Fase 1: críticas (API)

- [ ] **T1** (~5 min) — Reproducir H-02 y H-03: ejecutar `npm audit` base y un test que fabrique un JWT admin con el secreto por defecto y llame a `GET /api/v1/employees` · Archivo: `packages/api/src/security/jwt-secret.test.ts` (Crear) · Hecho cuando: el test falla (rojo), demostrando el problema
- [ ] **T2** (~8 min) — Crear `env.ts` con validación de `JWT_SECRET` (obligatorio, mínimo 32 caracteres, valor fijo solo en `NODE_ENV=test`) y su test unitario · Archivo: `packages/api/src/config/env.ts` · Hecho cuando: el test de `env` pasa para secreto ausente, corto y válido
- [ ] **T3** (~7 min) — Usar `env.ts` en `middlewares.ts` y `BcryptAuthService.ts`, y fijar `algorithms: ['HS256']` en `verify` y `sign` · Archivo: `middlewares.ts`, `BcryptAuthService.ts` · Hecho cuando: el test de T1 pasa (token firmado con el secreto antiguo devuelve 401) y `npm test` sigue en verde
- [ ] **T4** (~10 min) — Añadir `authorizeRestaurant` en `middlewares.ts` con tests (admin pasa, mismo restaurante pasa, otro restaurante 403) · Archivo: `packages/api/src/contexts/shared/infrastructure/http/middlewares.test.ts` (Crear) y `middlewares.ts` · Hecho cuando: los tres casos pasan
- [ ] **T5** (~10 min) — Tests rojos de autorización de pedidos: cliente → 403 en `/orders/active` y en `PATCH .../status`; cocinero de otro restaurante → 403; cliente ajeno → 403 en `GET /orders/:id` · Archivo: `packages/api/src/routes/order.routes.test.ts` (Crear) · Hecho cuando: los tests fallan por la razón esperada
- [ ] **T6** (~8 min) — Añadir `authorize([...personal])` en `order.routes.ts` para `/active` y `/status` · Archivo: `packages/api/src/routes/order.routes.ts` · Hecho cuando: los casos de cliente de T5 pasan
- [ ] **T7** (~10 min) — Comprobar pertenencia por restaurante/dueño en `OrderService` (`getById`, `updateItemStatus`) y `listActive` con el restaurante del token (el query solo lo respeta un admin) · Archivo: `services/order.service.ts`, `controllers/order.controller.ts` · Hecho cuando: pasan todos los tests de T5
- [ ] **T8** (~7 min) — Cambiar los `catch` del `OrderController` a `next(error)` y mapear `OrderNotFoundError` (404) en el `errorHandler`, sin devolver `error.message` de errores no controlados (H-11) · Archivo: `order.controller.ts`, `errorHandler.ts` · Hecho cuando: un test con error interno devuelve 500 genérico y uno con pedido inexistente devuelve 404

### Fase 2: altas (API)

- [ ] **T9** (~8 min) — Crear `validation.ts` (`esTextoNoVacio`, `esNumeroFinito`, `esEnteroEnRango`, `esUrlHttps`) con tests · Archivo: `packages/api/src/helpers/validation.ts` · Hecho cuando: sus tests pasan
- [ ] **T10** (~10 min) — Tests rojos y validación en `OrderService.create`: `items` array de 1 a 50, `quantity` entero de 1 a 20, plato existente, disponible y del restaurante del pedido · Archivo: `services/order.service.ts` y `order.service.test.ts` · Hecho cuando: `quantity: 1e9` devuelve 400 sin consumir memoria y los tests pasan
- [ ] **T11** (~8 min) — Tests rojos y aislamiento de platos: `findById(id, restaurantId)` y 404 si el plato es de otro restaurante · Archivo: `repositories/dish.repository.ts`, `services/dish.service.ts` · Hecho cuando: `DELETE /restaurants/A/dishes/<id de B>` devuelve 404
- [ ] **T12** (~8 min) — Aislamiento equivalente en ingredientes · Archivo: `repositories/ingredient.repository.ts`, `services/ingredient.service.ts` · Hecho cuando: sus tests pasan
- [ ] **T13** (~6 min) — Aplicar `authorizeRestaurant` en `dish.routes.ts` e `ingredient.routes.ts` y en `restaurant-employee.routes.ts` · Archivo: los tres ficheros de rutas · Hecho cuando: manager de A recibe 403 sobre `/restaurants/B/...`
- [ ] **T14** (~8 min) — Validación de tipos en servicios de platos, ingredientes y restaurantes (nombre, precio, stock, `logoUrl` solo `https`, H-10 y H-17) · Archivo: `dish.service.ts`, `ingredient.service.ts`, `restaurant.service.ts` · Hecho cuando: `name: 123` y `price: 'abc'` devuelven 400 en lugar de 500
- [ ] **T15** (~8 min) — Política de contraseñas (mínimo 10 caracteres, distinta del email, obligatoria) en `RegisterClientUseCase` y `CreateEmployeeUseCase`, con tests unitarios; validar `restaurantId` de `createEmployee` contra la BD (H-16) · Archivo: ambos casos de uso · Hecho cuando: los tests de contraseña corta/vacía/igual al email pasan
- [ ] **T16** (~6 min) — Mitigar enumeración por temporización: `bcrypt.compare` ficticio en `LoginUseCase` si el usuario no existe (H-14) · Archivo: `LoginUseCase.ts` · Hecho cuando: el test unitario confirma que se llama a `comparePasswords` también sin usuario
- [ ] **T17** (~8 min) — Instalar `helmet` y `express-rate-limit`; aplicarlos en `app.ts` (`helmet()`, `x-powered-by` desactivado, límite en `/api/v1/auth`) · Archivo: `app.ts`, `package.json` · Hecho cuando: un test de supertest recibe 429 tras superar el límite y la respuesta lleva cabeceras de `helmet`
- [ ] **T18** (~6 min) — CORS con lista blanca desde `CORS_ORIGINS` (por defecto los puertos 4200-4202 en desarrollo) · Archivo: `app.ts`, `env.ts` · Hecho cuando: un origen no permitido no recibe `Access-Control-Allow-Origin`
- [ ] **T19** (~8 min) — DTO público reducido para restaurantes (sin email, teléfono ni propietario) y paginación con tope en listados públicos y en `EmployeeController` (`limit` máx. 100) (H-05, H-13) · Archivo: `restaurant.controller.ts`, `dish.public.routes.ts`, `EmployeeController.ts` · Hecho cuando: la respuesta pública no contiene datos del propietario y `limit=999999` se acota a 100

### Fase 3: medias y bajas (API)

- [ ] **T20** (~8 min) — Logger estructurado y registro de 500, logins fallidos y 403 (H-12) · Archivo: `helpers/logger.ts`, `errorHandler.ts`, `middlewares.ts`, `LoginUseCase`/`AuthController` · Hecho cuando: un test espía el logger y comprueba que se registra cada evento sin incluir contraseñas ni tokens
- [ ] **T21** (~5 min) — Añadir `*.db`, `*.db-journal` y `.env` a `.gitignore` (H-18) · Archivo: `.gitignore` · Hecho cuando: `git check-ignore packages/api/resttek.db` devuelve la ruta
- [ ] **T22** (~10 min) — Actualizar dependencias de la API: `npm audit fix`, subir `sqlite3` y `vitest`, y volver a ejecutar `npm audit` (H-08) · Archivo: `package.json`, `package-lock.json` · Hecho cuando: no quedan críticas en `--omit=dev` y `npm test` y `npm run seed` funcionan
- [ ] **T23** (~5 min) — Hacer que el seed rechace ejecutarse con `NODE_ENV=production` (credenciales triviales) · Archivo: `src/scripts/seed.ts` · Hecho cuando: `NODE_ENV=production npm run seed` termina con error explicativo

### Fase 4: frontend (web-shared y web-empleados)

- [ ] **T24** (~10 min) — Actualizar Angular y herramientas a >= 21.2.25 y reejecutar `npm audit` (H-03) · Archivo: `package.json` de `web-*` y raíz · Hecho cuando: `npm run build -w @resttek/web-empleados` compila y desaparecen los avisos de `@angular/*`
- [ ] **T25** (~8 min) — `AuthStore`: `JSON.parse` dentro de `try/catch`, interfaz `User` estricta y comprobación de `exp` del JWT al arrancar y en `isAuthenticated` · Archivo: `web-shared/src/lib/auth/auth.store.ts` · Hecho cuando: con `auth_user` corrupto o token caducado en `localStorage` la app carga el login sin lanzar excepción
- [ ] **T26** (~8 min) — Crear `roleGuard(roles)` en `web-shared` y exportarlo en `src/index.ts` · Archivo: `web-shared/src/lib/auth/auth.guard.ts` · Hecho cuando: un usuario sin rol permitido es redirigido a su ruta por defecto
- [ ] **T27** (~7 min) — Aplicar `roleGuard` a `/cocina`, `/barra` y `/salon`, y usar el `defaultRoute` del shell para la redirección inicial · Archivo: `web-empleados/src/app/app.routes.ts` · Hecho cuando: un cocinero que escribe `/salon` en la URL es redirigido
- [ ] **T28** (~8 min) — `OrderStore`: limpiar datos al cerrar sesión, `stopPolling()` al inicio de `startPolling`, y mensajes de error genéricos (H-06, H-07) · Archivo: `order.store.ts` y `AuthService.logout` · Hecho cuando: tras el logout `orders()` es `[]` y no queda más de un intervalo activo
- [ ] **T29** (~6 min) — `auth.interceptor`: añadir el Bearer solo si la URL empieza por `/api` · Archivo: `web-shared/src/lib/http/auth.interceptor.ts` · Hecho cuando: una petición a una URL externa no lleva `Authorization`
- [ ] **T30** (~7 min) — Añadir CSP en `index.html` de web-empleados (`default-src 'self'; connect-src 'self'; frame-ancestors 'none'` salvo lo que requiera Angular para estilos) y documentar la CSP de producción · Archivo: `web-empleados/src/index.html` · Hecho cuando: la aplicación carga en `npm run dev:empleados` sin violaciones de CSP en la consola

### Cierre

- [ ] **T31** (~10 min) — Ejecutar `npm test` completo, `npm audit` y las pruebas manuales de la sección 7 · Archivo: — · Hecho cuando: todo en verde y la tabla de la sección 7 verificada
- [ ] **T32** (~8 min) — Actualizar la documentación (sección 9) · Archivo: `docs/arquitectura/arquitectura-api.md`, `docs/revisiones/`, `CLAUDE.md` · Hecho cuando: documentan `JWT_SECRET`, `CORS_ORIGINS`, autorización por restaurante y rate limiting

**Tiempo total estimado:** ~250 min (32 tareas)

## 7. Plan de pruebas

Automáticas (vitest, `npm test`): los tests de cada tarea de la API. Manuales (tras `npm run seed` y arrancar la API con un `JWT_SECRET` de 32+ caracteres):

1. Arrancar la API sin `JWT_SECRET` (con `NODE_ENV` distinto de `test`) → el proceso termina con un error claro.
2. Token firmado con `super-secret-resttek-key` en `GET /api/v1/employees` → 401.
3. Login como `cliente1@resttek.com` y `GET /api/v1/orders/active?restaurantId=<id>` → 403.
4. Cliente: `PATCH /api/v1/orders/<id>/items/<itemId>/status` → 403.
5. Cliente: `GET /api/v1/orders/<pedido de otro cliente>` → 403; el suyo → 200.
6. Cocinero del restaurante A: `GET /api/v1/orders/active?restaurantId=<B>` → solo ve A (el parámetro se ignora).
7. Manager de A: `DELETE /api/v1/restaurants/A/dishes/<plato de B>` → 404; `POST /restaurants/B/dishes` → 403.
8. `POST /api/v1/orders` con `quantity: 1000000000` → 400 inmediato; con plato de otro restaurante → 400.
9. `POST /api/v1/auth/register` con contraseña `123` → 400; 11 intentos seguidos de login fallido → 429.
10. `GET /api/v1/public/restaurants` → sin `email`, `phone` ni datos del propietario.
11. Cabeceras: `curl -i /health` → incluye `X-Content-Type-Options` y no `X-Powered-By`.
12. Frontend: editar `auth_user.role` en `localStorage` a `cocinero` y navegar a `/salon` → redirige, y aunque se forzara la UI, la API devuelve 403.
13. Frontend: sustituir `auth_token` por un JWT caducado → redirige a `/login` sin error en consola.
14. Frontend: cerrar sesión, iniciar sesión con otro usuario → no se ven pedidos anteriores.

## 8. Riesgos y dudas abiertas

- **Compatibilidad hacia atrás**: exigir `JWT_SECRET` rompe los entornos que no lo definan. Hay que comunicar la variable y, en desarrollo, proporcionar un `.env.example` (sin secretos reales). Al cambiar el secreto, todos los tokens actuales dejan de valer y los usuarios tendrán que volver a iniciar sesión.
- **Los clientes (`web-clientes`)**: `POST /orders` pasa a validar platos y cantidades. Hay que comprobar que su flujo de carrito envía datos válidos (cantidad máxima 20) y que no depende de `GET /orders/:id` para pedidos ajenos.
- **Dependencias nuevas**: `helmet` y `express-rate-limit` son estándar, pero añaden dependencias; necesitan aprobación del usuario antes de instalarse. Alternativa: implementarlo a mano, con peor mantenimiento.
- **Tras actualizar `sqlite3` o Angular** pueden aparecer roturas: se ejecuta `npm test` y el build después de cada actualización.
- **Rate limiting tras proxy**: si en producción hay un proxy inverso, hay que configurar `trust proxy` para que el límite use la IP real.
- **Decisión pendiente**: ¿migrar el JWT a cookie HttpOnly + CSRF, o mantener `localStorage` con CSP y token de vida corta? Se recomienda un plan aparte.
- **Decisión pendiente**: revocación de tokens / refresh tokens (H-15 y H-05 del frontend), fuera del alcance de este plan.
- **Sospecha sin verificar**: la enumeración por temporización en login (H-14) no se ha medido; la corrección es barata, pero no se ha probado el impacto real.
- **No auditados**: `web-admin` y `web-clientes`. Conviene una auditoría equivalente, sobre todo por `logoUrl` (H-17) si alguna app lo renderiza en `src`.

## 9. Documentación a actualizar

- `docs/arquitectura/arquitectura-api.md`: modelo de autorización (roles + pertenencia al restaurante), validación de entrada, rate limiting, logging y variables de entorno (`JWT_SECRET`, `CORS_ORIGINS`).
- `docs/arquitectura/arquitectura-frontend.md`: `roleGuard`, gestión de sesión y CSP.
- `docs/revisiones/inconsistencias-backend.md` y `inconsistencias-frontend.md`: registrar lo que quede pendiente (cookie HttpOnly, revocación).
- `CLAUDE.md`: añadir `JWT_SECRET` a la sección de comandos, y el aviso de que el seed no se ejecuta en producción.
- Crear `packages/api/.env.example` con las variables sin valores reales.
