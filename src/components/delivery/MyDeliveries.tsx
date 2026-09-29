"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import type { OrderStatus } from "@/types/database";
import OrderDetails from "@/components/pedidos/OrderDetails";

type AssignedOrder = {
  id: string;
  store_id: string;
  direccion_entrega: string;
  delivery_fee: number;
  estado: OrderStatus;
  created_at: string;
  storeNombre: string;
};

// El repartidor solo avanza desde "preparando"; antes, la tienda está confirmando y preparando.
const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  preparando: "Recogí el pedido, salgo en camino",
  en_camino: "Marcar entregado",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  esperando_pago: "Esperando pago",
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  preparando: "Preparando",
  en_camino: "En camino",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

export default function MyDeliveries({ courierId }: { courierId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<AssignedOrder[] | null>(null);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: rows } = await supabase
      .from("orders")
      .select("id, store_id, direccion_entrega, delivery_fee, estado, created_at")
      .eq("courier_id", courierId)
      .neq("estado", "cancelado")
      .order("created_at", { ascending: false });

    if (!rows || rows.length === 0) {
      setOrders([]);
      return;
    }

    const storeIds = Array.from(new Set(rows.map((r) => r.store_id)));
    const { data: stores } = await supabase.from("stores").select("id, nombre").in("id", storeIds);
    const nameById = new Map((stores ?? []).map((s) => [s.id, s.nombre] as const));

    setOrders(rows.map((r) => ({ ...r, storeNombre: nameById.get(r.store_id) ?? "Tienda" })));
  }, [supabase, courierId]);

  useEffect(() => {
    const channel = supabase
      .channel(`orders-mine-${courierId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `courier_id=eq.${courierId}` },
        () => refresh()
      )
      // Carga al quedar suscrito (así no se pierden cambios entre la carga y la
      // suscripción) y también si Realtime falla, para mostrar los datos igual.
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") refresh();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, supabase, courierId]);

  async function handleAdvance(orderId: string) {
    setError(null);
    setAdvancingId(orderId);
    const { error: rpcError } = await supabase.rpc("advance_order_status", { p_order_id: orderId });
    setAdvancingId(null);

    if (rpcError) {
      setError(friendlyDbError(rpcError));
      return;
    }
    refresh();
  }

  if (orders === null) {
    return <p className="text-sm text-stone-500">Cargando...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-sm text-stone-500">Todavía no tienes entregas asignadas.</p>
      ) : (
        orders.map((o) => {
          const nextLabel = NEXT_LABEL[o.estado];
          return (
            <div key={o.id} className="flex flex-col gap-2 card p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{o.storeNombre}</p>
                <p className="truncate text-sm text-stone-500">{o.direccion_entrega}</p>
                <p className="text-xs text-stone-400">
                  Cobra RD${o.delivery_fee.toFixed(2)} en efectivo · {STATUS_LABEL[o.estado]}
                </p>
              </div>
              {nextLabel ? (
                <button
                  type="button"
                  disabled={advancingId === o.id}
                  onClick={() => handleAdvance(o.id)}
                  className="shrink-0 btn-primary btn-sm"
                >
                  {advancingId === o.id ? "Actualizando..." : nextLabel}
                </button>
              ) : o.estado === "entregado" ? (
                <span className="shrink-0 rounded-full bg-monte-100 px-3 py-1 text-xs font-medium text-monte-800">
                  Entregado
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                  La tienda está preparando
                </span>
              )}
            </div>
            <OrderDetails orderId={o.id} show={{ tienda: true, cliente: true }} />
            </div>
          );
        })
      )}
    </div>
  );
}
