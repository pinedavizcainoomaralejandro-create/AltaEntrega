import type { CartItem, CartState } from "./CartContext";

export const EMPTY_CART: CartState = { storeId: null, storeNombre: null, items: [] };

/** Datos actuales de un producto, leídos de la base para actualizar el carrito guardado. */
export interface FreshProduct {
  id: string;
  nombre: string;
  precio: number;
  stock: number;
  activo: boolean;
}

/**
 * Compara el carrito con los datos actuales de la base y devuelve el carrito
 * corregido más un aviso por cada cambio (precio, stock o producto retirado).
 * Es puro para poder probarlo sin React.
 */
export function reconcileCart(cart: CartState, fresh: FreshProduct[]): { cart: CartState; notices: string[] } {
  const byId = new Map(fresh.map((p) => [p.id, p] as const));
  const notices: string[] = [];
  const items: CartItem[] = [];

  for (const item of cart.items) {
    const p = byId.get(item.productId);
    if (!p || !p.activo) {
      notices.push(`"${item.nombre}" ya no está disponible y se quitó del carrito.`);
      continue;
    }
    if (p.stock <= 0) {
      notices.push(`"${p.nombre}" se agotó y se quitó del carrito.`);
      continue;
    }

    let cantidad = item.cantidad;
    if (cantidad > p.stock) {
      cantidad = p.stock;
      notices.push(`Solo quedan ${p.stock} de "${p.nombre}"; ajustamos la cantidad.`);
    }
    if (p.precio !== item.precio) {
      notices.push(`El precio de "${p.nombre}" cambió de RD$${item.precio.toFixed(2)} a RD$${p.precio.toFixed(2)}.`);
    }

    items.push({ ...item, nombre: p.nombre, precio: p.precio, stockDisponible: p.stock, cantidad });
  }

  return {
    cart: items.length === 0 ? EMPTY_CART : { ...cart, items },
    notices,
  };
}
