import { createClient } from "@/lib/supabase/server";
import HomeLink from "@/components/HomeLink";
import UserMenu from "@/components/UserMenu";
import { LogoMark } from "./Logo";

/** Encabezado de los paneles (tienda, repartidor, admin). */
export default async function PanelHeader({ etiqueta, titulo }: { etiqueta: string; titulo: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("nombre, rol").eq("id", user.id).maybeSingle()
    : { data: null };

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <LogoMark className="h-11 w-11" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-monte-600">{etiqueta}</p>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{titulo}</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <HomeLink />
        {user && <UserMenu nombre={profile?.nombre ?? null} email={user.email ?? ""} rol={profile?.rol ?? "cliente"} />}
      </div>
    </header>
  );
}
