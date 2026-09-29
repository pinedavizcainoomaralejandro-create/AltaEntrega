"use client";

import { useEffect, useMemo, useState, useActionState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { useCart } from "@/lib/cart/CartContext";
import { createClient } from "@/lib/supabase/client";
import type { CatalogProduct } from "@/types/database";
import { checkoutAction, type CheckoutState } from "./actions";

const initialState: CheckoutState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full"
    >
      {pending ? "Reservando tu pedido..." : "Continuar al pago"}
    </button>
  );
}

export default function CarritoPage() {
  const cart = useCart();
  const [state, formAction] = useActionState(checkoutAction, initialState);
  const supabase = useMemo(() => createClient(), []);
  const [notices, setNotices] = useState<string[]>([]);
  const [deliveryFee, setDeliveryFee] = useState<number | null>(null);

  // Tarifa de delivery vigente (la define el admin).
  useEffect(() => {
    supabase.rpc("get_delivery_fee").then(({ data }) => {
      if (typeof data === "number") setDeliveryFee(data);
    });
  }, [supabase]);

  // El carrito guarda precio y stock del momento en que se agregó cada
  // producto. Al abrirlo (y tras un error de checkout) se comparan con la base
  // para que el total mostrado sea el que se va a cobrar.
  const productIdsKey = cart.items.map((i) => i.productId).sort().join(",");
  useEffect(() => {
    if (!cart.hydrated || !productIdsKey) return;
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("catalog_products")
        .select("id, nombre, precio, stock, activo")
        .in("id", productIdsKey.split(","));
      if (cancelled || !data) return;
      const changes = cart.syncProducts(data as CatalogProduct[]);
      if (changes.length > 0) setNotices(changes);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart.hydrated, productIdsKey, state?.error, supabase]);


  if (cart.items.length === 0) {
    return (
      <div>
        {notices.length > 0 && (
          <ul className="mb-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}
        <div className="card mx-auto flex max-w-lg flex-col items-center gap-3 px-6 py-12 text-center">
          <Image src="/images/boutique-percha.svg" alt="" width={220} height={160} unoptimized />
          <h1 className="font-display text-3xl font-semibold tracking-tight">Tu carrito está vacío</h1>
          <p className="text-sm text-stone-500">Date una vuelta por los negocios de Villa Altagracia.</p>
          <Link href="/" className="btn-primary mt-2">
            Explorar negocios
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card mx-auto max-w-lg p-6 sm:p-8">
      <h1 className="mb-1 font-display text-3xl font-semibold tracking-tight">Tu carrito</h1>
      <p className="mb-6 text-sm text-stone-500">{cart.storeNombre}</p>

      {notices.length > 0 && (
        <ul className="mb-6 flex flex-col gap-1 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          {notices.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <div className="mb-6 flex flex-col gap-3">
        {cart.items.map((item) => (
          <div key={item.productId} className="flex items-center gap-3 border-b border-stone-100 pb-3">
            <div className="flex-1">
              <p className="font-medium">{item.nombre}</p>
              <p className="text-sm text-stone-500">RD${item.precio.toFixed(2)} c/u</p>
            </div>
            <input
              type="number"
              min={1}
              max={item.stockDisponible}
              value={item.cantidad}
              onChange={(e) => cart.setQuantity(item.productId, Number(e.target.value))}
              className="input w-20 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => cart.removeItem(item.productId)}
              className="text-sm font-medium text-red-600 hover:underline"
            >
              Quitar
            </button>
          </div>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-1 text-sm">
        <div className="flex justify-between">
          <span>Productos</span>
          <span>RD${cart.total.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Delivery</span>
          <span>{deliveryFee === null ? "..." : `RD$${deliveryFee.toFixed(2)}`}</span>
        </div>
        <div className="mt-1 flex justify-between border-t border-stone-100 pt-2 text-lg font-medium">
          <span>Total</span>
          <span>RD${(cart.total + (deliveryFee ?? 0)).toFixed(2)}</span>
        </div>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="store_id" value={cart.storeId ?? ""} />
        <input
          type="hidden"
          name="items"
          value={JSON.stringify(cart.items.map((i) => ({ product_id: i.productId, cantidad: i.cantidad })))}
        />

        <div>
          <label htmlFor="direccion_entrega" className="label">
            Dirección de entrega
          </label>
          <textarea
            id="direccion_entrega"
            name="direccion_entrega" defaultValue={state.values?.direccion_entrega}
            required
            rows={2}
            className="input"
          />
        </div>

        <p className="text-xs text-stone-500">
          Pagas con tarjeta en el siguiente paso, en la página segura de AZUL.
        </p>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>
    </div>
  );
}
