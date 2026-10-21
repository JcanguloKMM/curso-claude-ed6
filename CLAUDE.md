# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Descripción

Resttek: plataforma de gestión de restaurantes. Monorepo con **npm workspaces** (`packages/*`): una API (`api`, Express 5 + TypeScript + SQLite) y cuatro paquetes Angular 21 (`web-admin`, `web-empleados`, `web-clientes` y la librería `web-shared`). Requiere Node 22+ y npm 10+. La documentación del proyecto está en español (`docs/`) y debe seguir escribiéndose en español.

## Comandos

Todo se ejecuta desde la raíz:

```bash
npm install            # instala todos los workspaces
npm run seed           # puebla la BD (idempotente, INSERT OR IGNORE); imprime las credenciales
npm run dev:api        # API en :3000 (tsx watch)
npm run dev:admin      # web-admin en :4200
npm run dev:empleados  # web-empleados en :4201
npm run dev:clientes   # web-clientes en :4202
npm test               # tests de la API (vitest run)
```

- Test individual: `cd packages/api && npx vitest run src/services/order.service.test.ts` (o `-t "nombre del test"`). Modo watch: `npm run test:watch` en `packages/api`.
- Los frontends solo tienen `start`, `build` y `watch` (`ng build`); no hay lint ni tests de frontend configurados.
- Credenciales de prueba tras el seed: la contraseña es el propio email (p. ej. `admin@resttek.com`, `gerente1@resttek.com`, `cocinero1@resttek.com`, `camarero1@resttek.com`, `cliente1@resttek.com`).

## Arquitectura

Documentación detallada en `docs/arquitectura/` y `docs/dominio/`; léela antes de cambios grandes.

### API (`packages/api`)

Conviven **dos estilos** y hay que saber cuál aplica a cada dominio:

- **Hexagonal + DDD** solo en `src/contexts/employee/` (domain → application → infrastructure). `Employee` es la única entidad de dominio real (constructor privado + `create()`); casos de uso como `LoginUseCase`; la composición de dependencias está en `infrastructure/http/dependencies.ts`. `src/contexts/shared/` contiene el value object `Email` y los middlewares/`errorHandler` de Express.
- **Por capas** en `restaurant`, `dish`, `ingredient` y `order`: carpetas transversales `models/`, `repositories/`, `services/`, `controllers/`, `routes/`, un fichero por dominio. Aquí los modelos son `interface` planas y la validación vive en los servicios.

Otros puntos:
- Los repositorios son interfaz + implementación SQLite, con mocks en `repositories/mocks/` y `application/mocks/` para los tests unitarios.
- Errores de dominio en `src/errors/` (`AppError`, `DomainErrors`), traducidos a HTTP por el `errorHandler`.
- Las tablas se crean al arrancar (migraciones en código, `src/config/database.ts`). BD en `packages/api/resttek.db`; con `NODE_ENV=test` se usa SQLite en memoria.
- Auth con JWT: middleware `authenticate` y `authorize` (roles). Rutas bajo `/api/v1`; hay rutas públicas separadas (`*.public.routes.ts`) para clientes.

### Frontends

- Angular 21: standalone, signals, **zoneless**, guards/interceptors funcionales. Cada app hace proxy de `/api` → `localhost:3000` mediante `proxy.conf.json`.
- `@resttek/web-shared` (`src/index.ts`, sin build) es la única dependencia compartida (auth, interceptors, componentes comunes); los cambios en él no se reflejan en caliente: reinicia el dev server.
- `web-admin` y `web-empleados`: features con `models/ pages/ services/ store/`. Patrón **Store**: servicio `providedIn: 'root'` con signals privadas expuestas con `asReadonly()`, y `loading`/`error`/datos; el store convierte los `Observable` del service con `firstValueFrom`, y los componentes solo hablan con el store. `OrderStore` de empleados hace polling cada 30 s.
- `web-clientes` es distinta: modelos/servicios centralizados en `core/`, features como componentes sueltos que usan `.subscribe()` directamente; el único store es `CartStore` (local, sin HTTP). Su componente raíz se llama `App`, no `AppComponent`.

## Otros

- `docs/revisiones/` recoge inconsistencias conocidas entre código y documentación.
- `scripts/seed-issues.sh` crea issues de GitHub desde `scripts/issues.json` (requiere `gh` y `jq`).
- El directorio no es un repositorio git por ahora.
