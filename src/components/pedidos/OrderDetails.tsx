"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyDbError } from "@/lib/errors";
import type { OrderContacts } from "@/types/database";

type Item = { id: string; cantidad: number; precio_unitario: number; nombre: string };

function formatTelefono(tel: string | null) {
  if (!tel) return null;
  return tel.length === 10 ? `${tel.slice(0, 3)}-${tel.slice(3, 6)}-${tel.slice(6)}` : tel;
}

/**
 * Productos y contactos de un pedido, para los paneles de tienda y repartidor.
 * Se carga al abrirlo para no consultar todos los pedidos de la lista.
 */
export default function OrderDetails({
  orderId,
  show,
}: {
  orderId: string;
  show: { cliente?: boolean; tienda?: boolean };
}) {
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[] | null>(null);
  const [contacts, setContacts] = useState<OrderContacts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || items) return;

    (async () => {
      const [{ data: rows, error: itemsError }, { data: contactRows, error: contactsError }] = await Promise.all([
        supabase.from("order_items").select("id, product_id, cantidad, precio_unitario").eq("order_id", orderId),
        supabase.rpc("get_order_contacts", { p_order_id: orderId }),
      ]);

      if (itemsError || contactsError) {
        setError(friendlyDbError((itemsError ?? contactsError)!, "No se pudo cargar el detalle del pedido."));
        return;
      }

      const productIds = (rows ?? []).map((r) => r.product_id);
      const { data: products } = productIds.length
        ? await supabase.from("catalog_products").select("id, nombre").in("id", productIds)
        : { data: [] as { id: string; nombre: string }[] };
      const nameById = new Map((products ?? []).map((p) => [p.id, p.nombre] as const));

      setItems(
        (rows ?? []).map((r) => ({
          id: r.id,
          cantidad: r.cantidad,
          precio_unitario: r.precio_unitario,
          nombre: nameById.get(r.product_id) ?? "Producto",
        }))
      );
      setContacts(contactRows?.[0] ?? null);
    })();
  }, [open, items, orderId, supabase]);

  return (
    <div className="text-sm">
      <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-neutral-600 underline">
        {open ? "Ocultar detalle" : "Ver detalle"}
      </button>

      {open && (
        <div className="mt-2 flex flex-col gap-2 rounded-md bg-neutral-50 p-3">
          {error && <p className="text-red-600">{error}</p>}
          {!error && !items && <p className="text-neutral-500">Cargando...</p>}

          {items && (
            <ul className="flex flex-col gap-0.5 text-neutral-700">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {i.cantidad}× {i.nombre}
                  </span>
                  <span className="shrink-0">RD${(i.precio_unitario * i.cantidad).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          )}

          {contacts && show.tienda && (
            <p className="text-neutral-600">
              <span className="font-medium">Recoger en:</span> {contacts.tienda_nombre}, {contacts.tienda_direccion}
              {contacts.tienda_telefono && (
                <>
                  {" · "}
                  <a href={`tel:${contacts.tienda_telefono}`} className="underline">
                    {formatTelefono(contacts.tienda_telefono)}
                  </a>
                </>
              )}
            </p>
          )}

          {contacts && show.cliente && (
            <p className="text-neutral-600">
              <span className="font-medium">Cliente:</span> {contacts.cliente_nombre}
              {contacts.cliente_telefono ? (
                <>
                  {" · "}
                  <a href={`tel:${contacts.cliente_telefono}`} className="underline">
                    {formatTelefono(contacts.cliente_telefono)}
                  </a>
                </>
              ) : (
                " · teléfono no disponible"
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
