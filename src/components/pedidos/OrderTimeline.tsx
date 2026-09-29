"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORDER_STATUS_LABEL } from "@/lib/orderStatus";
import { friendlyDbError } from "@/lib/errors";
import type { OrderStatusHistoryRow } from "@/types/database";

export default function OrderTimeline({
  orderId,
  initialHistory,
}: {
  orderId: string;
  initialHistory: OrderStatusHistoryRow[];
}) {
  const supabase = useMemo(() => createClient(), []);
  const [history, setHistory] = useState<OrderStatusHistoryRow[]>(initialHistory);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from("order_status_history")
      .select("*")
      .eq("order_id", orderId)
      .order("fecha", { ascending: true });

    if (data) setHistory(data);
  }, [supabase, orderId]);

  useEffect(() => {
    const channel = supabase
      .channel(`order-history-${orderId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "order_status_history", filter: `order_id=eq.${orderId}` },
        () => refresh()
      )
      // Refresca al quedar suscrito: un cambio entre el render del servidor y la
      // suscripción no llega por Realtime.
      .subscribe((status) => {
        if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") refresh();
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, supabase, orderId]);

  const current = history[history.length - 1]?.estado;

  async function handleCancel() {
    if (!confirm("¿Cancelar tu pedido?")) return;
    setError(null);
    setCancelling(true);
    const { error: rpcError } = await supabase.rpc("cancel_order", { p_order_id: orderId });
    setCancelling(false);
    if (rpcError) setError(friendlyDbError(rpcError));
    refresh();
  }

  return (
    <div>
      {current && (
        <p className="mb-4 inline-block rounded-full bg-neutral-900 px-3 py-1 text-sm font-medium text-white">
          Estado actual: {ORDER_STATUS_LABEL[current]}
        </p>
      )}

      {current === "pendiente" && (
        <div className="mb-4">
          <button
            type="button"
            disabled={cancelling}
            onClick={handleCancel}
            className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 disabled:opacity-50"
          >
            {cancelling ? "Cancelando..." : "Cancelar pedido"}
          </button>
          <p className="mt-1 text-xs text-neutral-500">Puedes cancelarlo mientras la tienda no lo haya confirmado.</p>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {history.length === 0 ? (
        <p className="text-sm text-neutral-500">Todavía no hay actualizaciones de estado.</p>
      ) : (
        <ol className="flex flex-col gap-4 border-l border-neutral-200 pl-4">
          {history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-neutral-900" />
              <p className="font-medium">{ORDER_STATUS_LABEL[h.estado]}</p>
              <p className="text-xs text-neutral-400">
                {new Date(h.fecha).toLocaleString("es-DO")}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
