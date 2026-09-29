import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchPayouts } from "./payouts";

/**
 * Registra un pago aprobado (solo el monto de los productos; el delivery se
 * paga en efectivo). Devuelve "pagado" o "reembolso_pendiente" si el pedido
 * ya había expirado.
 */
export async function recordApprovedPayment(params: {
  orderId: string;
  amountCentavos: number;
  authorizationCode: string;
  reference: string;
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("confirm_payment", {
    p_order_id: params.orderId,
    p_monto_centavos: params.amountCentavos,
    p_autorizacion: params.authorizationCode,
    p_referencia: params.reference,
  });
  if (error) throw error;

  // En el mismo momento del cobro: transferencias al negocio y a ganancias.
  if (data === "pagado") await dispatchPayouts(params.orderId);
  return data;
}

/** Pago rechazado o cancelado: el pedido se cancela y el stock vuelve. */
export async function recordFailedPayment(orderId: string) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("fail_payment", { p_order_id: orderId, p_estado_pago: "rechazado" });
  if (error) throw error;
}
