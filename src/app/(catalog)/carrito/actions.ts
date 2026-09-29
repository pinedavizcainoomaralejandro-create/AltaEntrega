"use server";

import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import type { PaymentMethod } from "@/types/database";

export type CheckoutState = { error: string | null; orderId?: string };

const PAYMENT_METHODS: PaymentMethod[] = ["efectivo", "tarjeta", "transferencia"];

export async function checkoutAction(
  _prevState: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const storeId = String(formData.get("store_id") ?? "");
  const direccion_entrega = String(formData.get("direccion_entrega") ?? "").trim();
  const metodo_pago = String(formData.get("metodo_pago") ?? "") as PaymentMethod;
  const itemsRaw = String(formData.get("items") ?? "[]");

  if (!storeId) return { error: "Tu carrito está vacío." };
  if (!direccion_entrega) return { error: "Ingresa la dirección de entrega." };
  if (!PAYMENT_METHODS.includes(metodo_pago)) return { error: "Selecciona un método de pago." };

  let items: { product_id: string; cantidad: number }[];
  try {
    items = JSON.parse(itemsRaw);
  } catch {
    return { error: "El carrito no es válido." };
  }
  if (!Array.isArray(items) || items.length === 0) {
    return { error: "Tu carrito está vacío." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Inicia sesión como cliente para completar tu pedido." };

  const { data, error } = await supabase.rpc("checkout", {
    p_store_id: storeId,
    p_direccion_entrega: direccion_entrega,
    p_metodo_pago: metodo_pago,
    p_items: items,
  });

  if (error) return { error: friendlyDbError(error, "No se pudo completar tu pedido. Inténtalo de nuevo.") };

  return { error: null, orderId: data };
}
