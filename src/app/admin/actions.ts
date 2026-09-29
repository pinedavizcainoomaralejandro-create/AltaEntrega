"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { parseBankAccount } from "@/lib/bankAccount";
import { attachValues } from "@/lib/formValues";
import type { ApprovalStatus } from "@/types/database";

function parseEstado(formData: FormData): ApprovalStatus | null {
  const estado = String(formData.get("estado") ?? "");
  return estado === "aprobado" || estado === "rechazado" ? estado : null;
}

// La RLS ya exige rol=admin para poder cambiar "estado" en stores/couriers
// (el middleware además bloquea /admin a cualquier otro rol); estas acciones
// solo hacen la escritura y refrescan la página.

export type ApprovalState = { error: string | null };

export async function setStoreStatusAction(
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const id = String(formData.get("id") ?? "");
  const estado = parseEstado(formData);
  if (!id || !estado) return { error: "Solicitud inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("stores").update({ estado }).eq("id", id);
  if (error) return { error: "No se pudo actualizar la tienda. Inténtalo de nuevo." };

  revalidatePath("/admin");
  return { error: null };
}

export async function setCourierStatusAction(
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const id = String(formData.get("id") ?? "");
  const estado = parseEstado(formData);
  if (!id || !estado) return { error: "Solicitud inválida." };

  const supabase = await createClient();
  const { error } = await supabase.from("couriers").update({ estado }).eq("id", id);
  if (error) return { error: "No se pudo actualizar al repartidor. Inténtalo de nuevo." };

  revalidatePath("/admin");
  return { error: null };
}

export async function cancelOrderAction(
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Pedido inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: id });
  if (error) return { error: friendlyDbError(error, "No se pudo cancelar el pedido.") };

  revalidatePath("/admin");
  return { error: null };
}

/**
 * Guarda comisión y tarifa de delivery. El formulario se renderiza en el
 * servidor (sin JavaScript de cliente) para que nada sobre la comisión quede
 * en los archivos públicos de la app; el resultado vuelve como ?config=.
 */
export async function savePlatformSettingsAction(formData: FormData) {
  const comisionPct = Number(formData.get("comision"));
  const delivery = Number(formData.get("delivery"));

  if (!Number.isFinite(comisionPct) || comisionPct < 0 || comisionPct >= 50) {
    redirect("/admin?config=comision_invalida");
  }
  if (!Number.isFinite(delivery) || delivery < 0 || delivery > 10_000) {
    redirect("/admin?config=delivery_invalido");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({ commission_rate: Math.round(comisionPct * 100) / 10_000, delivery_fee: Math.round(delivery * 100) / 100 })
    .eq("id", true);

  revalidatePath("/admin");
  redirect(error ? "/admin?config=error" : "/admin?config=ok");
}

/** El admin registra que hizo una transferencia (modo manual del conector). */
export async function completePayoutAction(
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const id = String(formData.get("id") ?? "");
  const referencia = String(formData.get("referencia") ?? "").trim();
  if (!id) return { error: "Transferencia inválida." };
  if (!referencia) return { error: "Escribe la referencia o número de la transferencia." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_payout", {
    p_payout_id: id,
    p_estado: "completado",
    p_referencia: referencia,
  });
  if (error) return { error: friendlyDbError(error, "No se pudo registrar la transferencia.") };

  revalidatePath("/admin");
  return { error: null };
}

/** Cuenta bancaria donde el fundador recibe las ganancias de la plataforma. */
export async function saveGananciasAccountAction(
  _prevState: ApprovalState & { saved?: boolean; values?: Record<string, string> },
  formData: FormData
): Promise<ApprovalState & { saved?: boolean; values?: Record<string, string> }> {
  const parsed = parseBankAccount(formData);
  if (!parsed.ok) return attachValues({ error: parsed.error }, formData, ["banco", "tipo_cuenta", "numero_cuenta", "titular", "documento"]);

  const c = parsed.cuenta;
  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      ganancias_banco: c.banco,
      ganancias_tipo_cuenta: c.tipo_cuenta,
      ganancias_numero_cuenta: c.numero_cuenta,
      ganancias_titular: c.titular,
      ganancias_documento: c.documento,
    })
    .eq("id", true);
  if (error) return { error: friendlyDbError(error, "No se pudo guardar la cuenta.") };

  revalidatePath("/admin");
  return { error: null, saved: true };
}

export async function markRefundedAction(
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Pedido inválido." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_refunded", { p_order_id: id });
  if (error) return { error: friendlyDbError(error, "No se pudo marcar el reembolso.") };

  revalidatePath("/admin");
  return { error: null };
}
