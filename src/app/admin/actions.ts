"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
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

/**
 * Marca como pagados a la tienda o al repartidor los pedidos que se mostraron
 * en pantalla (sus ids vienen en el formulario, para no incluir pedidos que se
 * entregaron después de cargar la página).
 */
export async function markPayoutAction(
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const tipo = formData.get("tipo");
  let orderIds: string[];
  try {
    orderIds = JSON.parse(String(formData.get("orderIds") ?? "[]"));
  } catch {
    return { error: "Solicitud inválida." };
  }
  if ((tipo !== "tienda" && tipo !== "courier") || !Array.isArray(orderIds) || orderIds.length === 0) {
    return { error: "Solicitud inválida." };
  }

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } =
    tipo === "tienda"
      ? await supabase
          .from("order_settlements")
          .update({ tienda_pagado_at: now })
          .in("order_id", orderIds)
          .is("tienda_pagado_at", null)
      : await supabase
          .from("order_settlements")
          .update({ courier_pagado_at: now })
          .in("order_id", orderIds)
          .is("courier_pagado_at", null);
  if (error) return { error: friendlyDbError(error, "No se pudo registrar el pago.") };

  revalidatePath("/admin");
  return { error: null };
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
