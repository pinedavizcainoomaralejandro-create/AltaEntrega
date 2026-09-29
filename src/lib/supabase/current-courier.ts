import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CourierRow } from "@/types/database";

/** Sesión + perfil del repartidor autenticado. El middleware ya garantiza rol=courier y estado=aprobado. */
export async function requireOwnCourier(): Promise<{
  supabase: ReturnType<typeof createClient>;
  userId: string;
  courier: CourierRow;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: courier } = await supabase
    .from("couriers")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!courier) redirect("/complete-profile/delivery");

  return { supabase, userId: user.id, courier };
}
