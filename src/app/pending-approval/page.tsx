import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import AuthShell from "@/components/brand/AuthShell";

export default async function PendingApprovalPage() {
  const supabase = await createClient();
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
    <AuthShell
      title={estado === "rechazado" ? "Solicitud rechazada" : "¡Recibimos tu solicitud!"}
      subtitle={
        estado === "rechazado"
          ? "Un administrador rechazó tu solicitud. Puedes corregir tus datos y enviarlos de nuevo."
          : "Estamos revisando tu perfil. Te avisaremos por correo cuando tengamos una respuesta; mientras tanto puedes ver el catálogo desde Inicio."
      }
    >
      {estado !== "rechazado" && (
        <div className="flex items-center gap-3 rounded-2xl bg-monte-50 p-4 text-sm text-monte-800">
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-monte-400 opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-monte-500" />
          </span>
          En revisión por el equipo de AltaEntrega
        </div>
      )}
      {estado === "rechazado" && (
        <Link
          href={profile?.rol === "tienda" ? "/complete-profile/tienda" : "/complete-profile/delivery"}
          className="btn-primary"
        >
          Corregir mis datos y reenviar
        </Link>
      )}
      <LogoutButton className="btn-secondary">Cerrar sesión</LogoutButton>
      <Link href="/cuenta/eliminar" className="text-center text-sm text-stone-500 underline hover:text-red-600">
        Eliminar mi cuenta
      </Link>
    </AuthShell>
  );
}
