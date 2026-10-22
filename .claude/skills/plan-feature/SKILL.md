---
name: plan-feature
description: Recibe el número de una issue de GitHub, la lee con gh, planifica cómo implementar la funcionalidad o corregir el bug y publica el plan detallado (tareas de 5-10 minutos) como comentario en esa issue. Úsala cuando el usuario pida planificar, diseñar o preparar el trabajo de una issue antes de programarlo.
argument-hint: <número de issue>
---

# Planificar una issue

Lee una issue de GitHub, genera un plan de implementación detallado y lo **publica como comentario en la propia issue**, **sin modificar código**. Esta skill solo planifica.

## Entrada

`$ARGUMENTS` debe ser el número de la issue (p. ej. `42` o `#42`).

- Si falta o no es un número, pregúntalo al usuario con `AskUserQuestion`. No lo inventes.
- Si la issue es demasiado vaga para planificar (no se sabe qué comportamiento se espera o cómo reproducir el fallo), haz al usuario las preguntas mínimas necesarias antes de continuar.

## Pasos

1. **Lee la issue** con GitHub CLI: `gh issue view <n> --comments` (y `--json title,body,labels,state,url` si necesitas datos estructurados). Si `gh` falla (no autenticado, issue inexistente), detente e informa al usuario. Si la issue está cerrada, avísale antes de seguir. Si ya existe un comentario de plan (empieza por `<!-- plan-feature -->`), pregunta si se reemplaza o se añade uno nuevo.
2. **Clasifica** la issue: funcionalidad o bug (por etiquetas y contenido).
3. **Lee el contexto**: [CLAUDE.md](../../../CLAUDE.md) (arquitectura y convenciones) y la documentación relevante de `docs/` (p. ej. `docs/api/api-pagination.md` si afecta a listados GET).
4. **Analiza el código actual** relacionado, capa por capa (`routes/`, `controllers/`, `services/`, `repositories/`, `models/`, `helpers/`). En un bug, localiza la causa raíz y cómo reproducirla.
5. **Diseña la solución** respetando las reglas del proyecto:
   - Estructura de capas: `routes → controllers → services → repositories → SQLite`, sin saltarse capas.
   - SQL a mano con sentencias preparadas (`node:sqlite`); prohibidos ORMs y dependencias de BD.
   - Código, mensajes de error y campos en español.
6. **Descompón en tareas** (ver reglas abajo).
7. **Escribe el plan** a partir de la plantilla [assets/plantilla-plan.md](assets/plantilla-plan.md), respetando sus secciones y su orden. Elimina las secciones opcionales que no apliquen indicando "No aplica" en lugar de borrarlas, para mantener la estructura. Escríbelo en un archivo temporal del directorio scratchpad, **no** en el repositorio.
8. **Publícalo como comentario en la issue**: `gh issue comment <n> --body-file <archivo-temporal>`. El comentario debe empezar por la línea `<!-- plan-feature -->` (marcador para que `implementar-plan` lo encuentre). Comprueba después con `gh issue view <n> --comments` que se ha publicado.
9. **Resume** al usuario el plan y el enlace al comentario.
10. **Avisa por Slack** (ver sección "Aviso por Slack") de que el plan ya se puede revisar.

## Aviso por Slack

Al terminar de publicar el plan, publica un mensaje en el canal de Slack **`planes-ed8`** (ID `C0CAKE90QFR`) con `mcp__slack__slack_post_message`.

- Si el ID no funciona, localiza el canal por nombre con `mcp__slack__slack_list_channels`.
- Mensaje en español, con este formato:
  `📝 El plan de la issue #<n> ya está listo para revisar: <enlace al comentario> — <tipo: feature/bugfix> · <resumen de una línea> · <nº de tareas> tareas (~<tiempo total>).`
- Envíalo **solo cuando el comentario esté publicado**, no antes.
- Si el envío falla (herramienta no disponible o error de Slack), no abortes: indícalo al usuario en el resumen final y muéstrale el texto del mensaje.

## Reglas de la lista de tareas

- Cada tarea debe poder completarse en **5-10 minutos**. Si estimas más, divídela.
- Una tarea = una acción concreta en un archivo o capa, con un resultado verificable ("Hecho cuando: ...").
- Ordénalas por dependencias, de la capa más baja a la más alta (modelo/esquema → repository → service → controller → routes), seguidas de las pruebas manuales y la documentación.
- Formato: `- [ ] **T1** (~5 min) — Acción · Archivo: ruta · Hecho cuando: criterio`.
- Indica el tiempo total estimado al final de la lista.
- En un bug, la primera tarea debe ser reproducir el fallo y la última, verificar que ya no ocurre.

## Idioma y límites

- Todo el plan se escribe en **español**.
- No implementes nada ni modifiques archivos del repositorio. Lo único que se escribe fuera del scratchpad es el comentario en la issue.
- No cambies el título, el cuerpo, las etiquetas ni el estado de la issue; solo añade el comentario del plan.
- Basa el plan en lo que has leído en el código; no inventes archivos, funciones ni rutas que no existan. Marca como "Crear" lo que sea nuevo.
