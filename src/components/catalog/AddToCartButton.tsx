"use client";

import { useState } from "react";
import { useCart, type CartItem } from "@/lib/cart/CartContext";

export default function AddToCartButton({
  storeId,
  storeNombre,
  product,
  disabled,
}: {
  storeId: string;
  storeNombre: string;
  product: Omit<CartItem, "cantidad">;
  disabled?: boolean;
}) {
  const { addItem, canBuy } = useCart();
  const [added, setAdded] = useState(false);

  if (!canBuy) {
    return (
      <p className="text-center text-xs text-neutral-500">Solo las cuentas de cliente pueden comprar.</p>
    );
  }

  if (disabled) {
    return (
      <button
        disabled
        className="w-full rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-400"
      >
        Agotado
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        addItem(storeId, storeNombre, product, 1);
        setAdded(true);
        setTimeout(() => setAdded(false), 1200);
      }}
      className="w-full rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white"
    >
      {added ? "Agregado ✓" : "Agregar al carrito"}
    </button>
  );
}
