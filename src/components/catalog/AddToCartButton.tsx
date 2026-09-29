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
      <p className="text-center text-xs text-stone-500">Solo las cuentas de cliente pueden comprar.</p>
    );
  }

  if (disabled) {
    return (
      <button
        disabled
        className="btn btn-sm w-full border border-stone-200 bg-stone-50 text-stone-400"
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
      className="btn-primary btn-sm w-full"
    >
      {added ? "¡Agregado!" : "Agregar al carrito"}
    </button>
  );
}
