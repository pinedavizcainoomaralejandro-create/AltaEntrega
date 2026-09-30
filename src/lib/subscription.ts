/** Estado de una suscripción según su vencimiento y los días de gracia. */
export type EstadoSuscripcion = "prueba" | "activa" | "por_vencer" | "gracia" | "pausada";

const DIA = 24 * 60 * 60 * 1000;

export function estadoSuscripcion(
  sub: { plan: string; vigente_hasta: string },
  diasGracia: number,
  ahora: Date = new Date()
): { estado: EstadoSuscripcion; dias: number } {
  const vence = new Date(sub.vigente_hasta).getTime();
  const restante = vence - ahora.getTime();

  if (restante >= 0) {
    const dias = Math.ceil(restante / DIA);
    if (sub.plan === "prueba") return { estado: "prueba", dias };
    return { estado: dias <= 7 ? "por_vencer" : "activa", dias };
  }

  const finGracia = vence + diasGracia * DIA;
  if (ahora.getTime() <= finGracia) {
    return { estado: "gracia", dias: Math.ceil((finGracia - ahora.getTime()) / DIA) };
  }
  return { estado: "pausada", dias: 0 };
}

/** Texto para el aviso del panel. `quien` es "tu negocio" o "tu cuenta". */
export function mensajeSuscripcion(e: { estado: EstadoSuscripcion; dias: number }, tipo: "tienda" | "courier") {
  const consecuencia =
    tipo === "tienda" ? "tu negocio dejará de salir en el catálogo" : "no podrás aceptar entregas";
  switch (e.estado) {
    case "prueba":
      return `Prueba gratis: te quedan ${e.dias} día${e.dias === 1 ? "" : "s"}.`;
    case "activa":
      return `Suscripción al día: vence en ${e.dias} días.`;
    case "por_vencer":
      return `Tu suscripción vence en ${e.dias} día${e.dias === 1 ? "" : "s"}. Renueva para no interrumpir el servicio.`;
    case "gracia":
      return `Tu suscripción venció. Si no pagas en ${e.dias} día${e.dias === 1 ? "" : "s"}, ${consecuencia}.`;
    case "pausada":
      return tipo === "tienda"
        ? "Tu suscripción está vencida: tu negocio no aparece en el catálogo hasta que pagues."
        : "Tu suscripción está vencida: no puedes aceptar entregas hasta que pagues.";
  }
}
