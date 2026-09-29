import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUS_LABEL } from "@/lib/orderStatus";

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
    .order("created_at", { ascending: false });

  if (!orders || orders.length === 0) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-semibold">Mis pedidos</h1>
        <p className="mb-4 text-neutral-500">Todavía no tienes pedidos.</p>
        <Link href="/" className="underline">
          Explorar tiendas
        </Link>
      </div>
    );
  }

  const storeIds = Array.from(new Set(orders.map((o) => o.store_id)));
  const { data: stores } = await supabase.from("stores").select("id, nombre").in("id", storeIds);
  const nameById = new Map((stores ?? []).map((s) => [s.id, s.nombre] as const));

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Mis pedidos</h1>
      <div className="flex flex-col gap-3">
        {orders.map((o) => (
          <Link
            key={o.id}
            href={`/pedidos/${o.id}`}
            className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-4 hover:border-neutral-400"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{nameById.get(o.store_id) ?? "Tienda"}</p>
              <p className="text-xs text-neutral-400">{new Date(o.created_at).toLocaleString("es-DO")}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm font-medium">RD${o.total.toFixed(2)}</p>
              <p className="text-xs text-neutral-500">{ORDER_STATUS_LABEL[o.estado]}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
