---
name: implementar-plan
description: Recibe el número de una issue de GitHub, obtiene de sus comentarios el plan publicado por plan-feature y lo implementa en una rama nueva creada desde development dentro de un git worktree propio (uno por agente si se reparte por aplicaciones), aplicando TDD estricto con vitest tarea a tarea, con un commit por tarea. Al terminar deja la PR lista para revisión y envía el enlace a Slack. Úsala cuando el usuario pida implementar, ejecutar o desarrollar el plan de una issue.
argument-hint: <número de issue>
---

# Implementar un plan

Implementa el plan de una issue siguiendo siempre este orden: **leer plan de la issue → rama en worktree → TDD tarea a tarea → commit → marcar tarea → PR lista para revisión → aviso en Slack**.

Los cambios **nunca** se hacen en el directorio de trabajo principal: se hacen en un `git worktree` dedicado a la rama de trabajo.

## Entrada

`$ARGUMENTS` debe ser el número de la issue (p. ej. `42` o `#42`) cuyo plan hay que implementar. Ese número es también el número de ticket para ramas, commits y PR.

- Si falta o no es un número, pregúntalo con `AskUserQuestion`. No lo inventes.
- Obtén el plan con GitHub CLI: `gh issue view <n> --comments --json title,url,comments`. El plan es el comentario que empieza por `<!-- plan-feature -->` (si hay varios, usa el más reciente). Guárdalo en un archivo temporal del scratchpad.
- Si `gh` falla o la issue no tiene ningún comentario de plan, **detente** e indica al usuario que ejecute antes `plan-feature <n>`. No inventes el plan.

## Paso 1. Leer el contexto

1. Lee el plan completo (el comentario de la issue) y [CLAUDE.md](../../../CLAUDE.md) (arquitectura de capas, SQL a mano con `node:sqlite`, todo en español).
2. Identifica la lista de tareas (`- [ ] **T1** ...`). Si alguna ya está marcada `[x]`, es que se retoma el trabajo: continúa desde la primera pendiente.
3. Comprueba que el árbol de trabajo está limpio (`git status`). Si hay cambios ajenos al plan, avisa al usuario antes de crear la rama y el worktree.

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
- Cada agente marca en el plan únicamente sus propias tareas y hace un commit por tarea. Cada rama genera su propia PR.
- Si una tarea toca varias apps o depende de otra app (p. ej. un contrato de la API que consume un frontend), respeta el orden del plan: no lances al agente dependiente hasta que la tarea de la que depende esté terminada, o consulta al usuario.
- Si el usuario **no** pide varios agentes, usa un único worktree aunque el plan toque varias apps.

### Formato del nombre

`<tipo-cambio>/<num-ticket>-<breve-descripcion>`

- `<tipo-cambio>`: `feat`, `fix`, `refactor`, `docs`, `test`, `perf`, `chore`, etc. (mismos tipos que Conventional Commits). Deducelo del plan: funcionalidad → `feat`, bug → `fix`.
- `<num-ticket>`: el número de la issue recibida.
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
4. **Marcar la tarea**: cambia `- [ ]` por `- [x]` de esa tarea en tu copia local del plan y actualiza el comentario de la issue con ella (`gh api -X PATCH repos/{owner}/{repo}/issues/comments/<id-comentario> -F body=@<archivo>`; el id sale de la consulta del comentario). Si el plan tiene campo `Estado`, ponlo en `En curso` (o `Completado` al terminar la última). El plan **no** se añade al repositorio ni a los commits.
5. **Commit**: invoca la skill `commit` (un commit por tarea, que incluya test y código). Deja que siga su flujo, incluida la confirmación del mensaje. Usa `Refs: #<num-ticket>` como pie.
6. Pasa a la siguiente tarea.

### Reglas del TDD

