# Plan: <título corto de la funcionalidad o bug>

- **Tipo:** <funcionalidad | bug>
- **Fecha:** <AAAA-MM-DD>
- **Estado:** Pendiente

## 1. Resumen

<Qué se quiere conseguir (funcionalidad) o qué falla (bug) y por qué, en 2-4 líneas.>

## 2. Alcance

### Incluye

- <Qué entra en este plan>

### No incluye

- <Qué queda fuera a propósito>

## 3. Análisis del código actual

<Archivos, capas y comportamientos existentes relacionados. Enlaza con rutas relativas, p. ej. [services/vendehumoService.js](../../services/vendehumoService.js). En un bug, incluye la causa raíz y cómo reproducirlo.>

## 4. Diseño de la solución

<Enfoque elegido y decisiones clave. Indica cómo respeta la estructura de capas (`routes → controllers → services → repositories → SQLite`).>

### Cambios en la API (si aplica)

| Método | Ruta | Descripción | Códigos de respuesta |
| ------ | ---- | ----------- | -------------------- |
| <GET> | <`/ruta`> | <qué hace> | <200, 400, 404> |

### Cambios en el modelo de datos (si aplica)

<Campos nuevos o modificados, cambios de esquema SQL y su impacto en los datos existentes.>

## 5. Archivos afectados

| Archivo | Acción | Motivo |
| ------- | ------ | ------ |
| <`capa/archivo.js`> | <Crear / Modificar / Eliminar> | <por qué> |

## 6. Lista de tareas

> Cada tarea debe poder hacerse en 5-10 minutos y tener un resultado verificable.

- [ ] **T1** (~5 min) — <Acción concreta> · Archivo: <`ruta`> · Hecho cuando: <criterio verificable>
- [ ] **T2** (~10 min) — <Acción concreta> · Archivo: <`ruta`> · Hecho cuando: <criterio verificable>

**Tiempo total estimado:** <suma> min

## 7. Plan de pruebas

<Como el proyecto no tiene tests automáticos, indica las comprobaciones manuales (peticiones `curl` con el resultado esperado), incluidos casos límite y de error.>

1. <Petición> → <Resultado esperado>

## 8. Riesgos y dudas abiertas

- <Riesgo, compatibilidad hacia atrás o pregunta pendiente>

## 9. Documentación a actualizar

- <Archivos de `docs/` o secciones de CLAUDE.md que deban cambiar, o "Ninguna">
