/**
 * Normaliza mensajes de error para que el usuario nunca vea texto técnico en inglés.
 *
 * Distingue entre:
 *  - Mensajes de NEGOCIO intencionales (lanzados con propósito, ej. ValidationError,
 *    ConflictError, mensajes legibles en español) → se preservan tal cual para que la
 *    UI pueda mostrarlos.
 *  - Mensajes TÉCNICOS de runtime (ReferenceError, TypeError, CastError, MongoServerError,
 *    errors de validación de mongoose, duplicados E11000, "undefined", etc.) → se
 *    reemplazan por un mensaje amigable en español.
 *
 * Uso en cliente (api-client) y en servidor (route handlers).
 */

const DEFAULT_FRIENDLY = 'Ups, algo salió mal. Estamos revisando el problema. Intente de nuevo en unos momentos.';

/** Patrones que delatan un error técnico de runtime (inglés crudo). */
const TECHNICAL_PATTERNS: RegExp[] = [
  /ReferenceError/i,
  /TypeError/i,
  /RangeError/i,
  /SyntaxError/i,
  /EvalError/i,
  /URIError/i,
  /internal server error/i,
  /is not defined/i,
  /cannot read propert/i,
  /cannot read properties? of/i,
  /is not a function/i,
  /cannot find module/i,
  /invalid cursor format/i,
  /cast to (objectid|number|date|string|boolean)/i,
  /CastError/i,
  /MongoServerError/i,
  /MongoError/i,
  /duplicate key/i,
  /E11000/i,
  /validation failed/i,
  /path .* is required/i,
  /strictmodeerror/i,
  /missing required/i,
  /Argument of type/i,
  /TS\d+/,
];

/** Mensajes de negocio técnicamente en inglés PERO que la UI sí debe mostrar. */
const PRESERVED_ENGLISH: RegExp[] = [
  /workorder was modified by another user/i,
  /scheduling conflict detected/i,
  /checklist already exists/i,
  /version conflict/i,
  /already exists/i,
  /already (in|on|assigned|registered)/i,
  /not found/i,
  /unauthorized/i,
  /forbidden/i,
  /invalid credentials/i,
  /no (se|te|pu)de|no available/i,
];

export function isTechnicalMessage(message: string): boolean {
  if (!message || !message.trim()) return true;
  // Si matchea un patrón de mensaje de negocio a preservar, no es técnico.
  for (const p of PRESERVED_ENGLISH) {
    if (p.test(message)) return false;
  }
  for (const p of TECHNICAL_PATTERNS) {
    if (p.test(message)) return true;
  }
  return false;
}

/**
 * Devuelve el mensaje a mostrar al usuario.
 * - Mensajes de negocio legibles → se devuelven tal cual.
 * - Mensajes técnicos (o vacíos) → se devuelve el mensaje amigable por defecto.
 */
export function toUserFriendlyMessage(message: string | undefined | null, fallback: string = DEFAULT_FRIENDLY): string {
  const safe = (message || '').trim();
  if (isTechnicalMessage(safe)) return fallback;
  return safe || fallback;
}

/** Forma el mensaje de error de una excepción, enmascarando los técnicos. */
export function errorMessage(error: unknown, fallback: string = DEFAULT_FRIENDLY): string {
  if (error instanceof Error) {
    return toUserFriendlyMessage(error.message, fallback);
  }
  if (typeof error === 'string') {
    return toUserFriendlyMessage(error, fallback);
  }
  return fallback;
}