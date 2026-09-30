"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { uploadComprobante, validateComprobante } from "@/lib/supabase/comprobantes";

export type SubscriptionPaymentState = { error: string | null; enviado?: boolean };

/** El negocio o repartidor envía el comprobante del pago de su suscripción. */
export async function submitSubscriptionPaymentAction(
  _prev: SubscriptionPaymentState,
  formData: FormData
): Promise<SubscriptionPaymentState> {
  const plan = String(formData.get("plan") ?? "");
  const referencia = String(formData.get("referencia") ?? "").trim();
  const file = formData.get("comprobante");

  if (plan !== "mensual" && plan !== "anual") return { error: "Elige el plan mensual o anual." };
  if (!referencia) return { error: "Escribe la referencia de tu transferencia." };
  const invalid = validateComprobante(file);
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let path: string;
  try {
    path = await uploadComprobante(supabase, `suscripciones/${user.id}`, file as File);
  } catch {
    return { error: "No se pudo subir el comprobante. Inténtalo de nuevo." };
  }

  const { error } = await supabase.rpc("submit_subscription_payment", {
    p_plan: plan,
    p_referencia: referencia,
    p_comprobante_path: path,
  });
  if (error) return { error: friendlyDbError(error, "No se pudo enviar el pago.") };

  revalidatePath("/dashboard/tienda/suscripcion");
  revalidatePath("/dashboard/delivery/suscripcion");
  return { error: null, enviado: true };
}
