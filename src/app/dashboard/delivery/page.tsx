import Link from "next/link";
import { requireOwnCourier } from "@/lib/supabase/current-courier";
import AvailabilityToggle from "@/components/delivery/AvailabilityToggle";
import OrdersPool from "@/components/delivery/OrdersPool";
import MyDeliveries from "@/components/delivery/MyDeliveries";

export default async function DeliveryHomePage() {
  const { courier } = await requireOwnCourier();

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-stone-500">Tu disponibilidad</p>
        <AvailabilityToggle courierId={courier.id} initialDisponible={courier.disponible} />
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Pedidos disponibles</h2>
        <OrdersPool />
      </section>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Mis entregas</h2>
        <MyDeliveries courierId={courier.id} />
      </section>

      <p className="text-sm text-stone-500">
        ¿Ya no quieres repartir con AltaEntrega?{" "}
        <Link href="/cuenta/eliminar" className="text-red-600 underline">
          Eliminar mi cuenta
        </Link>
      </p>
    </div>
  );
}
