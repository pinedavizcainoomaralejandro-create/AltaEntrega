import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StoreRequestForm from "./StoreRequestForm";

export default async function CompleteStoreProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si la solicitud fue rechazada, se precargan los datos para corregirlos.
  const { data: store } = await supabase
    .from("stores")
    .select("nombre, direccion, categoria, estado")
    .eq("user_id", user.id)
    .maybeSingle();

  return <StoreRequestForm initial={store?.estado === "rechazado" ? store : null} />;
}
