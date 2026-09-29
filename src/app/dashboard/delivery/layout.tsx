import { requireOwnCourier } from "@/lib/supabase/current-courier";
import PanelHeader from "@/components/brand/PanelHeader";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId, courier } = await requireOwnCourier();
  const { data: user } = await supabase.from("users").select("nombre").eq("id", userId).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PanelHeader etiqueta={`Repartidor · ${courier.vehiculo}`} titulo={user?.nombre ?? "Mis entregas"} />
      {children}
    </div>
  );
}
