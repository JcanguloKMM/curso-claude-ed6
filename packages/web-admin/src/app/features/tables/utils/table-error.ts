import type { HttpErrorResponse } from '@angular/common/http'

/**
 * Devuelve el mensaje en español que se muestra al usuario ante un error HTTP de mesas.
 *
 * - 400, 404 y 409 son errores de dominio (`{ error, message }`): se muestra el `message` de la API.
 * - 403 lo produce un middleware (`{ error }` en inglés, sin `message`): se muestra un texto propio.
 * - Cualquier otro caso (401, 5xx, red caída) usa el mensaje genérico `fallback`.
 */
export function getTableErrorMessage(err: unknown, fallback: string): string {
  const response = err as Partial<HttpErrorResponse> | null
  const status = response?.status

  if (status === 403) {
    return 'No tienes permisos para realizar esta acción.'
  }
  if (status === 400 || status === 404 || status === 409) {
    const message = response?.error?.message
    if (typeof message === 'string' && message.length > 0) return message
  }
  return fallback
}
