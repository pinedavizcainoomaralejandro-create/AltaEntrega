"use client";

import { useState, useActionState } from "react";
import Image from "next/image";
import type { ProductRow } from "@/types/database";
import {
  createProductAction,
  updateProductAction,
  deleteProductAction,
  reactivateProductAction,
  type DeleteProductState,
} from "@/app/dashboard/tienda/productos/actions";
import ProductForm from "./ProductForm";

const initialDeleteState: DeleteProductState = { error: null };

function DeleteButton({ productId }: { productId: string }) {
  const [state, formAction] = useActionState(deleteProductAction, initialDeleteState);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (
          !confirm(
            "¿Eliminar este producto? Si ya tiene ventas, se ocultará del catálogo en lugar de borrarse."
          )
        ) {
          e.preventDefault();
        }
      }}
      className="text-right"
    >
      <input type="hidden" name="id" value={productId} />
      <button type="submit" className="text-sm font-medium text-red-600 hover:underline">
        Eliminar
      </button>
      {state.error && <p className="mt-1 text-xs text-red-600">{state.error}</p>}
    </form>
  );
}

function ReactivateButton({ productId }: { productId: string }) {
  return (
    <form action={reactivateProductAction}>
      <input type="hidden" name="id" value={productId} />
      <button type="submit" className="text-sm text-monte-700 underline">
        Reactivar
      </button>
    </form>
  );
}

export default function ProductManager({ products, categoria }: { products: ProductRow[]; categoria: string }) {
  const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; product: ProductRow }>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold">Productos ({products.length})</h2>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="btn-primary"
        >
          + Nuevo producto
        </button>
      </div>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-stone-300 bg-white/60 p-10 text-center text-sm text-stone-500">
          Todavía no tienes productos. Crea el primero.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="flex flex-col overflow-hidden card">
              <div className="relative aspect-square bg-stone-100">
                {p.foto ? (
                  <Image src={p.foto} alt={p.nombre} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-stone-400">
                    Sin foto
                  </div>
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                  {!p.activo && (
                    <span className="rounded bg-stone-600 px-2 py-0.5 text-xs font-medium text-white">
                      Oculto
                    </span>
                  )}
                  {p.agotado && (
                    <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-medium text-white">
                      Agotado
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 p-3">
                <p className="font-medium">{p.nombre}</p>
                <p className="text-sm text-stone-500">
                  {[p.talla, p.color].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-sm">
                  Recibes RD${p.precio.toFixed(2)} · stock: {p.stock}
                </p>
                {!p.activo && (
                  <p className="text-xs text-stone-500">
                    Tiene ventas, así que se ocultó del catálogo en lugar de borrarse.
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <button
                    onClick={() => setModal({ mode: "edit", product: p })}
                    className="link text-sm"
                  >
                    Editar
                  </button>
                  {p.activo ? <DeleteButton productId={p.id} /> : <ReactivateButton productId={p.id} />}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5">
            <h3 className="mb-4 text-lg font-medium">
              {modal.mode === "create" ? "Nuevo producto" : "Editar producto"}
            </h3>
            {modal.mode === "create" ? (
              <ProductForm
                categoria={categoria}
                action={createProductAction}
                onDone={() => setModal(null)}
                submitLabel="Crear producto"
              />
            ) : (
              <ProductForm
                categoria={categoria}
                action={updateProductAction}
                product={modal.product}
                onDone={() => setModal(null)}
                submitLabel="Guardar cambios"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
