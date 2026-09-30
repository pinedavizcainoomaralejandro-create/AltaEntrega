"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPaymentMode, toCentavos } from "@/lib/payments/azul";
import { recordApprovedPayment, recordFailedPayment } from "@/lib/payments/record";
import { uploadComprobante, validateComprobante } from "@/lib/supabase/comprobantes";
import { friendlyDbError } from "@/lib/errors";

/**
 * Pago simulado (solo con AZUL_MODE=simulado, deshabilitado en producción):
 * permite probar el flujo completo sin credenciales de AZUL.
 */
export async function simulatePaymentAction(formData: FormData) {
  if (getPaymentMode() !== "simulado") throw new Error("El pago simulado no está habilitado.");

  const orderId = String(formData.get("orderId") ?? "");
  const aprobado = formData.get("resultado") === "aprobado";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: order } = await supabase
    .from("orders")
    .select("id, subtotal, estado")
    .eq("id", orderId)
    .eq("cliente_id", user.id)
    .maybeSingle();
  if (!order || order.estado !== "esperando_pago") redirect(`/pedidos/${orderId}`);

  if (aprobado) {
    await recordApprovedPayment({
      orderId,
      amountCentavos: Number(toCentavos(order.subtotal)),
      authorizationCode: "SIMULADO",
      reference: `SIM-${Date.now()}`,
    });
    redirect(`/pedidos/${orderId}?pago=aprobado`);
  }

  await recordFailedPayment(orderId);
  redirect(`/pedidos/${orderId}?pago=rechazado`);
}

export type TransferProofState = { error: string | null };

/** Fase 1: el cliente sube el comprobante de su transferencia al negocio. */
export async function submitOrderTransferAction(_prev: TransferProofState, formData: FormData): Promise<TransferProofState> {
  const orderId = String(formData.get("orderId") ?? "");
  const referencia = String(formData.get("referencia") ?? "").trim();
  const file = formData.get("comprobante");

  if (!referencia) return { error: "Escribe la referencia o número de tu transferencia." };
  const invalid = validateComprobante(file);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let path: string;
  try {
    path = await uploadComprobante(supabase, `pedidos/${orderId}`, file as File);
  } catch {
    return { error: "No se pudo subir el comprobante. Inténtalo de nuevo." };
  }

  const { error } = await supabase.rpc("submit_order_transfer", {
    p_order_id: orderId,
    p_referencia: referencia,
    p_comprobante_path: path,
  });
  if (error) return { error: friendlyDbError(error, "No se pudo enviar el comprobante.") };

  redirect(`/pedidos/${orderId}?pago=comprobante`);
}
