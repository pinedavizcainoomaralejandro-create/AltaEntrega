"use server";

import { revalidatePath } from "next/cache";
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
