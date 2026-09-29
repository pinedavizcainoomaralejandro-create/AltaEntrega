"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPaymentMode, toCentavos } from "@/lib/payments/azul";
import { recordApprovedPayment, recordFailedPayment } from "@/lib/payments/record";

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