- **Nunca** escribas código de producción sin un test rojo previo que lo exija.
- Tareas que no producen comportamiento testeable (documentación, actualizar `CLAUDE.md`, cambios de configuración): no se fuerza un test artificial, pero indica explícitamente en el resumen que se ha omitido el ciclo y por qué.
- Las "pruebas manuales" del plan se ejecutan de verdad (p. ej. arrancando la API y con `curl`) y se reportan, no se marcan sin hacerlas.
- Si un test falla de forma inesperada o una tarea resulta inviable o distinta de lo planeado, **detente y consulta al usuario**; no cambies el plan en silencio. Si hay que ajustarlo, anota el cambio en el plan (comentario de la issue).
- No marques una tarea como hecha con tests en rojo.

## Paso 5. Cierre: PR lista para revisión

1. Ejecuta `npm test` completo y comprueba que `git status` está limpio, ambas cosas **dentro del worktree** (de cada worktree, si hay varios agentes). Comprueba también que todas las tareas del plan están marcadas.
2. **Publica la rama**: `git -C <ruta-worktree> push -u origin <nombre-rama>`. Nunca hagas `push` a `development`, `main` ni `master`, ni uses `--force`.
3. **Abre la PR** contra `development` con `gh pr create --base development --head <nombre-rama>` (**no** como borrador: debe quedar lista para que alguien la revise):
   - Título en formato Conventional Commits, en español (p. ej. `feat: asociar vendehumo a usuario`).
   - Descripción en español con: resumen del cambio, enlace a la issue con `Closes #<n>` (o `Refs #<n>` si la PR no la resuelve entera), lista de tareas del plan completadas, resultado de `npm test`, pruebas manuales realizadas y cualquier tarea omitida o desviación del plan. Termínala con la atribución que indiquen las instrucciones de Claude Code para PRs.
   - Con varios agentes, una PR por rama; menciona en cada una las demás.
4. **Deja la PR lista**: verifica con `gh pr view <pr> --json isDraft,mergeable,statusCheckRollup,url` que no es borrador, que no tiene conflictos y consulta el estado de los checks (`gh pr checks <pr>`). Si hay conflictos o checks en rojo por tu cambio, corrígelos antes de avisar. Si puedes, asigna revisores con `--reviewer` solo si el usuario los ha indicado.
5. Resume al usuario: rama(s) y ruta(s) de worktree, tareas completadas, commits, resultados de los tests, enlace(s) de la PR y cualquier tarea omitida o desviación.
6. **No fusiones la PR ni elimines el worktree** (`git worktree remove`) salvo que el usuario lo pida. Indica cómo limpiarlo cuando la rama se haya fusionado.
7. **Envía el enlace de la PR a Slack** (ver abajo).

### Aviso por Slack

Tras abrir la PR y comprobar que está lista, publica un mensaje en el canal de Slack **`planes-ed8`** (ID `C0CAKE90QFR`) con `mcp__slack__slack_post_message`.

- Si el ID no funciona, localiza el canal por nombre con `mcp__slack__slack_list_channels`.
- Mensaje en español, con este formato:
  `✅ La PR de la issue #<n> está lista para revisar: <enlace de la PR> · rama <nombre-rama> · <n>/<total> tareas completadas · tests: <resultado de npm test>.`
- Si hubo tareas omitidas o desviaciones del plan, añádelas brevemente al final del mensaje.
- Con varios agentes, envía un único mensaje que liste todas las PRs, cuando todos hayan terminado.
- Envíalo **solo cuando todas las tareas estén terminadas**, `npm test` ejecutado y la PR abierta. Si te detienes a mitad por una consulta al usuario, no lo envíes.
- Si el envío falla (herramienta no disponible o error de Slack), no abortes: indícalo al usuario en el resumen final y muéstrale el texto del mensaje.

## Idioma y límites

- Comunícate, comenta el código y escribe tests, mensajes y documentación en **español**.
- No toques archivos que no correspondan a las tareas del plan ni modifiques el directorio de trabajo principal.
- No cambies el título, las etiquetas ni el estado de la issue; solo edita el comentario del plan para marcar tareas.
- No uses `git add -A` ni `git add .`; añade los archivos por nombre.
