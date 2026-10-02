import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailForm, PasswordForm } from "./CredentialsForms";

export const metadata: Metadata = {
  title: "Email y contraseña",
};

export default async function CredencialesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/cuenta/credenciales");

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <Link href="/cuenta" className="self-start text-sm font-medium underline">
        <span aria-hidden>←</span> Mi cuenta
      </Link>

      <h1 className="font-display text-3xl font-semibold tracking-tight">Email y contraseña</h1>

      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-semibold text-stone-900">Email</h2>
          <p className="text-sm text-stone-500">
            Ahora es <strong className="text-stone-700">{user.email}</strong>. Lo usas para iniciar sesión y te llegan
            ahí los avisos de tus pedidos.
          </p>
        </div>
        <EmailForm />
      </section>

      <section className="card flex flex-col gap-4 p-5">
        <div>
          <h2 className="font-semibold text-stone-900">Contraseña</h2>
          <p className="text-sm text-stone-500">
            ¿No recuerdas la actual?{" "}
            <Link href="/forgot-password" className="link">
              Restablécela por correo
            </Link>
            .
          </p>
        </div>
        <PasswordForm />
      </section>
    </div>
  );
}
