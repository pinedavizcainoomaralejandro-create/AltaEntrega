import { describe, expect, it } from "vitest";
import { comprasPorMes, resumenCompras, type Compra } from "@/lib/purchaseHistory";

function compra(over: Partial<Compra>): Compra {
  return {
    id: crypto.randomUUID(),
    codigo: "AE-1",
    tienda_nombre: "Panadería",
    total: 100,
    estado_pago: "pagado",
    created_at: "2026-10-01T15:00:00Z",
    items: [],
    ...over,
  };
}

describe("resumenCompras", () => {
  it("suma el total, cuenta las compras y elige el negocio más frecuente", () => {
    const r = resumenCompras([
      compra({ tienda_nombre: "Cafetería", total: 250 }),
      compra({ tienda_nombre: "Panadería", total: 100 }),
      compra({ tienda_nombre: "Cafetería", total: 50.5 }),
    ]);
    expect(r).toEqual({ compras: 3, totalGastado: 400.5, favorita: { nombre: "Cafetería", compras: 2 } });
  });

  it("no cuenta los pedidos reembolsados", () => {
    const r = resumenCompras([compra({ total: 100 }), compra({ total: 999, estado_pago: "reembolsado" })]);
    expect(r.compras).toBe(1);
    expect(r.totalGastado).toBe(100);
  });

  it("sin compras no hay negocio favorito", () => {
    expect(resumenCompras([])).toEqual({ compras: 0, totalGastado: 0, favorita: null });
  });
});

describe("comprasPorMes", () => {
  it("agrupa por mes en hora de República Dominicana", () => {
    const grupos = comprasPorMes([
      compra({ created_at: "2026-10-01T15:00:00Z" }),
      // 1 de octubre a las 00:30 UTC sigue siendo 30 de septiembre en RD.
      compra({ created_at: "2026-10-01T00:30:00Z" }),
      compra({ created_at: "2026-09-10T12:00:00Z" }),
    ]);
    expect(grupos.map((g) => [g.mes, g.compras.length])).toEqual([
      ["Octubre de 2026", 1],
      ["Septiembre de 2026", 2],
    ]);
  });
});
