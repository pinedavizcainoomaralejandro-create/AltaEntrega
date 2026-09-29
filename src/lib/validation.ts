/**
 * Validaciones y normalizaciones compartidas por las server actions.
 * Viven fuera de los archivos "use server" para poder probarlas.
 */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Teléfono dominicano: 10 dígitos que empiezan por 809/829/849, con o sin +1. Devuelve "8095551234" o null. */
export function normalizeTelefono(raw: string) {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  return /^(809|829|849)\d{7}$/.test(digits) ? digits : null;
}

/** Mínimo 8 caracteres con letras y números; máximo 72 (límite de bcrypt en Supabase Auth). */
export function validatePassword(password: string) {
  if (password.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (password.length > 72) return "La contraseña no puede tener más de 72 caracteres.";
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return "La contraseña debe incluir letras y números.";
  }
  return null;
}

// Cédula dominicana: 11 dígitos, con o sin guiones (000-0000000-0).
export function normalizeCedula(raw: string) {
  return raw.replace(/\D/g, "");
}

export function normalizeMatricula(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function isValidMatricula(matricula: string) {
  return /^[A-Z0-9-]{5,10}$/.test(matricula);
}

/**
 * Solo rutas internas para redirigir después de un enlace de correo: un valor
 * como "@evil.com" o "//evil.com" convertiría el callback en una redirección
 * abierta.
 */
export function safeNextPath(raw: string | null) {
  const next = raw ?? "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

/** Escapa % y _ para que un patrón ilike trate el texto del usuario literalmente. */
export function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, "\\$&");
}

/** Valor entre comillas para filtros .or() de PostgREST (las comas y paréntesis rompen la sintaxis). */
export function quotePostgrestValue(value: string) {
  return `"${value.replace(/["\\]/g, "\\$&")}"`;
}
