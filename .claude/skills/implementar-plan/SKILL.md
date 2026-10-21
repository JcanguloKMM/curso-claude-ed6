---
name: implementar-plan
description: Implementa un plan de docs/plans (adjuntado por el usuario) en una rama nueva creada desde development dentro de un git worktree propio (uno por agente si se reparte por aplicaciones), aplicando TDD estricto con vitest tarea a tarea, con un commit por tarea y marcándola como hecha en el plan. Úsala cuando el usuario pida implementar, ejecutar o desarrollar un plan.
argument-hint: <ruta del plan> [<num-ticket>]
---

# Implementar un plan

Implementa el plan indicado siguiendo siempre este orden: **rama en worktree → TDD tarea a tarea → commit → marcar tarea**.

Los cambios **nunca** se hacen en el directorio de trabajo principal: se hacen en un `git worktree` dedicado a la rama de trabajo.

## Entrada

`$ARGUMENTS` debe contener la ruta del plan (normalmente `docs/plans/AAAA-MM-DD-<tipo>-<slug>.md`) y, si se conoce, el número de ticket.

- Si no hay plan adjunto o el archivo no existe, **detente** y pide al usuario que lo adjunte. No inventes el plan.
- Si falta el número de ticket, pregúntalo con `AskUserQuestion` antes de crear la rama. No lo inventes.

## Paso 1. Leer el contexto

1. Lee el plan completo y [CLAUDE.md](../../../CLAUDE.md) (arquitectura de capas, SQL a mano con `node:sqlite`, todo en español).
2. Identifica la lista de tareas (`- [ ] **T1** ...`). Si alguna ya está marcada `[x]`, es que se retoma el trabajo: continúa desde la primera pendiente.
3. Comprueba que el árbol de trabajo está limpio (`git status`). Si hay cambios ajenos al plan, avisa al usuario antes de crear la rama y el worktree. Los archivos sin seguimiento del propio plan no cuentan.

## Paso 2. Crear la rama en un worktree

La rama siempre parte de `development` y vive en su propio worktree.

1. Comprueba si existe `development` en local o en remoto (`git branch --list development`, `git ls-remote --heads origin development` si hay remoto).
2. **Si no existe**: determina la rama base (`master` o `main`, la que exista; si existen ambas, pregunta cuál) y crea `development` desde ella **sin cambiar de rama** (`git branch development <base>`). Si hay remoto, ofrece publicarla, pero no hagas `push` sin confirmación.
3. **Si existe** y hay remoto: `git fetch origin` y actualiza `development` sin salir de la rama actual (`git fetch origin development:development`, que solo admite avance rápido).
4. Crea el worktree y la rama de trabajo a la vez, desde `development`:
   `git worktree add -b <nombre-rama> <ruta-worktree> development`
5. Trabaja **siempre dentro de `<ruta-worktree>`** (rutas absolutas o `git -C <ruta-worktree>`): edición, tests, `git add` y commits. El directorio principal no se toca.

### Ubicación del worktree

Dentro del repositorio, en `.claude/worktrees/<nombre-rama con "/" sustituido por "-">`. Ejemplo: `.claude/worktrees/feat-123-asociar-vendehumo-usuario`.

Antes de crear el primero, comprueba con `git check-ignore -q .claude/worktrees` que la carpeta está ignorada. Si no lo está, añade la línea `.claude/worktrees/` al `.gitignore` y avisa al usuario (para que los worktrees no aparezcan como archivos sin seguimiento en el repositorio principal).

Si la ruta o la rama ya existen, pregunta al usuario si quiere reutilizarlas; no las sobrescribas ni uses `--force`.

### Varios agentes (una aplicación por agente)

Si el plan afecta a varias aplicaciones (p. ej. `api`, `web-admin`, `web-empleados`, `web-clientes`) **y el usuario pide que varios agentes las implementen, cada uno una app**:

- Crea **un worktree y una rama por agente**, todos desde `development`, con el nombre de la app como sufijo: `<tipo>/<num-ticket>-<breve-descripcion>-<app>` (p. ej. `feat/123-pedidos-api` y `feat/123-pedidos-web-empleados`), y ruta `.claude/worktrees/<rama con "-">`.
- Crea los worktrees tú antes de lanzar a los agentes y pasa a cada uno su ruta, su rama, el plan y esta skill. Cada agente trabaja **solo** en su worktree y **solo** en las tareas de su app.
- Cada agente marca en el plan únicamente sus propias tareas (en la copia del plan de su worktree) y hace un commit por tarea. Esto evita editar los mismos archivos entre agentes.
- Si una tarea toca varias apps o depende de otra app (p. ej. un contrato de la API que consume un frontend), respeta el orden del plan: no lances al agente dependiente hasta que la tarea de la que depende esté terminada, o consulta al usuario.
- Si el usuario **no** pide varios agentes, usa un único worktree aunque el plan toque varias apps.

### Formato del nombre

`<tipo-cambio>/<num-ticket>-<breve-descripcion>`

- `<tipo-cambio>`: `feat`, `fix`, `refactor`, `docs`, `test`, `perf`, `chore`, etc. (mismos tipos que Conventional Commits). Deducelo del plan: funcionalidad → `feat`, bug → `fix`.
- `<num-ticket>`: el número de ticket recibido.
- `<breve-descripcion>`: 2-5 palabras en minúsculas, sin tildes ni caracteres especiales, separadas por guiones.
- Ejemplo: `feat/123-asociar-vendehumo-usuario`.

