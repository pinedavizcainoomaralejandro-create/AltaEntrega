"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { ORDER_STATUS_LABEL } from "@/lib/orderStatus";
import type { OrderStatus } from "@/types/database";
import OrderDetails from "@/components/pedidos/OrderDetails";
import { formatFecha } from "@/lib/format";

type StoreOrder = {
  numero: number;
  montoTienda: number | null;
  id: string;
  direccion_entrega: string;
  estado: OrderStatus;
  courier_id: string | null;
  created_at: string;
};

// La tienda confirma y prepara; desde "preparando" el pedido pasa al repartidor.
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pendiente: "Confirmar pedido",
  confirmado: "Marcar en preparación",
};

const CANCELABLE: OrderStatus[] = ["pendiente", "confirmado", "preparando"];
const ACTIVE: OrderStatus[] = ["pendiente", "confirmado", "preparando", "en_camino"];

export default function StoreOrders({ storeId }: { storeId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<StoreOrder[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("orders")
      .select("id, numero, direccion_entrega, estado, courier_id, created_at")
      .eq("store_id", storeId)
      // Un pedido sin pagar todavía no es un pedido para la tienda.
      .neq("estado", "esperando_pago")
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError(friendlyDbError(queryError, "No se pudieron cargar los pedidos."));
      return;
    }
    const rows = data ?? [];
    const { data: settlements } = rows.length
      ? await supabase.from("order_settlements").select("order_id, monto_tienda").in("order_id", rows.map((r) => r.id))
      : { data: [] as { order_id: string; monto_tienda: number }[] };
    const montoById = new Map((settlements ?? []).map((s) => [s.order_id, s.monto_tienda] as const));

    setOrders(rows.map((r) => ({ ...r, montoTienda: montoById.get(r.id) ?? null })));
  }, [supabase, storeId]);

  useEffect(() => {
    const channel = supabase
      .channel(`orders-store-${storeId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
        () => refresh()
      )
      // Refresca al quedar suscrito para no perder cambios entre la carga y la suscripción.
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") refresh();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, supabase, storeId]);

  async function run(orderId: string, fn: "store_advance_order" | "cancel_order") {
    setError(null);
    setBusyId(orderId);
    const { error: rpcError } = await supabase.rpc(fn, { p_order_id: orderId });
    setBusyId(null);
    if (rpcError) setError(friendlyDbError(rpcError));
    refresh();
  }

  if (orders === null) {
    return error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-neutral-500">Cargando...</p>;
  }

  const active = orders.filter((o) => ACTIVE.includes(o.estado));
  const finished = orders.filter((o) => !ACTIVE.includes(o.estado));

  const renderOrder = (o: StoreOrder) => {
    const nextLabel = NEXT_LABEL[o.estado];
    return (
      <div key={o.id} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              #{o.numero} · {ORDER_STATUS_LABEL[o.estado]}
            </p>
            <p className="truncate text-sm text-neutral-500">Entregar en: {o.direccion_entrega}</p>
            <p className="text-xs text-neutral-400">
              {formatFecha(o.created_at)} ·{" "}
              {o.montoTienda !== null ? `recibes RD$${o.montoTienda.toFixed(2)}` : "pagado contra entrega"} ·{" "}
              {o.courier_id ? "repartidor asignado" : "sin repartidor"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {nextLabel && (
              <button
                type="button"
                disabled={busyId === o.id}
                onClick={() => run(o.id, "store_advance_order")}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
              >
                {busyId === o.id ? "Actualizando..." : nextLabel}
              </button>
            )}
            {CANCELABLE.includes(o.estado) && (
              <button
                type="button"
                disabled={busyId === o.id}
                onClick={() => {
                  if (confirm("¿Cancelar este pedido? El stock de sus productos se devolverá.")) {
                    run(o.id, "cancel_order");
                  }
                }}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
        {o.estado === "preparando" && !o.courier_id && (
          <p className="text-xs text-amber-700">Esperando que un repartidor acepte la entrega.</p>
        )}
        <OrderDetails orderId={o.id} show={{ cliente: true }} />
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-600">{error}</p>}

      <section>
        <h2 className="mb-3 text-lg font-medium">Pedidos activos ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-neutral-500">No tienes pedidos activos.</p>
        ) : (
          <div className="flex flex-col gap-3">{active.map(renderOrder)}</div>
        )}
      </section>

      {finished.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Entregados y cancelados</h2>
          <div className="flex flex-col gap-3">{finished.map(renderOrder)}</div>
        </section>
      )}
    </div>
  );
}
