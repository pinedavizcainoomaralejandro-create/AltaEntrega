import { requireOwnStore } from "@/lib/supabase/current-store";
import StoreOrders from "@/components/tienda/StoreOrders";

export default async function PedidosTiendaPage() {
  const { store } = await requireOwnStore();

  return <StoreOrders storeId={store.id} />;
}
