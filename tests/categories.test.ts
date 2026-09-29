import { describe, expect, it } from "vitest";
import { categoriasQueCoinciden, etiquetasVariante, getCategoria } from "@/lib/categories";

describe("categoriasQueCoinciden", () => {
  it("encuentra la categoría por nombre, plural o palabra relacionada, sin tildes", () => {
    expect(categoriasQueCoinciden("cafe")).toEqual(["cafeteria"]);
    expect(categoriasQueCoinciden("Café")).toEqual(["cafeteria"]);
    expect(categoriasQueCoinciden("ropa")).toEqual(["boutique"]);
    expect(categoriasQueCoinciden("bizcocho")).toEqual(["reposteria"]);
    expect(categoriasQueCoinciden("empanadas")).toEqual(["empanadas"]);
  });

  it("'pan' encuentra panaderías pero no empanadas", () => {
    expect(categoriasQueCoinciden("pan")).toEqual(["panaderia"]);
  });

  it("ignora búsquedas muy cortas", () => {
    expect(categoriasQueCoinciden("pa")).toEqual([]);
  });
});

describe("etiquetasVariante", () => {
  it("usa talla y color en boutiques y tamaño y sabor en comida", () => {
    expect(etiquetasVariante("boutique").talla).toBe("Talla");
    expect(etiquetasVariante("empanadas").color).toBe("Sabor o variedad");
    expect(getCategoria("reposteria")?.comida).toBe(true);
  });
});
