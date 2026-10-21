---
description: Crea un commit siguiendo la especificación Conventional Commits
argument-hint: [pista opcional sobre el tipo o el alcance]
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

# Crear commit (Conventional Commits)

Crea un commit con los cambios actuales siguiendo la especificación [Conventional Commits 1.0.0](https://www.conventionalcommits.org/es/v1.0.0/).

## Contexto

- Estado del repositorio: !`git status --short`
- Cambios en staging: !`git diff --cached`
- Cambios sin añadir a staging: !`git diff`
- Últimos commits (para respetar el estilo): !`git log --oneline -10 2>/dev/null || echo "(sin commits todavía)"`

## Argumentos

$ARGUMENTS

Si se indica algo (p. ej. un tipo o un alcance), úsalo como pista, pero verifica que encaja con los cambios reales.

## Formato del mensaje

```
<tipo>[alcance opcional][!]: <descripción>

[cuerpo opcional]

[pie(s) opcional(es)]
```

### Tipos permitidos

| Tipo       | Cuándo usarlo                                                      |
| ---------- | ------------------------------------------------------------------ |
| `feat`     | Nueva funcionalidad (sube versión MINOR)                           |
| `fix`      | Corrección de un error (sube versión PATCH)                        |
| `docs`     | Solo documentación                                                 |
| `style`    | Formato que no afecta al significado (espacios, comas, etc.)       |
| `refactor` | Cambio de código que ni corrige un error ni añade funcionalidad    |
| `perf`     | Mejora de rendimiento                                              |
| `test`     | Añadir o corregir tests                                            |
| `build`    | Cambios en el sistema de build o dependencias (p. ej. `package.json`) |
| `ci`       | Cambios en la configuración de integración continua                |
| `chore`    | Tareas de mantenimiento que no tocan `src` ni tests                |
| `revert`   | Revierte un commit anterior                                        |

### Reglas

1. **Tipo** en minúsculas, obligatorio, seguido de `:` y un espacio.
2. **Alcance** opcional entre paréntesis, en minúsculas, referido a la zona afectada. En este proyecto, por ejemplo: `auth`, `vendehumos`, `usuarios`, `db`, `routes`, `controllers`, `services`, `repositories`, `models`, `helpers`.
3. **Descripción** en español, en imperativo o infinitivo coherente con el historial (p. ej. "añade endpoint de login"), en minúsculas, sin punto final y de **72 caracteres o menos** en la primera línea.
4. **Cuerpo** opcional, separado por una línea en blanco. Explica el *qué* y el *porqué*, no el *cómo*. Líneas de unos 72 caracteres.
5. **Cambios incompatibles**: añade `!` tras el tipo/alcance (`feat(auth)!: ...`) y/o un pie `BREAKING CHANGE: <explicación>`.
6. **Pies** opcionales, p. ej. `Refs: #123`, `Closes: #45`.
7. Un commit = un cambio lógico. Si los cambios mezclan varios propósitos, propón dividirlos en varios commits y haz uno por cada grupo.

## Pasos

1. Analiza los cambios del contexto. Si no hay nada que commitear, avísalo y detente.
2. Decide el tipo y el alcance más adecuados. Si hay duda real, pregunta antes de commitear.
3. Si hay cambios sin staging, añade **solo los archivos relevantes por nombre** con `git add <archivos>`. No uses `git add -A` ni `git add .`.
4. No incluyas archivos sensibles ni generados (`.env`, `*.db`, `node_modules/`, claves, etc.). Si aparecen, avisa en lugar de añadirlos.
5. Redacta el mensaje según el formato anterior y crea el commit usando un HEREDOC para conservar los saltos de línea:

   ```bash
   git commit -m "$(cat <<'EOF'
   <tipo>(<alcance>): <descripción>

   <cuerpo opcional>

   Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
   EOF
   )"
   ```
6. Redacta el mensaje cumpliendo las reglas anteriores y muestraselo al usuario utilizando la tool `AskUserQuestion` para preguntarle si le parece bien el mensaje. Si no le parece bien, genera otro mensaje y le vuelves a preguntar. Cuando lo de por válido sigue al siguiente paso.
7. Ejecuta `git status` para confirmar que el commit se ha creado y muestra al usuario el mensaje final.

## Restricciones

- No hagas `git push`.
- No uses `--amend`, `--no-verify` ni modifiques la configuración de git.
- Si un hook de pre-commit falla, corrige el problema y crea un commit **nuevo**; no lo omitas.

## Ejemplos

```
feat(auth): añade endpoint de registro de usuarios
fix(vendehumos): corrige el filtro por categoría en el listado
refactor(repositories): migra vendehumos de memoria a SQLite
docs: documenta las variables de entorno en CLAUDE.md
build: actualiza jsonwebtoken a la última versión
feat(auth)!: cambia el formato de respuesta del login

BREAKING CHANGE: el token ahora se devuelve en el campo `token` y no en `jwt`.
```
