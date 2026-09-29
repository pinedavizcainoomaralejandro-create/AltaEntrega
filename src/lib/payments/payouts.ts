import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Conector de transferencias. Cuando se aprueba un cobro, la base crea dos
 * transferencias (payouts): al dueño del negocio por su precio publicado y a
 * la cuenta de ganancias del fundador por la comisión. Este módulo decide
 * quién las ejecuta.
 *
 * PAYOUTS_PROVIDER:
 *   - "manual" (por defecto): quedan pendientes en /admin con el monto y la
 *     cuenta exacta; el fundador transfiere desde su banco y las marca.
 *   - Cuando AZUL (pagos divididos) o un banco den una API de transferencias,
 *     se agrega aquí un proveedor que las envíe solas en el mismo momento del
 *     cobro y reporte el resultado con update_payout.
 */

type PayoutRow = {
  id: string;
  destino: string;
  monto: number;
  cuenta: unknown;
};

interface PayoutProvider {
  nombre: string;
  /** Envía la transferencia. Devuelve la referencia del banco o lanza un error. */
  enviar(payout: PayoutRow): Promise<{ referencia: string; completado: boolean }>;
}

function getProvider(): PayoutProvider | null {
  const provider = process.env.PAYOUTS_PROVIDER ?? "manual";
  if (provider === "manual") return null;
  // Aquí se conectará el proveedor real (por ejemplo "azul-split" o la API
  // de transferencias del banco) cuando esté disponible.
  throw new Error(`PAYOUTS_PROVIDER desconocido: "${provider}"`);
}

/**
 * Ejecuta las transferencias pendientes de un pedido recién cobrado. Nunca
 * hace fallar el cobro: si algo sale mal, la transferencia queda "fallida" y
 * el admin la ve para reintentarla o hacerla a mano.
 */
export async function dispatchPayouts(orderId: string) {
  let provider: PayoutProvider | null;
  try {
    provider = getProvider();
  } catch (error) {
    console.error("Transferencias:", error);
    return;
  }
  if (!provider) return; // modo manual

  const admin = createAdminClient();
  const { data: payouts } = await admin
    .from("payouts")
    .select("id, destino, monto, cuenta")
    .eq("order_id", orderId)
    .eq("estado", "pendiente");

  for (const payout of payouts ?? []) {
    if (!payout.cuenta) continue; // el negocio aún no registró su cuenta
    try {
      const { referencia, completado } = await provider.enviar(payout);
      await admin.rpc("update_payout", {
        p_payout_id: payout.id,
        p_estado: completado ? "completado" : "enviado",
        p_referencia: referencia,
      });
    } catch (error) {
      console.error("Transferencia fallida", payout.id, error);
      await admin.rpc("update_payout", {
        p_payout_id: payout.id,
        p_estado: "fallido",
        p_error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
