import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CourierRequestForm from "./CourierRequestForm";

export default async function CompleteCourierProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Si la solicitud fue rechazada, se precargan los datos para corregirlos.
  const { data: courier } = await supabase
    .from("couriers")
    .select("vehiculo, documento_identidad, matricula, estado")
    .eq("user_id", user.id)
    .maybeSingle();

  return <CourierRequestForm initial={courier?.estado === "rechazado" ? courier : null} />;
}
