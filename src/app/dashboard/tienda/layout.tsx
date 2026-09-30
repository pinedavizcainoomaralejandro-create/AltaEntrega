import { requireOwnStore } from "@/lib/supabase/current-store";
import PanelHeader from "@/components/brand/PanelHeader";
import StoreNav from "@/components/tienda/StoreNav";
import SubscriptionBanner from "@/components/suscripcion/SubscriptionBanner";

export default async function TiendaLayout({ children }: { children: React.ReactNode }) {
  const { store } = await requireOwnStore();

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PanelHeader etiqueta="Panel de tienda" titulo={store.nombre} />
      <SubscriptionBanner tipo="tienda" href="/dashboard/tienda/suscripcion" />
      <StoreNav />
      {children}
    </div>
  );
}
