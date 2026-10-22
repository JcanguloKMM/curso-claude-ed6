/**
 * Extrae el mensaje de un error HTTP de la API.
 * Los errores de dominio vienen como `{ error, message }` y los de los
 * middlewares (401/403) solo como `{ error }`, sin `message`.
 */
export function leerMensajeError(err: any, porDefecto: string): string {
  return err?.error?.message ?? err?.error?.error ?? porDefecto;
}
