"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function toggleAvailabilityAction(
  courierId: string,
  disponible: boolean
): Promise<{ error: string | null }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("couriers")
    .update({ disponible })
    .eq("id", courierId)
    .eq("user_id", user.id);

  if (error) return { error: "No se pudo cambiar tu disponibilidad. Inténtalo de nuevo." };

  revalidatePath("/dashboard/delivery");
  return { error: null };
}
