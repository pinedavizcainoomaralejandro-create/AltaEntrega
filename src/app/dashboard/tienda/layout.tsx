import { requireOwnStore } from "@/lib/supabase/current-store";
import PanelHeader from "@/components/brand/PanelHeader";
import StoreNav from "@/components/tienda/StoreNav";

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const { store } = await requireOwnStore();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PanelHeader etiqueta="Panel de tienda" titulo={store.nombre} />
      <StoreNav />
      {children}
    </div>
  );
}
