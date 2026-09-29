import { requireOwnCourier } from "@/lib/supabase/current-courier";
import { signOutAction } from "@/app/(auth)/actions";

export default async function DeliveryLayout({ children }: { children: React.ReactNode }) {
  const { courier } = await requireOwnCourier();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between border-b border-neutral-200 pb-4">
        <div>
          <p className="text-sm text-neutral-500">Panel de repartidor</p>
          <h1 className="text-xl font-semibold">{courier.vehiculo}</h1>
        </div>
        <form action={signOutAction}>
          <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
            Cerrar sesión
          </button>
        </form>
      </div>

      {children}
    </div>
  );
}
