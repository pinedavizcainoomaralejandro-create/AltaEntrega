import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "../(auth)/actions";

export default async function PendingApprovalPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("rol")
    .eq("id", user.id)
    .maybeSingle();

  const estado =
    profile?.rol === "tienda"
      ? (await supabase.from("stores").select("estado").eq("user_id", user.id).maybeSingle()).data?.estado
      : (await supabase.from("couriers").select("estado").eq("user_id", user.id).maybeSingle()).data?.estado;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">
        {estado === "rechazado" ? "Solicitud rechazada" : "Cuenta pendiente de aprobación"}
      </h1>
      <p className="text-neutral-500">
        {estado === "rechazado"
          ? "Tu solicitud fue rechazada por un administrador. Contacta a soporte para más información."
          : "Un administrador está revisando tu perfil. Te avisaremos apenas sea aprobado."}
      </p>
      <form action={signOutAction}>
        <button type="submit" className="rounded-md border border-neutral-300 px-4 py-2 text-sm">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
