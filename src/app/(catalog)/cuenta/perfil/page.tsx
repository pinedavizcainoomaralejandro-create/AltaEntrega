import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";

export const metadata: Metadata = {
  title: "Editar perfil",
};

export default async function EditarPerfilPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/cuenta/perfil");

  const { data: profile } = await supabase.from("users").select("nombre, telefono, rol").eq("id", user.id).maybeSingle();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/cuenta" className="self-start text-sm font-medium underline">
        <span aria-hidden>←</span> Mi cuenta
      </Link>

      <h1 className="font-display text-3xl font-semibold tracking-tight">Editar perfil</h1>

      <div className="card p-5">
        <ProfileForm nombre={profile?.nombre ?? ""} telefono={profile?.telefono ?? ""} />
      </div>

      {profile?.rol === "tienda" && (
        <p className="text-sm text-stone-500">
          Los datos de tu negocio (nombre, dirección, logo) se cambian en el{" "}
          <Link href="/dashboard/tienda/perfil" className="link">
            perfil de la tienda
          </Link>
          .
        </p>
      )}
    </div>
  );
}
