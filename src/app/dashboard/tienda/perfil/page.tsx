import Link from "next/link";
import { requireOwnStore } from "@/lib/supabase/current-store";
import StoreProfileForm from "@/components/tienda/StoreProfileForm";

export default async function PerfilTiendaPage() {
  const { store } = await requireOwnStore();

  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-semibold">Datos de la tienda</h2>
      <StoreProfileForm store={store} />
      <p className="mt-10 text-sm text-stone-500">
        ¿Quieres cerrar tu negocio en AltaEntrega?{" "}
        <Link href="/cuenta/eliminar" className="text-red-600 underline">
          Eliminar mi cuenta
        </Link>
      </p>
    </div>
  );
}
