import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Fase de cobro de la plataforma:
 *   - "suscripciones" (fase 1): el cliente transfiere al negocio; negocios y
 *     repartidores pagan una suscripción; sin comisión.
 *   - "azul" (fase 2): pago con tarjeta por AZUL, comisión y reparto al cobrar.
 */
export type Fase = "suscripciones" | "azul";

export type PublicConfig = { fase: Fase; delivery_fee: number; horas_para_transferir: number };

export async function getPublicConfig(supabase: SupabaseClient<Database>): Promise<PublicConfig> {
  const { data } = await supabase.rpc("get_public_config");
  const c = (data ?? {}) as Partial<PublicConfig>;
  return {
    fase: c.fase === "azul" ? "azul" : "suscripciones",
    delivery_fee: Number(c.delivery_fee ?? 0),
    horas_para_transferir: Number(c.horas_para_transferir ?? 12),
  };
}
