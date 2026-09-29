import { describe, expect, it } from "vitest";
import { reconcileCart, type FreshProduct } from "@/lib/cart/reconcile";

const cart = {
  storeId: "s1",
  storeNombre: "Boutique",
  items: [
    { productId: "p1", nombre: "Blusa", precio: 10, foto: null, stockDisponible: 5, cantidad: 2 },
    { productId: "p2", nombre: "Falda", precio: 20, foto: null, stockDisponible: 5, cantidad: 4 },
  ],
};

const fresh = (overrides: Partial<Record<string, Partial<FreshProduct>>> = {}): FreshProduct[] => [
  { id: "p1", nombre: "Blusa", precio: 10, stock: 5, activo: true, ...overrides.p1 },
  { id: "p2", nombre: "Falda", precio: 20, stock: 5, activo: true, ...overrides.p2 },
];

describe("reconcileCart", () => {
  it("no cambia nada si los datos coinciden", () => {
    const result = reconcileCart(cart, fresh());
    expect(result.notices).toEqual([]);
    expect(result.cart.items).toHaveLength(2);
  });

  it("actualiza el precio y avisa", () => {
    const result = reconcileCart(cart, fresh({ p1: { precio: 12 } }));
    expect(result.cart.items[0].precio).toBe(12);
    expect(result.notices[0]).toMatch(/RD\$10.00 a RD\$12.00/);
  });

  it("ajusta la cantidad al stock disponible", () => {
    const result = reconcileCart(cart, fresh({ p2: { stock: 3 } }));
    expect(result.cart.items[1].cantidad).toBe(3);
    expect(result.notices[0]).toMatch(/Solo quedan 3/);
  });

  it("quita productos agotados, ocultos o borrados", () => {
    expect(reconcileCart(cart, fresh({ p1: { stock: 0 } })).cart.items.map((i) => i.productId)).toEqual(["p2"]);
    expect(reconcileCart(cart, fresh({ p1: { activo: false } })).cart.items.map((i) => i.productId)).toEqual(["p2"]);
    expect(reconcileCart(cart, fresh().slice(1)).cart.items.map((i) => i.productId)).toEqual(["p2"]);
  });

  it("vacía el carrito si no queda ningún producto", () => {
    const result = reconcileCart(cart, []);
    expect(result.cart).toEqual({ storeId: null, storeNombre: null, items: [] });
    expect(result.notices).toHaveLength(2);
  });
});
