"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { useCart } from "@/lib/cart/CartContext";
import { checkoutAction, type CheckoutState } from "./actions";

const initialState: CheckoutState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Procesando..." : "Confirmar pedido"}
    </button>
  );
}

export default function CarritoPage() {
  const cart = useCart();
  const [state, formAction] = useFormState(checkoutAction, initialState);

  useEffect(() => {
    if (state?.orderId) cart.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.orderId]);

  if (state?.orderId) {
    return (
      <div className="mx-auto max-w-md text-center">
        <h1 className="mb-2 text-2xl font-semibold">¡Pedido creado!</h1>
        <p className="mb-1 text-neutral-500">Tu pedido fue enviado a la tienda.</p>
        <p className="mb-6 text-sm text-neutral-400">Referencia: {state.orderId}</p>
        <Link href="/" className="inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm text-white">
          Volver al catálogo
        </Link>
      </div>
    );
  }

  if (cart.items.length === 0) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Tu carrito está vacío</h1>
        <Link href="/" className="underline">
          Explorar tiendas
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-1 text-2xl font-semibold">Tu carrito</h1>
      <p className="mb-6 text-sm text-neutral-500">{cart.storeNombre}</p>

      <div className="mb-6 flex flex-col gap-3">
        {cart.items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 border-b border-neutral-100 pb-3">
            <div className="flex-1">
              <p className="font-medium">{item.nombre}</p>
              <p className="text-sm text-neutral-500">RD${item.precio.toFixed(2)} c/u</p>
            </div>
            <input
              type="number"
              min={1}
              max={item.stockDisponible}
              value={item.cantidad}
              onChange={(e) => cart.setQuantity(item.productId, Number(e.target.value))}
              className="w-16 rounded-md border border-neutral-300 px-2 py-1 text-sm"
            />
            <button
              type="button"
              onClick={() => cart.removeItem(item.productId)}
              className="text-sm text-red-600 underline"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <p className="mb-6 text-right text-lg font-medium">Total: RD${cart.total.toFixed(2)}</p>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="store_id" value={cart.storeId ?? ""} />
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(cart.items.map((i) => ({ product_id: i.productId, cantidad: i.cantidad })))}
        />

        <div>
          <label htmlFor="direccion_entrega" className="mb-1 block text-sm font-medium">
            Dirección de entrega
          </label>
          <textarea
            id="direccion_entrega"
            name="direccion_entrega"
            required
            rows={2}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="metodo_pago" className="mb-1 block text-sm font-medium">
            Método de pago
          </label>
          <select
            id="metodo_pago"
            name="metodo_pago"
            required
            defaultValue="efectivo"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          >
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="transferencia">Transferencia</option>
          </select>
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>
    </div>
  );
}
