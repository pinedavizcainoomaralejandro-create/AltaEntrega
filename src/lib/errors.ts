/**
 * Traduce errores de Supabase a mensajes claros en español para el usuario.
 * El error original se registra en consola para poder depurarlo.
 */

type DbError = { code?: string; message: string };

/**
 * Errores de la base de datos (PostgREST / RPC). Las funciones SQL de la app
 * lanzan sus mensajes con RAISE EXCEPTION (código P0001) ya en español y
 * pensados para el usuario, así que esos se muestran tal cual.
 */
export function friendlyDbError(error: DbError, fallback = "Ocurrió un error. Inténtalo de nuevo."): string {
  console.error(error);

  switch (error.code) {
    case "P0001":
      return error.message;
    case "23505":
      return "Ya existe un registro con esos datos.";
    case "22003":
      return "Algún número es demasiado grande.";
    case "23514":
    case "22P02":
      return "Alguno de los datos no es válido. Revísalos e inténtalo de nuevo.";
    case "42501":
      return "No tienes permiso para realizar esta acción.";
  }

  if (/fetch|network/i.test(error.message)) {
    return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  }

  return fallback;
}

/** Errores de Supabase Auth (registro, login, cambio de contraseña). */
export function friendlyAuthError(error: DbError): string {
  console.error(error);

  switch (error.code) {
    case "user_already_exists":
    case "email_exists":
      return "Ya existe una cuenta con ese email. Inicia sesión o recupera tu contraseña.";
    case "weak_password":
      return "La contraseña es muy débil. Usa al menos 8 caracteres, con letras y números.";
    case "email_address_invalid":
      return "Ese email no es válido.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.";
    case "same_password":
      return "La nueva contraseña debe ser distinta de la anterior.";
    case "signup_disabled":
      return "El registro está deshabilitado temporalmente.";
  }

  if (/fetch|network/i.test(error.message)) {
    return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  }

  return "No se pudo completar la operación. Inténtalo de nuevo.";
}
