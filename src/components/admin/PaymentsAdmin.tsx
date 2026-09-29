import { createClient } from "@/lib/supabase/server";
import { formatFecha } from "@/lib/format";
import { markPayoutAction, markRefundedAction } from "@/app/admin/actions";
import AdminActionButton from "./AdminActionButton";
import PlatformSettingsForm from "./PlatformSettingsForm";

type Payout = { key: string; nombre: string; monto: number; orderIds: string[] };

function groupPayouts<T extends { order_id: string }>(
  rows: T[],
  keyOf: (row: T) => string | null,
  amountOf: (row: T) => number,
  nameOf: (key: string) => string
): Payout[] {
  const groups = new Map<string, Payout>();
  for (const row of rows) {
    const key = keyOf(row);
    if (!key) continue;
    const group = groups.get(key) ?? { key, nombre: nameOf(key), monto: 0, orderIds: [] };
    group.monto += amountOf(row);
    group.orderIds.push(row.order_id);
    groups.set(key, group);
  }
  return Array.from(groups.values()).sort((a, b) => b.monto - a.monto);
}

/**
 * Configuración de cobros, lo que se debe a tiendas y repartidores por
 * pedidos entregados y pagados, y los reembolsos pendientes.
 */
export default async function PaymentsAdmin({ configResult }: { configResult?: string }) {
  const supabase = await createClient();

  const [{ data: settings }, { data: delivered }, { data: refunds }] = await Promise.all([
    supabase.from("platform_settings").select("commission_rate, delivery_fee").maybeSingle(),
    supabase
      .from("orders")
      .select("id, store_id, courier_id")
      .eq("estado", "entregado")
      .eq("estado_pago", "pagado"),
    supabase
      .from("orders")
      .select("id, numero, codigo, total, pago_referencia, pagado_at")
      .eq("estado_pago", "reembolso_pendiente")
      .order("pagado_at", { ascending: true }),
  ]);

  const deliveredRows = delivered ?? [];
  const orderById = new Map(deliveredRows.map((o) => [o.id, o] as const));

  const { data: settlements } = deliveredRows.length
    ? await supabase
        .from("order_settlements")
        .select("order_id, store_id, monto_tienda, monto_delivery, comision, tienda_pagado_at, courier_pagado_at")
        .in("order_id", deliveredRows.map((o) => o.id))
    : { data: [] };
  const settlementRows = settlements ?? [];

  const storeIds = Array.from(new Set(settlementRows.map((s) => s.store_id)));
  const courierIds = Array.from(
    new Set(deliveredRows.map((o) => o.courier_id).filter((id): id is string => Boolean(id)))
  );
  const [{ data: stores }, { data: couriers }] = await Promise.all([
    storeIds.length
      ? supabase.from("stores").select("id, nombre").in("id", storeIds)
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
    courierIds.length
      ? supabase.from("couriers").select("id, user_id").in("id", courierIds)
      : Promise.resolve({ data: [] as { id: string; user_id: string }[] }),
  ]);
  const courierUserIds = (couriers ?? []).map((c) => c.user_id);
  const { data: courierUsers } = courierUserIds.length
    ? await supabase.from("users").select("id, nombre").in("id", courierUserIds)
    : { data: [] as { id: string; nombre: string }[] };

  const storeName = new Map((stores ?? []).map((s) => [s.id, s.nombre] as const));
  const userName = new Map((courierUsers ?? []).map((u) => [u.id, u.nombre] as const));
  const courierName = new Map((couriers ?? []).map((c) => [c.id, userName.get(c.user_id) ?? "Repartidor"] as const));

  const storePayouts = groupPayouts(
    settlementRows.filter((s) => !s.tienda_pagado_at),
    (s) => s.store_id,
    (s) => s.monto_tienda,
    (id) => storeName.get(id) ?? "Tienda"
  );
  const courierPayouts = groupPayouts(
    settlementRows.filter((s) => !s.courier_pagado_at),
    (s) => orderById.get(s.order_id)?.courier_id ?? null,
    (s) => s.monto_delivery,
    (id) => courierName.get(id) ?? "Repartidor"
  );
  const comisionTotal = settlementRows.reduce((sum, s) => sum + s.comision, 0);

  const renderPayouts = (title: string, payouts: Payout[], tipo: "tienda" | "courier") => (
    <div>
      <h3 className="mb-2 font-medium">{title}</h3>
      {payouts.length === 0 ? (
        <p className="text-sm text-neutral-500">Nada pendiente.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {payouts.map((p) => (
            <li key={p.key} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{p.nombre}</span>
                <span className="text-neutral-500"> · {p.orderIds.length} pedido(s)</span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                <span className="font-medium">RD${p.monto.toFixed(2)}</span>
                <AdminActionButton
                  action={markPayoutAction}
                  fields={{ tipo, orderIds: JSON.stringify(p.orderIds) }}
                  label="Marcar pagado"
                  confirmMessage={`¿Ya transferiste RD$${p.monto.toFixed(2)} a ${p.nombre}?`}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <section className="mb-10 flex flex-col gap-6 rounded-lg border border-neutral-200 p-4">
      <div>
        <h2 className="mb-3 text-lg font-medium">Cobros y pagos</h2>
        {settings ? (
          <PlatformSettingsForm
            commissionRate={settings.commission_rate}
            deliveryFee={settings.delivery_fee}
            result={configResult}
          />
        ) : (
          <p className="text-sm text-red-600">No se pudo cargar la configuración.</p>
        )}
      </div>

      <p className="text-sm text-neutral-600">
        Comisión ganada en pedidos entregados: <span className="font-medium">RD${comisionTotal.toFixed(2)}</span>
      </p>

      <div className="grid gap-6 md:grid-cols-2">
        {renderPayouts("Por pagar a tiendas", storePayouts, "tienda")}
        {renderPayouts("Por pagar a repartidores", courierPayouts, "courier")}
      </div>

      <div>
        <h3 className="mb-2 font-medium">Reembolsos pendientes</h3>
        {!refunds || refunds.length === 0 ? (
          <p className="text-sm text-neutral-500">Nada pendiente.</p>
        ) : (
          <>
            <p className="mb-2 text-xs text-neutral-500">
              Haz el reembolso desde el portal de AZUL con la referencia y luego márcalo aquí.
            </p>
            <ul className="flex flex-col gap-2">
              {refunds.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 rounded-md border border-neutral-200 p-3 text-sm">
                  <span>
                    Pedido {r.codigo} (AZUL #{r.numero}) · RD${r.total.toFixed(2)} · ref. {r.pago_referencia ?? "—"}
                    {r.pagado_at && <span className="text-neutral-500"> · {formatFecha(r.pagado_at)}</span>}
                  </span>
                  <AdminActionButton
                    action={markRefundedAction}
                    fields={{ id: r.id }}
                    label="Marcar reembolsado"
                    confirmMessage={`¿Ya reembolsaste RD$${r.total.toFixed(2)} del pedido ${r.codigo}?`}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
