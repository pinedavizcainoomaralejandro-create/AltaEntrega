import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { setStoreStatusAction, setCourierStatusAction, cancelOrderAction } from "./actions";
import CancelOrderButton from "@/components/admin/CancelOrderButton";
import PaymentsAdmin from "@/components/admin/PaymentsAdmin";
import ApprovalActions from "@/components/admin/ApprovalActions";
import { ORDER_STATUS_LABEL } from "@/lib/orderStatus";
import PanelHeader from "@/components/brand/PanelHeader";
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
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfTodayISO())
      // Solo pedidos pagados: los intentos de pago fallidos no son pedidos.
      .in("estado_pago", ["pagado", "reembolso_pendiente", "reembolsado"]),
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
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PanelHeader etiqueta="AltaEntrega" titulo="Panel de administración" />

      <div className="mb-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard label="Tiendas activas" value={tiendasActivas ?? 0} />
        <MetricCard label="Pedidos hoy" value={pedidosHoy ?? 0} />
        <MetricCard label="Repartidores disponibles" value={repartidoresDisponibles ?? 0} />
      </div>

      <PaymentsAdmin configResult={config} />

      <section className="mb-10">
        <h2 className="mb-3 font-display text-xl font-semibold">Tiendas pendientes de aprobación</h2>
        {!pendingStores || pendingStores.length === 0 ? (
          <p className="text-sm text-stone-500">No hay tiendas pendientes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingStores.map((s) => {
              const owner = ownerById.get(s.user_id);
              return (
                <div
                  key={s.id}
                  className="flex flex-col gap-2 card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.nombre}</p>
                    <p className="text-sm text-stone-500">
                      {s.categoria} · {s.direccion}
                    </p>
                    <p className="text-xs text-stone-400">
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
        <h2 className="mb-3 font-display text-xl font-semibold">Repartidores pendientes de aprobación</h2>
        {!pendingCouriers || pendingCouriers.length === 0 ? (
          <p className="text-sm text-stone-500">No hay repartidores pendientes.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingCouriers.map((c) => {
              const owner = ownerById.get(c.user_id);
              return (
                <div
                  key={c.id}
                  className="flex flex-col gap-2 card p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{owner?.nombre ?? "—"}</p>
                    <p className="text-sm text-stone-500">
                      {c.vehiculo} · Cédula {c.documento_identidad} · Matrícula {c.matricula}
                    </p>
                    <p className="text-xs text-stone-400">
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
        <h2 className="mb-3 font-display text-xl font-semibold">Pedidos ({totalOrders ?? 0})</h2>
        {orderRows.length === 0 ? (
          <p className="text-sm text-stone-500">Todavía no hay pedidos.</p>
        ) : (
          <div className="overflow-x-auto card">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="bg-stone-50 text-xs uppercase text-stone-500">
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
                  <tr key={o.id} className="border-t border-stone-100">
                    <td className="px-3 py-2 text-stone-500">
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
              <Link href={`/admin?page=${page - 1}`} className="link">
                ← Más recientes
              </Link>
            ) : (
              <span />
            )}
            <span className="text-stone-500">
              Página {page} de {totalPages}
            </span>
            {page < totalPages ? (
              <Link href={`/admin?page=${page + 1}`} className="link">
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
    <div className="card relative overflow-hidden p-5">
      <span className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-sol-100" aria-hidden />
      <p className="relative text-sm font-medium text-stone-500">{label}</p>
      <p className="relative mt-1 font-display text-4xl font-semibold text-monte-800">{value}</p>
    </div>
  );
}
