import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL } from "@/lib/orderStatus";
import { formatFecha } from "@/lib/format";

export default async function PedidosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: orders } = await supabase
    .from("orders")
    .select("id, store_id, estado, total, metodo_pago, created_at")
    .eq("cliente_id", user.id)
    // Oculta los intentos de pago que no se completaron (rechazados, expirados
    // o cancelados antes de pagar); los que esperan pago sí se muestran.
    .or("estado.neq.cancelado,estado_pago.in.(pagado,reembolso_pendiente,reembolsado)")
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) {
    return (
      <div>
        <div className="card mx-auto flex max-w-lg flex-col items-center gap-3 px-6 py-12 text-center">
          <Image src="/images/repartidor.svg" alt="" width={240} height={160} unoptimized />
          <h1 className="font-display text-3xl font-semibold tracking-tight">Todavía no tienes pedidos</h1>
          <p className="text-sm text-stone-500">Cuando compres, aquí podrás seguir tu pedido en vivo.</p>
          <Link href="/" className="btn-primary mt-2">
            Explorar tiendas
          </Link>
        </div>
      </div>
    );
  }

  const storeIds = Array.from(new Set(orders.map((o) => o.store_id)));
  const { data: stores } = await supabase.from("stores").select("id, nombre").in("id", storeIds);
  const nameById = new Map((stores ?? []).map((s) => [s.id, s.nombre] as const));

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-semibold tracking-tight">Mis pedidos</h1>
      <div className="flex flex-col gap-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/pedidos/${o.id}`}
            className="flex items-center justify-between gap-3 card p-4 hover:border-stone-400"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{nameById.get(o.store_id) ?? "Tienda"}</p>
              <p className="text-xs text-stone-400">{formatFecha(o.created_at)}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium">RD${o.total.toFixed(2)}</p>
              <p className="text-xs text-stone-500">{ORDER_STATUS_LABEL[o.estado]}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
