/**
 * Fecha y hora en hora de República Dominicana. Sin timeZone explícito,
 * toLocaleString usa la zona del servidor (UTC en Vercel), que adelanta las
 * horas 4 horas y además no coincide con la del navegador al hidratar.
 */
export function formatFecha(value: string | Date) {
  return new Date(value).toLocaleString("es-DO", { timeZone: "America/Santo_Domingo" });
}
