/**
 * React 19 vacía los campos de un <form action={...}> cuando la acción
 * termina, aunque haya devuelto un error. attachValues devuelve, junto con el
 * error, lo que el usuario escribió en los campos indicados; el formulario los
 * usa como defaultValue y así no hay que volver a escribirlos.
 * Nunca incluir contraseñas.
 */
export type FormValues = { values?: Record<string, string> };

export function attachValues<S extends { error: string | null }>(
  result: S,
  formData: FormData,
  fields: string[]
): S & FormValues {
  if (!result.error) return result;

  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return { ...result, values };
}
