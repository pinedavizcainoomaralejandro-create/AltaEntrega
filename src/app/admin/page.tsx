import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOutAction } from "@/app/(auth)/actions";
import { setStoreStatusAction, setCourierStatusAction, cancelOrderAction } from "./actions";
import CancelOrderButton from "@/components/admin/CancelOrderButton";
import PaymentsAdmin from "@/components/admin/PaymentsAdmin";
import ApprovalActions from "@/components/admin/ApprovalActions";
import { ORDER_STATUS_LABEL } from "@/lib/orderStatus";
import HomeLink from "@/components/HomeLink";
import { formatFecha } from "@/lib/format";

const ORDERS_PAGE_SIZE = 50;

/**
 * Medianoche de hoy en República Dominicana, sin depender de la zona horaria
 * del servidor (en Vercel es UTC). RD está en UTC-4 todo el año, sin horario
 * de verano, así que el desfase fijo es exacto.
 */
function startOfTodayISO() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santo_Domingo" }).format(new Date());
  return new Date(`${today}T00:00:00-04:00`).toISOString();
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; config?: string }>;
}) {
  const { page: pageParam, config } = await searchParams;
  const supabase = await createClient();
  const page = Math.max(1, Math.floor(Number(pageParam)) || 1);
  const from = (page - 1) * ORDERS_PAGE_SIZE;

  const [
    { count: tiendasActivas },
    { count: pedidosHoy },
    { count: repartidoresDisponibles },
    { data: pendingStores },
    { data: pendingCouriers },
    { data: orders, count: totalOrders },
  ] = await Promise.all([
    supabase.from("stores").select("id", { count: "exact", head: true }).eq("estado", "aprobado"),
    supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", startOfTodayISO()),
    supabase
      .from("couriers")
      .select("id", { count: "exact", head: true })
      .eq("estado", "aprobado")
      .eq("disponible", true),
    supabase
      .from("stores")
      .select("id, user_id, nombre, direccion, categoria, created_at")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: true }),
    supabase
      .from("couriers")
      .select("id, user_id, vehiculo, documento_identidad, matricula, created_at")
      .eq("estado", "pendiente")
      .order("created_at", { ascending: true }),
    supabase
      .from("orders")
      .select("id, numero, store_id, cliente_id, courier_id, estado, estado_pago, total, created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, from + ORDERS_PAGE_SIZE - 1),
  ]);

  // Nombres de los dueños de las solicitudes pendientes.
  const ownerIds = Array.from(
    new Set([...(pendingStores ?? []).map((s) => s.user_id), ...(pendingCouriers ?? []).map((c) => c.user_id)])
  );
  const { data: owners } = ownerIds.length
    ? await supabase.from("users").select("id, nombre, email, telefono").in("id", ownerIds)
    : { data: [] as { id: string; nombre: string; email: string; telefono: string | null }[] };
  const ownerById = new Map((owners ?? []).map((o) => [o.id, o] as const));

  // Nombres relacionados con la tabla de pedidos.
  const orderRows = orders ?? [];
  const orderStoreIds = Array.from(new Set(orderRows.map((o) => o.store_id)));
  const orderClienteIds = Array.from(new Set(orderRows.map((o) => o.cliente_id)));
  const orderCourierIds = Array.from(
    new Set(orderRows.map((o) => o.courier_id).filter((id): id is string => Boolean(id)))
  );

  const { data: orderCouriers } = orderCourierIds.length
    ? await supabase.from("couriers").select("id, user_id").in("id", orderCourierIds)
    : { data: [] as { id: string; user_id: string }[] };
  const courierUserById = new Map((orderCouriers ?? []).map((c) => [c.id, c.user_id] as const));
  const orderUserIds = Array.from(new Set([...orderClienteIds, ...Array.from(courierUserById.values())]));

  const [{ data: orderStores }, { data: orderUsers }] = await Promise.all([
    orderStoreIds.length
      ? supabase.from("stores").select("id, nombre").in("id", orderStoreIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    orderUserIds.length
      ? supabase.from("users").select("id, nombre").in("id", orderUserIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const storeNameById = new Map((orderStores ?? []).map((s) => [s.id, s.nombre] as const));
  const userNameById = new Map((orderUsers ?? []).map((u) => [u.id, u.nombre] as const));
  const courierName = (courierId: string) => userNameById.get(courierUserById.get(courierId) ?? "") ?? "—";
  const totalPages = Math.max(1, Math.ceil((totalOrders ?? 0) / ORDERS_PAGE_SIZE));

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4">
        <h1 className="text-xl font-semibold">Panel de administración</h1>
        <div className="flex items-center gap-4">
          <HomeLink />
          <form action={signOutAction}>
            <button type="submit" className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm">
              Cerrar sesión
            </button>
          </form>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Tiendas activas" value={tiendasActivas ?? 0} />
        <MetricCard label="Pedidos hoy" value={pedidosHoy ?? 0} />
        <MetricCard label="Repartidores disponibles" value={repartidoresDisponibles ?? 0} />
      </div>

      <PaymentsAdmin configResult={config} />

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Tiendas pendientes de aprobación</h2>
        {!pendingStores || pendingStores.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay tiendas pendientes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingStores.map((s) => {
              const owner = ownerById.get(s.user_id);
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.nombre}</p>
                    <p className="text-sm text-neutral-500">
                      {s.categoria} · {s.direccion}
                    </p>
                    <p className="text-xs text-neutral-400">
                      Solicitado por {owner?.nombre ?? "—"} ({owner?.email ?? "—"}
                      {owner?.telefono ? `, ${owner.telefono}` : ""})
                    </p>
                  </div>
                  <ApprovalActions
                    id={s.id}
                    action={setStoreStatusAction}
                    confirmRejectMessage={`¿Rechazar la tienda "${s.nombre}"?`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-lg font-medium">Repartidores pendientes de aprobación</h2>
        {!pendingCouriers || pendingCouriers.length === 0 ? (
          <p className="text-sm text-neutral-500">No hay repartidores pendientes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingCouriers.map((c) => {
              const owner = ownerById.get(c.user_id);
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{owner?.nombre ?? "—"}</p>
                    <p className="text-sm text-neutral-500">
                      {c.vehiculo} · Cédula {c.documento_identidad} · Matrícula {c.matricula}
                    </p>
                    <p className="text-xs text-neutral-400">
                      {owner?.email ?? "—"}
                      {owner?.telefono ? ` · ${owner.telefono}` : ""}
                    </p>
                  </div>
                  <ApprovalActions
                    id={c.id}
                    action={setCourierStatusAction}
                    confirmRejectMessage={`¿Rechazar al repartidor "${owner?.nombre ?? c.documento_identidad}"?`}
                  />
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium">Pedidos ({totalOrders ?? 0})</h2>
        {orderRows.length === 0 ? (
          <p className="text-sm text-neutral-500">Todavía no hay pedidos.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-neutral-50 text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">Tienda</th>
                  <th className="px-3 py-2">Cliente</th>
                  <th className="px-3 py-2">Repartidor</th>
                  <th className="px-3 py-2">Estado</th>
                  <th className="px-3 py-2">Pago</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {orderRows.map((o) => (
                  <tr key={o.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 text-neutral-500">
                      {formatFecha(o.created_at)}
                    </td>
                    <td className="px-3 py-2">{storeNameById.get(o.store_id) ?? "—"}</td>
                    <td className="px-3 py-2">{userNameById.get(o.cliente_id) ?? "—"}</td>
                    <td className="px-3 py-2">
                      {o.courier_id ? courierName(o.courier_id) : "Sin asignar"}
                    </td>
                    <td className="px-3 py-2">{ORDER_STATUS_LABEL[o.estado]}</td>
                    <td className="px-3 py-2">{o.estado_pago.replace("_", " ")}</td>
                    <td className="px-3 py-2 text-right">RD${o.total.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right">
                      {o.estado !== "entregado" && o.estado !== "cancelado" && (
                        <CancelOrderButton id={o.id} action={cancelOrderAction} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm">
            {page > 1 ? (
              <Link href={`/admin?page=${page - 1}`} className="underline">
                ← Más recientes
              </Link>
            ) : (
              <span />
            )}
            <span className="text-neutral-500">
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={`/admin?page=${page + 1}`} className="underline">
                Más antiguos →
              </Link>
            ) : (
              <span />
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
    </div>
  );
}
