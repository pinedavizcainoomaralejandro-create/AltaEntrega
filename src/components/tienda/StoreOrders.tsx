"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import { ORDER_STATUS_LABEL } from "@/lib/orderStatus";
import type { OrderStatus } from "@/types/database";
import OrderDetails from "@/components/pedidos/OrderDetails";
import { formatFecha } from "@/lib/format";

type PendingTransfer = {
  id: string;
  codigo: string;
  subtotal: number;
  pago_referencia: string | null;
  comprobante_path: string | null;
  created_at: string;
};

type StoreOrder = {
  codigo: string;
  subtotal: number;
  metodo_pago: string;
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
  const [porConfirmar, setPorConfirmar] = useState<PendingTransfer[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from("orders")
      .select("id, codigo, subtotal, metodo_pago, direccion_entrega, estado, courier_id, created_at")
      .eq("store_id", storeId)
      // Solo pedidos pagados: los que esperan pago, se rechazaron o expiraron
      // nunca le llegaron a la tienda.
      .in("estado_pago", ["pagado", "reembolso_pendiente", "reembolsado"])
      .order("created_at", { ascending: false })
      .limit(100);

    if (queryError) {
      setError(friendlyDbError(queryError, "No se pudieron cargar los pedidos."));
      return;
    }
    const rows = data ?? [];

    // Fase 1: transferencias de clientes que el negocio debe confirmar.
    const { data: transfers } = await supabase
      .from("orders")
      .select("id, codigo, subtotal, pago_referencia, comprobante_path, created_at")
      .eq("store_id", storeId)
      .eq("estado", "esperando_pago")
      .eq("estado_pago", "por_confirmar")
      .order("created_at", { ascending: true });
    setPorConfirmar(transfers ?? []);

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

  async function verComprobante(path: string | null) {
    if (!path) return;
    const { data, error: signError } = await supabase.storage.from("comprobantes").createSignedUrl(path, 600);
    if (signError || !data) {
      setError("No se pudo abrir el comprobante.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  }

  async function revisarTransferencia(orderId: string, aprobar: boolean) {
    let motivo: string | null = null;
    if (!aprobar) {
      motivo = prompt("¿Por qué rechazas la transferencia? (el cliente lo verá)");
      if (motivo === null) return;
    } else if (!confirm("¿Confirmas que el dinero ya está en tu cuenta?")) {
      return;
    }
    setError(null);
    setBusyId(orderId);
    const { error: rpcError } = await supabase.rpc("store_review_transfer", {
      p_order_id: orderId,
      p_aprobar: aprobar,
      p_motivo: motivo ?? undefined,
    });
    setBusyId(null);
    if (rpcError) setError(friendlyDbError(rpcError));
    refresh();
  }

  async function run(orderId: string, fn: "store_advance_order" | "cancel_order") {
    setError(null);
    setBusyId(orderId);
    const { error: rpcError } = await supabase.rpc(fn, { p_order_id: orderId });
    setBusyId(null);
    if (rpcError) setError(friendlyDbError(rpcError));
    refresh();
  }

  if (orders === null) {
    return error ? <p className="text-sm text-red-600">{error}</p> : <p className="text-sm text-stone-500">Cargando...</p>;
  }

  const active = orders.filter((o) => ACTIVE.includes(o.estado));
  const finished = orders.filter((o) => !ACTIVE.includes(o.estado));

  const renderOrder = (o: StoreOrder) => {
    const nextLabel = NEXT_LABEL[o.estado];
    return (
      <div key={o.id} className="flex flex-col gap-2 card p-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium">
              {o.codigo} · {ORDER_STATUS_LABEL[o.estado]}
            </p>
            <p className="truncate text-sm text-stone-500">Entregar en: {o.direccion_entrega}</p>
            <p className="text-xs text-stone-400">
              {formatFecha(o.created_at)} ·{" "}
              {o.montoTienda !== null
                ? `recibes RD$${o.montoTienda.toFixed(2)}`
                : o.metodo_pago === "transferencia"
                  ? `te transfirió RD$${o.subtotal.toFixed(2)}`
                  : "pagado contra entrega"}{" "}
              ·{" "}
              {o.courier_id ? "repartidor asignado" : "sin repartidor"}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {nextLabel && (
              <button
                type="button"
                disabled={busyId === o.id}
                onClick={() => run(o.id, "store_advance_order")}
                className="btn-primary btn-sm"
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
                className="btn-danger btn-sm"
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

      {porConfirmar.length > 0 && (
        <section className="rounded-2xl border border-sol-200 bg-sol-50 p-4">
          <h2 className="mb-1 font-display text-xl font-semibold">Transferencias por confirmar ({porConfirmar.length})</h2>
          <p className="mb-3 text-sm text-stone-600">
            Revisa en tu banco que el dinero llegó antes de confirmar. Al confirmar, el pedido entra a tus pedidos activos.
          </p>
          <div className="flex flex-col gap-3">
            {porConfirmar.map((t) => (
              <div key={t.id} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm">
                  <p className="font-medium">
                    Pedido {t.codigo} · <span className="font-display text-lg">RD${t.subtotal.toFixed(2)}</span>
                  </p>
                  <p className="text-xs text-stone-500">
                    {formatFecha(t.created_at)} · ref. {t.pago_referencia ?? "—"}
                  </p>
                  <button type="button" onClick={() => verComprobante(t.comprobante_path)} className="link mt-1 text-xs">
                    Ver comprobante
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => revisarTransferencia(t.id, true)}
                    className="btn-primary btn-sm"
                  >
                    Confirmar pago
                  </button>
                  <button
                    type="button"
                    disabled={busyId === t.id}
                    onClick={() => revisarTransferencia(t.id, false)}
                    className="btn-danger btn-sm"
                  >
                    No llegó
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold">Pedidos activos ({active.length})</h2>
        {active.length === 0 ? (
          <p className="text-sm text-stone-500">No tienes pedidos activos.</p>
        ) : (
          <div className="flex flex-col gap-3">{active.map(renderOrder)}</div>
        )}
      </section>

      {finished.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl font-semibold">Entregados y cancelados</h2>
          <div className="flex flex-col gap-3">{finished.map(renderOrder)}</div>
        </section>
      )}
    </div>
  );
}