Si hay varios agentes, añade el sufijo `-<app>` al final de la descripción (ver arriba).

## Paso 3. Preparar vitest

Los tests se escriben con **vitest**. Si no está configurado:

0. En un worktree nuevo no hay `node_modules`: ejecuta `npm install` dentro del worktree antes de nada.
1. `npm install -D vitest` (dependencia de desarrollo; las restricciones sobre dependencias de BD no se ven afectadas).
2. Sustituye el script placeholder `test` de `package.json` por `"test": "vitest run"`.
3. Verifica que `npm test` arranca. Cuando todavía no hay tests, vitest sale con error, por lo que es esperable; lo importante es que la herramienta funcione.
4. Haz un commit propio de esta preparación (`build(deps): ...`) antes de empezar con las tareas.

Convenciones de los tests:

- Archivos `*.test.js` dentro de `tests/` en la raíz, espejando la estructura de capas (`tests/services/...`, `tests/repositories/...`).
- Para repositories usa una BD en memoria (`:memory:`), nunca `vendehumos.db`.
- Para services, mockea el repository; para controllers, mockea el service. Para endpoints, levanta la app en un puerto efímero y usa `fetch`.
- Si vitest no resuelve `node:sqlite`, externalízalo en `vitest.config.js` (`test.server.deps.external`) en lugar de cambiar de librería de BD.
- Los nombres de los tests (`describe`/`it`) van en español.

## Paso 4. Bucle TDD estricto, tarea a tarea

Procesa las tareas **en el orden del plan**, de una en una. No empieces la siguiente hasta terminar la actual. Para cada tarea:

1. **Rojo**: escribe primero el test (o tests) que describe el resultado de "Hecho cuando". Ejecútalo (`npx vitest run <archivo>`) y **comprueba que falla por el motivo correcto** (falta la funcionalidad, no un error de sintaxis o de import). Si pasa sin código nuevo, el test no sirve: corrígelo.
2. **Verde**: escribe el **mínimo** código de producción para que pase. Respeta la estructura de capas y el SQL a mano. No adelantes código de tareas posteriores.
3. **Refactor**: limpia el código y los tests sin cambiar el comportamiento. Ejecuta `npm test` completo y confirma que todo está en verde.
4. **Marcar la tarea**: cambia `- [ ]` por `- [x]` de esa tarea en el plan y, si el plan tiene campo `Estado`, ponlo en `En curso` (o `Completado` al terminar la última).
5. **Commit**: invoca la skill `commit` (un commit por tarea, que incluya test, código y el plan actualizado). Deja que siga su flujo, incluida la confirmación del mensaje. Usa `Refs: <num-ticket>` como pie.
6. Pasa a la siguiente tarea.

### Reglas del TDD

- **Nunca** escribas código de producción sin un test rojo previo que lo exija.
- Tareas que no producen comportamiento testeable (documentación, actualizar `CLAUDE.md`, cambios de configuración): no se fuerza un test artificial, pero indica explícitamente en el resumen que se ha omitido el ciclo y por qué.
- Las "pruebas manuales" del plan se ejecutan de verdad (p. ej. arrancando la API y con `curl`) y se reportan, no se marcan sin hacerlas.
- Si un test falla de forma inesperada o una tarea resulta inviable o distinta de lo planeado, **detente y consulta al usuario**; no cambies el plan en silencio. Si hay que ajustarlo, anota el cambio en el propio plan.
- No marques una tarea como hecha con tests en rojo.

## Paso 5. Cierre

1. Ejecuta `npm test` completo y comprueba que `git status` está limpio, ambas cosas **dentro del worktree** (de cada worktree, si hay varios agentes).
2. Resume al usuario: rama(s) y ruta(s) de worktree creadas, tareas completadas, commits generados, resultados de los tests y cualquier tarea omitida o desviación.
3. **No hagas `push`, no abras PR, no fusiones la rama y no elimines el worktree** (`git worktree remove`) salvo que el usuario lo pida. Indica cómo limpiarlo cuando la rama se haya fusionado.
4. **Avisa por Slack** de que la implementación ya se puede revisar (ver abajo).

### Aviso por Slack

Tras el resumen del cierre, publica un mensaje en el canal de Slack **`planes-ed8`** (ID `C0CAKE90QFR`) con `mcp__slack__slack_post_message`.

- Si el ID no funciona, localiza el canal por nombre con `mcp__slack__slack_list_channels`.
- Mensaje en español, con este formato:
  `✅ La implementación ya está lista para revisar: rama <nombre-rama> (worktree <ruta>) · plan <ruta del plan> · <n>/<total> tareas completadas · tests: <resultado de npm test>.`
- Si hubo tareas omitidas o desviaciones del plan, añádelas brevemente al final del mensaje.
- Con varios agentes, envía un único mensaje que liste todas las ramas y worktrees, cuando todos hayan terminado.
- Envíalo **solo cuando todas las tareas estén terminadas** y `npm test` esté ejecutado. Si te detienes a mitad por una consulta al usuario, no lo envíes.
- Si el envío falla (herramienta no disponible o error de Slack), no abortes: indícalo al usuario en el resumen final y muéstrale el texto del mensaje.

## Idioma y límites

- Comunícate, comenta el código y escribe tests, mensajes y documentación en **español**.
- No toques archivos que no correspondan a las tareas del plan ni modifiques el directorio de trabajo principal.
- No uses `git add -A` ni `git add .`; añade los archivos por nombre.
