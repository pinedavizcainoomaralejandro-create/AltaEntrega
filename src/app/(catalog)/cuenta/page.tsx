import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import LogoutButton from "@/components/LogoutButton";
import HomeLink from "@/components/HomeLink";
import Avatar from "@/components/Avatar";
import { avatarUrl } from "@/lib/avatar";
import {
  ChevronRightIcon,
  HistoryIcon,
  KeyIcon,
  LogoutIcon,
  PencilIcon,
  ReceiptIcon,
  ShieldIcon,
  TrashIcon,
  UserIcon,
} from "@/components/ui/icons";

export const metadata: Metadata = {
  title: "Mi cuenta",
};

const ROL_LABEL: Record<string, string> = {
  cliente: "Cliente",
  tienda: "Negocio",
  courier: "Repartidor",
  admin: "Administrador",
};

const itemClass =
  "flex w-full items-center gap-3 px-4 py-3.5 text-left text-sm font-medium transition hover:bg-arena-100";

function MenuLink({
  href,
  icon,
  label,
  detalle,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  detalle?: string;
}) {
  return (
    <li>
      <Link href={href} className={`${itemClass} text-stone-800`}>
        <span className="text-monte-700">{icon}</span>
        <span className="flex-1">
          {label}
          {detalle && <span className="block text-xs font-normal text-stone-500">{detalle}</span>}
        </span>
        <ChevronRightIcon className="h-4 w-4 text-stone-400" />
      </Link>
    </li>
  );
}

export default async function CuentaPage({ searchParams }: { searchParams: Promise<{ email_actualizado?: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/cuenta");

  const { data: profile } = await supabase.from("users").select("nombre, email, rol, avatar_path").eq("id", user.id).maybeSingle();
  const rol = profile?.rol ?? "cliente";
  const nombre = profile?.nombre ?? user.email ?? "";
  const { email_actualizado } = await searchParams;

  // Tienda/repartidor: el proxy lleva /pending-approval a su pantalla real
  // (solicitud, perfil por completar o panel).
  const panelHref = rol === "admin" ? "/admin" : "/pending-approval";

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <HomeLink className="self-start" />

      <header className="flex items-center gap-4">
        <Avatar nombre={nombre} url={avatarUrl(profile?.avatar_path)} className="h-14 w-14 font-display text-2xl" />
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight">{nombre}</h1>
          <p className="truncate text-sm text-stone-500">
            {profile?.email ?? user.email} · {ROL_LABEL[rol] ?? rol}
          </p>
        </div>
      </header>

      {email_actualizado === "1" && (
        <p className="rounded-2xl bg-monte-50 p-4 text-sm text-monte-800">Listo, tu email quedó actualizado.</p>
      )}

      <ul className="card divide-y divide-stone-100 overflow-hidden">
        {rol === "cliente" ? (
          <>
            <MenuLink href="/pedidos" icon={<ReceiptIcon />} label="Mis pedidos" detalle="Pedidos en curso y anteriores" />
            <MenuLink
              href="/cuenta/compras"
              icon={<HistoryIcon />}
              label="Historial de compras"
              detalle="Lo que has comprado y cuánto has gastado"
            />
          </>
        ) : (
          <MenuLink href={panelHref} icon={<UserIcon />} label="Ir a mi panel" />
        )}
        <MenuLink href="/cuenta/perfil" icon={<PencilIcon />} label="Editar perfil" detalle="Foto, nombre y teléfono" />
        <MenuLink
          href="/cuenta/credenciales"
          icon={<KeyIcon />}
          label="Email y contraseña"
          detalle="Credenciales para iniciar sesión"
        />
        <MenuLink
          href="/privacidad"
          icon={<ShieldIcon />}
          label="Privacidad"
          detalle="Qué datos guardamos y para qué"
        />
      </ul>

      <ul className="card divide-y divide-stone-100 overflow-hidden">
        <li>
          <LogoutButton className={`${itemClass} text-stone-800`}>
            <span className="text-stone-500">
              <LogoutIcon />
            </span>
            Cerrar sesión
          </LogoutButton>
        </li>
        <li>
          <Link href="/cuenta/eliminar" className={`${itemClass} text-red-600 hover:bg-red-50`}>
            <TrashIcon />
            <span className="flex-1">Eliminar mi cuenta</span>
            <ChevronRightIcon className="h-4 w-4 text-red-300" />
          </Link>
        </li>
      </ul>
    </div>
  );
}
