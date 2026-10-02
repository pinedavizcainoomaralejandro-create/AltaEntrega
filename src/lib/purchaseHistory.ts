/**
 * Historial de compras del cliente: resumen y agrupación por mes de los
 * pedidos entregados. Funciones puras para poder probarlas.
 */

export type Compra = {
  id: string;
  codigo: string;
  tienda_nombre: string;
  total: number;
  estado_pago: string;
  created_at: string;
  items: { nombre: string; cantidad: number; precio_unitario: number }[];
};

/** Un pedido reembolsado se muestra, pero no cuenta como gasto. */
export function esReembolsada(c: Pick<Compra, "estado_pago">) {
  return c.estado_pago === "reembolsado" || c.estado_pago === "reembolso_pendiente";
}

export function resumenCompras(compras: Compra[]) {
  const validas = compras.filter((c) => !esReembolsada(c));
  const totalGastado = validas.reduce((sum, c) => sum + c.total, 0);

  const porTienda = new Map<string, number>();
  for (const c of validas) porTienda.set(c.tienda_nombre, (porTienda.get(c.tienda_nombre) ?? 0) + 1);
  let favorita: { nombre: string; compras: number } | null = null;
  for (const [nombre, n] of porTienda) {
    if (!favorita || n > favorita.compras) favorita = { nombre, compras: n };
  }

  return { compras: validas.length, totalGastado, favorita };
}

const mesFormatter = new Intl.DateTimeFormat("es-DO", {
  month: "long",
  year: "numeric",
  timeZone: "America/Santo_Domingo",
});

/** Agrupa por mes (hora de RD), en el mismo orden en que llegan las compras. */
export function comprasPorMes(compras: Compra[]) {
  const grupos: { mes: string; compras: Compra[] }[] = [];
  for (const c of compras) {
    const label = mesFormatter.format(new Date(c.created_at));
    const mes = label.charAt(0).toUpperCase() + label.slice(1);
    const last = grupos[grupos.length - 1];
    if (last?.mes === mes) last.compras.push(c);
    else grupos.push({ mes, compras: [c] });
  }
  return grupos;
}
