---
name: plan-feature
description: Planifica cómo implementar una nueva funcionalidad o corregir un bug y genera un plan detallado en docs/plans con una lista de tareas de 5-10 minutos cada una. Úsala cuando el usuario pida planificar, diseñar o preparar el trabajo antes de programarlo.
argument-hint: <descripción de la funcionalidad o del bug>
---

# Planificar funcionalidad o bug

Genera un plan de implementación detallado en `docs/plans/` **sin modificar código**. Esta skill solo planifica.

## Entrada

`$ARGUMENTS` describe la funcionalidad o el bug. Si es demasiado vago para planificar (no se sabe qué comportamiento se espera o cómo reproducir el fallo), haz al usuario las preguntas mínimas necesarias antes de continuar.

## Pasos

1. **Clasifica** la petición: funcionalidad o bug.
2. **Lee el contexto**: [CLAUDE.md](../../../CLAUDE.md) (arquitectura y convenciones) y la documentación relevante de `docs/` (p. ej. `docs/api/api-pagination.md` si afecta a listados GET).
3. **Analiza el código actual** relacionado, capa por capa (`routes/`, `controllers/`, `services/`, `repositories/`, `models/`, `helpers/`). En un bug, localiza la causa raíz y cómo reproducirla.
4. **Diseña la solución** respetando las reglas del proyecto:
   - Estructura de capas: `routes → controllers → services → repositories → SQLite`, sin saltarse capas.
   - SQL a mano con sentencias preparadas (`node:sqlite`); prohibidos ORMs y dependencias de BD.
   - Código, mensajes de error y campos en español.
5. **Descompón en tareas** (ver reglas abajo).
6. **Escribe el plan** a partir de la plantilla [assets/plantilla-plan.md](assets/plantilla-plan.md), respetando sus secciones y su orden. Elimina las secciones opcionales que no apliquen indicando "No aplica" en lugar de borrarlas, para mantener la estructura.
7. **Guarda** el archivo en `docs/plans/` (crea la carpeta si no existe) y resume al usuario el plan y la ruta del archivo.
8. **Avisa por Slack** (ver sección "Aviso por Slack") de que el plan ya se puede revisar.

## Aviso por Slack

Al terminar de guardar el plan, publica un mensaje en el canal de Slack **`planes-ed8`** (ID `C0CAKE90QFR`) con `mcp__slack__slack_post_message`.

- Si el ID no funciona, localiza el canal por nombre con `mcp__slack__slack_list_channels`.
- Mensaje en español, con este formato:
  `📝 El plan ya está listo para revisar: <ruta del plan> — <tipo: feature/bugfix> · <resumen de una línea> · <nº de tareas> tareas (~<tiempo total>).`
- Envíalo **solo cuando el plan esté completamente escrito y guardado**, no antes.
- Si el envío falla (herramienta no disponible o error de Slack), no abortes: indícalo al usuario en el resumen final y muéstrale el texto del mensaje.

## Nombre del archivo

`docs/plans/AAAA-MM-DD-<tipo>-<slug>.md`, donde:

- `AAAA-MM-DD` es la fecha de hoy.
- `<tipo>` es `feature` o `bugfix`.
- `<slug>` es un resumen en minúsculas, sin tildes y con guiones (p. ej. `2026-10-15-feature-votar-vendehumo.md`).

Si el archivo ya existe, no lo sobrescribas: pregunta al usuario o añade un sufijo `-2`.

## Reglas de la lista de tareas

- Cada tarea debe poder completarse en **5-10 minutos**. Si estimas más, divídela.
- Una tarea = una acción concreta en un archivo o capa, con un resultado verificable ("Hecho cuando: ...").
- Ordénalas por dependencias, de la capa más baja a la más alta (modelo/esquema → repository → service → controller → routes), seguidas de las pruebas manuales y la documentación.
- Formato: `- [ ] **T1** (~5 min) — Acción · Archivo: ruta · Hecho cuando: criterio`.
- Indica el tiempo total estimado al final de la lista.
- En un bug, la primera tarea debe ser reproducir el fallo y la última, verificar que ya no ocurre.

## Idioma y límites

- Todo el plan se escribe en **español**.
- No implementes nada ni toques archivos fuera de `docs/plans/`.
- No hagas commit salvo que el usuario lo pida.
- Basa el plan en lo que has leído en el código; no inventes archivos, funciones ni rutas que no existan. Marca como "Crear" lo que sea nuevo.
