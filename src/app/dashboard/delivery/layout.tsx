import { requireOwnCourier } from "@/lib/supabase/current-courier";
import Link from "next/link";
import PanelHeader from "@/components/brand/PanelHeader";
import SubscriptionBanner from "@/components/suscripcion/SubscriptionBanner";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId, courier } = await requireOwnCourier();
  const { data: user } = await supabase.from("users").select("nombre").eq("id", userId).maybeSingle();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <PanelHeader etiqueta={`Repartidor · ${courier.vehiculo}`} titulo={user?.nombre ?? "Mis entregas"} />
      <SubscriptionBanner tipo="courier" href="/dashboard/delivery/suscripcion" />
      <nav className="mb-6 flex gap-4 text-sm font-medium">
        <Link href="/dashboard/delivery" className="link">
          Mis entregas
        </Link>
        <Link href="/dashboard/delivery/suscripcion" className="link">
          Mi suscripción
        </Link>
      </nav>
      {children}
    </div>
  );
}
