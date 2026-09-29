import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { StoreRow } from "@/types/database";

/** Sesión + tienda del dueño autenticado. El middleware ya garantiza rol=tienda y estado=aprobado. */
export async function requireOwnStore(): Promise<{
  supabase: ReturnType<typeof createClient>;
  userId: string;
  store: StoreRow;
}> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!store) redirect("/complete-profile/tienda");

  return { supabase, userId: user.id, store };
}
