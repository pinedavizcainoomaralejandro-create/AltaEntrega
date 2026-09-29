import { signOutAction } from "@/app/(auth)/actions";
import HomeLink from "@/components/HomeLink";
import { LogoMark } from "./Logo";

/** Encabezado de los paneles (tienda, repartidor, admin). */
export default function PanelHeader({ etiqueta, titulo }: { etiqueta: string; titulo: string }) {
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
        <form action={signOutAction}>
          <button type="submit" className="btn-secondary btn-sm">
            Cerrar sesión
          </button>
        </form>
      </div>
    </header>
  );
}
