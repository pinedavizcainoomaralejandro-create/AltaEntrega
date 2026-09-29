import { requireOwnStore } from "@/lib/supabase/current-store";
import StoreProfileForm from "@/components/tienda/StoreProfileForm";

export default async function PerfilTiendaPage() {
  const { store } = await requireOwnStore();

  return (
    <div>
      <h2 className="mb-4 font-display text-xl font-semibold">Datos de la tienda</h2>
      <StoreProfileForm store={store} />
    </div>
  );
}
