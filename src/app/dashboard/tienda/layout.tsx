import Link from "next/link";
import { requireOwnStore } from "@/lib/supabase/current-store";
import { signOutAction } from "@/app/(auth)/actions";
import HomeLink from "@/components/HomeLink";

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const { store } = await requireOwnStore();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <p className="text-sm text-neutral-500">Panel de tienda</p>
          <h1 className="text-xl font-semibold">{store.nombre}</h1>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
            Cerrar sesión
          </button>
        </form>
      </div>

      <nav className="mb-6 flex gap-4 text-sm">
        <HomeLink />
        <Link href="/dashboard/tienda/pedidos" className="font-medium underline">
          Pedidos
        </Link>
        <Link href="/dashboard/tienda/productos" className="font-medium underline">
          Productos
        </Link>
        <Link href="/dashboard/tienda/perfil" className="font-medium underline">
          Perfil de la tienda
        </Link>
      </nav>

      {children}
    </div>
  );
}
