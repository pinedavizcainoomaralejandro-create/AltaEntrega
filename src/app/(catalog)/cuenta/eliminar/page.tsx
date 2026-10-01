import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import HomeLink from "@/components/HomeLink";
import DeleteAccountForm from "./DeleteAccountForm";

export const metadata: Metadata = {
  title: "Eliminar mi cuenta",
};

// Lo que se borra según el rol (debe coincidir con delete_my_account()).
const QUE_SE_BORRA: Record<string, string[]> = {
  cliente: [
    "Tu perfil: nombre, email y teléfono.",
    "Las direcciones de entrega de tus pedidos.",
  ],
  tienda: [
    "Tu perfil: nombre, email y teléfono.",
    "Tu negocio deja de aparecer en AltaEntrega.",
    "Tu cuenta bancaria, tu logo y las fotos de tus productos.",
  ],
  courier: [
    "Tu perfil: nombre, email y teléfono.",
    "Tu cédula, tu matrícula y los datos de tu vehículo.",
  ],
};

export default async function EliminarCuentaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/cuenta/eliminar");

  const { data: profile } = await supabase.from("users").select("rol, email").eq("id", user.id).maybeSingle();
  const rol = profile?.rol ?? "cliente";

  return (
    <article className="mx-auto flex max-w-xl flex-col gap-6 text-sm leading-relaxed text-stone-700">
      <HomeLink className="self-start" />

      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Eliminar mi cuenta</h1>
        <p className="mt-2 text-stone-500">{profile?.email ?? user.email}</p>
      </header>

      {rol === "admin" ? (
        <p className="card p-5">
          Un administrador no puede eliminar su cuenta desde la app. Si necesitas hacerlo, bórrala desde Supabase.
        </p>
      ) : (
        <>
          <div className="card flex flex-col gap-3 p-5">
            <h2 className="font-semibold text-stone-900">Qué se borra</h2>
            <ul className="list-disc space-y-1 pl-5">
              {(QUE_SE_BORRA[rol] ?? QUE_SE_BORRA.cliente).map((linea) => (
                <li key={linea}>{linea}</li>
              ))}
            </ul>
            <h2 className="mt-2 font-semibold text-stone-900">Qué se conserva</h2>
            <p>
              Los pedidos y pagos ya hechos, sin tus datos personales, porque la ley obliga a guardarlos. Más detalles
              en la{" "}
              <Link href="/privacidad" className="link">
                política de privacidad
              </Link>
              .
            </p>
            <p className="font-medium text-red-700">Esta acción no se puede deshacer.</p>
          </div>

          <p>
            Si tienes pedidos en curso, reembolsos o transferencias pendientes, espera a que terminen antes de eliminar
            tu cuenta.
          </p>

          <DeleteAccountForm />
        </>
      )}
    </article>
  );
}
