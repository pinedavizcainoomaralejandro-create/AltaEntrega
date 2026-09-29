"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";

type PoolOrder = {
  id: string;
  store_id: string;
  direccion_entrega: string;
  total: number;
  metodo_pago: string;
  created_at: string;
  storeNombre: string;
  storeDireccion: string;
};

export default function OrdersPool() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<PoolOrder[] | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data: rows } = await supabase
      .from("orders")
      .select("id, store_id, direccion_entrega, total, metodo_pago, created_at")
      // La bolsa muestra pedidos ya confirmados por la tienda.
      .in("estado", ["confirmado", "preparando"])
      .is("courier_id", null)
      .order("created_at", { ascending: true });

    if (!rows || rows.length === 0) {
      setOrders([]);
      return;
    }

    const storeIds = Array.from(new Set(rows.map((r) => r.store_id)));
    const { data: stores } = await supabase.from("stores").select("id, nombre, direccion").in("id", storeIds);
    const storeById = new Map((stores ?? []).map((s) => [s.id, s] as const));

    setOrders(
      rows.map((r) => ({
        ...r,
        storeNombre: storeById.get(r.store_id)?.nombre ?? "Tienda",
        storeDireccion: storeById.get(r.store_id)?.direccion ?? "",
      }))
    );
  }, [supabase]);

  useEffect(() => {
    const channel = supabase
      .channel("orders-pool")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => refresh())
      // Carga al quedar suscrito (o si Realtime falla, para mostrar los datos igual).
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") refresh();
      });

    // Cuando otro repartidor toma un pedido, la fila deja de ser visible por RLS
    // para este usuario y Realtime no le envía ese cambio. Refrescar cada 15 s y
    // al volver a la pestaña saca de la lista los pedidos ya tomados.
    const interval = window.setInterval(refresh, 15_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      supabase.removeChannel(channel);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh, supabase]);

  async function handleAccept(orderId: string) {
    setError(null);
    setClaimingId(orderId);
    const { error: rpcError } = await supabase.rpc("claim_order", { p_order_id: orderId });
    setClaimingId(null);

    if (rpcError) {
      setError(friendlyDbError(rpcError));
      refresh();
      return;
    }

    setOrders((prev) => (prev ? prev.filter((o) => o.id !== orderId) : prev));
  }

  if (orders === null) {
    return <p className="text-sm text-neutral-500">Cargando...</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {error && <p className="text-sm text-red-600">{error}</p>}

      {orders.length === 0 ? (
        <p className="text-sm text-neutral-500">No hay pedidos disponibles por ahora.</p>
      ) : (
        orders.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 p-3">
            <div className="min-w-0">
              <p className="font-medium">{o.storeNombre}</p>
              <p className="truncate text-sm text-neutral-500">Recoger: {o.storeDireccion}</p>
              <p className="truncate text-sm text-neutral-500">Entregar: {o.direccion_entrega}</p>
              <p className="text-xs text-neutral-400">
                RD${o.total.toFixed(2)} · {o.metodo_pago}
              </p>
            </div>
            <button
              type="button"
              disabled={claimingId === o.id}
              onClick={() => handleAccept(o.id)}
              className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {claimingId === o.id ? "Aceptando..." : "Aceptar entrega"}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
