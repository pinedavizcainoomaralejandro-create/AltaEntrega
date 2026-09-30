import { describe, expect, it } from "vitest";
import { estadoSuscripcion, mensajeSuscripcion } from "@/lib/subscription";

const ahora = new Date("2026-10-01T12:00:00Z");
const enDias = (d: number) => new Date(ahora.getTime() + d * 86_400_000).toISOString();

describe("estadoSuscripcion", () => {
  it("prueba gratis con los días que quedan", () => {
    expect(estadoSuscripcion({ plan: "prueba", vigente_hasta: enDias(12) }, 5, ahora)).toEqual({ estado: "prueba", dias: 12 });
  });

  it("al día, y por vencer en la última semana", () => {
    expect(estadoSuscripcion({ plan: "mensual", vigente_hasta: enDias(20) }, 5, ahora).estado).toBe("activa");
    expect(estadoSuscripcion({ plan: "anual", vigente_hasta: enDias(3) }, 5, ahora)).toEqual({ estado: "por_vencer", dias: 3 });
  });

  it("vencida: 5 días de gracia y luego pausa", () => {
    expect(estadoSuscripcion({ plan: "mensual", vigente_hasta: enDias(-2) }, 5, ahora)).toEqual({ estado: "gracia", dias: 3 });
    expect(estadoSuscripcion({ plan: "mensual", vigente_hasta: enDias(-6) }, 5, ahora).estado).toBe("pausada");
  });
});

describe("mensajeSuscripcion", () => {
  it("explica la consecuencia según el tipo de cuenta", () => {
    expect(mensajeSuscripcion({ estado: "gracia", dias: 3 }, "tienda")).toMatch(/dejará de salir en el catálogo/);
    expect(mensajeSuscripcion({ estado: "pausada", dias: 0 }, "courier")).toMatch(/no puedes aceptar entregas/);
  });
});
