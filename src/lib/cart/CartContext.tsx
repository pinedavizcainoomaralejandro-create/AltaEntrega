"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { EMPTY_CART, reconcileCart, type FreshProduct } from "./reconcile";

export interface CartItem {
  productId: string;
  nombre: string;
  precio: number;
  foto: string | null;
  stockDisponible: number;
  cantidad: number;
}

export interface CartState {
  storeId: string | null;
  storeNombre: string | null;
  items: CartItem[];
}

const STORAGE_KEY = "altaentrega_cart";

interface CartContextValue extends CartState {
  addItem: (storeId: string, storeNombre: string, item: Omit<CartItem, "cantidad">, cantidad?: number) => void;
  removeItem: (productId: string) => void;
  setQuantity: (productId: string, cantidad: number) => void;
  clear: () => void;
  syncProducts: (fresh: FreshProduct[]) => string[];
  total: number;
  count: number;
  /** true cuando ya se leyó el carrito guardado en localStorage. */
  hydrated: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>(EMPTY_CART);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // Leer localStorage solo es posible en el navegador, después de hidratar;
      // por eso se carga en un efecto y no en el estado inicial.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setCart(JSON.parse(raw) as CartState);
    } catch {
      // localStorage no disponible o corrupto: seguimos con el carrito vacío.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // ignorar cuota excedida / storage deshabilitado
    }
  }, [cart, hydrated]);

  const addItem = useCallback<CartContextValue["addItem"]>((storeId, storeNombre, item, cantidad = 1) => {
    setCart((prev) => {
      if (prev.storeId && prev.storeId !== storeId) {
        const confirmed =
          typeof window !== "undefined" &&
          window.confirm(
            `Tu carrito tiene productos de "${prev.storeNombre}". El carrito solo puede tener productos de una tienda a la vez. ¿Vaciarlo y agregar productos de "${storeNombre}"?`
          );
        if (!confirmed) return prev;
        return { storeId, storeNombre, items: [{ ...item, cantidad: Math.min(cantidad, item.stockDisponible) }] };
      }

      const existing = prev.items.find((i) => i.productId === item.productId);
      const items = existing
        ? prev.items.map((i) =>
            i.productId === item.productId
              ? { ...i, cantidad: Math.min(i.cantidad + cantidad, item.stockDisponible) }
              : i
          )
        : [...prev.items, { ...item, cantidad: Math.min(cantidad, item.stockDisponible) }];

      return { storeId, storeNombre, items };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart((prev) => {
      const items = prev.items.filter((i) => i.productId !== productId);
      return items.length === 0 ? EMPTY_CART : { ...prev, items };
    });
  }, []);

  const setQuantity = useCallback((productId: string, cantidad: number) => {
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((i) =>
        i.productId === productId
          ? { ...i, cantidad: Math.max(1, Math.min(Math.round(cantidad) || 1, i.stockDisponible)) }
          : i
      ),
    }));
  }, []);

  const clear = useCallback(() => setCart(EMPTY_CART), []);

  const syncProducts = useCallback<CartContextValue["syncProducts"]>(
    (fresh) => {
      const result = reconcileCart(cart, fresh);
      if (result.notices.length > 0) setCart(result.cart);
      return result.notices;
    },
    [cart]
  );

  const { total, count } = useMemo(
    () => ({
      total: cart.items.reduce((sum, i) => sum + i.precio * i.cantidad, 0),
      count: cart.items.reduce((sum, i) => sum + i.cantidad, 0),
    }),
    [cart.items]
  );

  return (
    <CartContext.Provider value={{ ...cart, addItem, removeItem, setQuantity, clear, syncProducts, total, count, hydrated }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart debe usarse dentro de <CartProvider>");
  return ctx;
}
