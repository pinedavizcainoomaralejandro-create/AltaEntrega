"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import type { OrderStatus } from "@/types/database";

type AssignedOrder = {
  id: string;
  store_id: string;
  direccion_entrega: string;
  total: number;
  metodo_pago: string;
  estado: OrderStatus;
  created_at: string;
  storeNombre: string;
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pendiente: "Confirmar pedido",
  confirmado: "Marcar en preparación",
  preparando: "Salir en camino",
  en_camino: "Marcar entregado",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
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
      .select("id, store_id, direccion_entrega, total, metodo_pago, estado, created_at")
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
    refresh();

    const channel = supabase
      .channel(`orders-mine-${courierId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `courier_id=eq.${courierId}` },
        () => refresh()
      )
      .subscribe();

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
    return <p className="text-sm text-neutral-500">Cargando...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no tienes entregas asignadas.</p>
      ) : (
        orders.map((o) => {
          const nextLabel = NEXT_LABEL[o.estado];
          return (
            <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3">
              <div className="min-w-0">
                <p className="font-medium">{o.storeNombre}</p>
                <p className="truncate text-sm text-neutral-500">{o.direccion_entrega}</p>
                <p className="text-xs text-neutral-400">
                  RD${o.total.toFixed(2)} · {o.metodo_pago} · {STATUS_LABEL[o.estado]}
                </p>
              </div>
              {nextLabel ? (
                <button
                  type="button"
                  disabled={advancingId === o.id}
                  onClick={() => handleAdvance(o.id)}
                  className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
                >
                  {advancingId === o.id ? "Actualizando..." : nextLabel}
                </button>
              ) : (
                <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  Entregado
                </span>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
