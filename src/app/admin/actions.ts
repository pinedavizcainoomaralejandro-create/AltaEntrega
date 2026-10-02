"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { parseBankAccount } from "@/lib/bankAccount";
import { attachValues } from "@/lib/formValues";
import { notifySolicitante } from "@/lib/email";
import type { ApprovalStatus } from "@/types/database";

function parseEstado(formData: FormData): ApprovalStatus | null {
  const estado = String(formData.get("estado") ?? "");
  return estado === "aprobado" || estado === "rechazado" ? estado : null;
}

// La RLS ya exige rol=admin para poder cambiar "estado" en stores/couriers
// (el middleware además bloquea /admin a cualquier otro rol); estas acciones
// hacen la escritura, avisan por correo al solicitante y refrescan la página.
// Solo cambian solicitudes pendientes: un doble clic no manda dos correos.

async function avisarSolicitante(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string | null,
  tipo: "tienda" | "courier",
  estado: ApprovalStatus
) {
  if (!userId) return;
  const { data: user } = await supabase.from("users").select("email, nombre").eq("id", userId).maybeSingle();
  if (!user) return;
  await notifySolicitante({ tipo, email: user.email, nombre: user.nombre, aprobada: estado === "aprobado" });
}

export type ApprovalState = { error: string | null };

export async function setStoreStatusAction(
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const id = String(formData.get("id") ?? "");
  const estado = parseEstado(formData);
  if (!id || !estado) return { error: "Solicitud inválida." };

  const supabase = await createClient();
  const { data: store, error } = await supabase
    .from("stores")
    .update({ estado })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("user_id")
    .maybeSingle();
  if (error) return { error: "No se pudo actualizar la tienda. Inténtalo de nuevo." };
  if (!store) {
    revalidatePath("/admin");
    return { error: "Esta solicitud ya fue revisada." };
  }

  await avisarSolicitante(supabase, store.user_id, "tienda", estado);

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
  const { data: courier, error } = await supabase
    .from("couriers")
    .update({ estado })
    .eq("id", id)
    .eq("estado", "pendiente")
    .select("user_id")
    .maybeSingle();
  if (error) return { error: "No se pudo actualizar al repartidor. Inténtalo de nuevo." };
  if (!courier) {
    revalidatePath("/admin");
    return { error: "Esta solicitud ya fue revisada." };
  }

  await avisarSolicitante(supabase, courier.user_id, "courier", estado);

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
  const num = (k: string) => Number(formData.get(k));
  const fase = formData.get("fase");
  const comisionPct = num("comision");
  const delivery = num("delivery");
  const negocio = num("precio_negocio");
  const repartidor = num("precio_delivery");
  const descuentoPct = num("descuento");
  const prueba = num("dias_prueba");
  const gracia = num("dias_gracia");
  const horas = num("horas_transferir");

  const entero = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;
  const monto = (n: number) => Number.isFinite(n) && n >= 0 && n <= 1_000_000;

  if (fase !== "suscripciones" && fase !== "azul") redirect("/admin?config=error");
  if (!Number.isFinite(comisionPct) || comisionPct < 0 || comisionPct >= 50) redirect("/admin?config=comision_invalida");
  if (!Number.isFinite(delivery) || delivery < 0 || delivery > 10_000) redirect("/admin?config=delivery_invalido");
  if (!monto(negocio) || !monto(repartidor)) redirect("/admin?config=precio_invalido");
  if (!Number.isFinite(descuentoPct) || descuentoPct < 0 || descuentoPct >= 90) redirect("/admin?config=descuento_invalido");
  if (!entero(prueba, 0, 365) || !entero(gracia, 0, 60) || !entero(horas, 1, 168)) redirect("/admin?config=dias_invalidos");

  const supabase = await createClient();
  const { error } = await supabase
    .from("platform_settings")
    .update({
      fase,
      commission_rate: Math.round(comisionPct * 100) / 10_000,
      delivery_fee: Math.round(delivery * 100) / 100,
      precio_negocio_mensual: Math.round(negocio * 100) / 100,
      precio_delivery_mensual: Math.round(repartidor * 100) / 100,
      descuento_anual: Math.round(descuentoPct * 10) / 1000,
      dias_prueba: prueba,
      dias_gracia: gracia,
      horas_para_transferir: horas,
    })
    .eq("id", true);

  revalidatePath("/", "layout");
  redirect(error ? "/admin?config=error" : "/admin?config=ok");
}

/** El admin aprueba o rechaza el pago de una suscripción. */
export async function reviewSubscriptionPaymentAction(
  _prevState: ApprovalState,
  formData: FormData
): Promise<ApprovalState> {
  const id = String(formData.get("id") ?? "");
  const aprobar = formData.get("decision") === "aprobar";
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!id) return { error: "Pago inválido." };
  if (!aprobar && !motivo) return { error: "Escribe el motivo del rechazo." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_subscription_payment", {
    p_payment_id: id,
    p_aprobar: aprobar,
    p_motivo: motivo || undefined,
  });
  if (error) return { error: friendlyDbError(error, "No se pudo revisar el pago.") };

  revalidatePath("/admin");
  return { error: null };
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
