"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
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
  const [state, formAction] = useFormState(deleteProductAction, initialDeleteState);

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
      <button type="submit" className="text-sm text-red-600 underline">
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
      <button type="submit" className="text-sm text-green-700 underline">
        Reactivar
      </button>
    </form>
  );
}

export default function ProductManager({ products }: { products: ProductRow[] }) {
  const [modal, setModal] = useState<null | { mode: "create" } | { mode: "edit"; product: ProductRow }>(null);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium">Productos ({products.length})</h2>
        <button
          onClick={() => setModal({ mode: "create" })}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          + Nuevo producto
        </button>
      </div>

      {products.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
          Todavía no tienes productos. Crea el primero.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p) => (
            <div key={p.id} className="flex flex-col overflow-hidden rounded-lg border border-neutral-200">
              <div className="relative aspect-square bg-neutral-100">
                {p.foto ? (
                  <Image src={p.foto} alt={p.nombre} fill className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-neutral-400">
                    Sin foto
                  </div>
                )}
                <div className="absolute left-2 top-2 flex gap-1">
                  {!p.activo && (
                    <span className="rounded bg-neutral-600 px-2 py-0.5 text-xs font-medium text-white">
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
                <p className="text-sm text-neutral-500">
                  {[p.talla, p.color].filter(Boolean).join(" · ") || "—"}
                </p>
                <p className="text-sm">
                  RD${p.precio.toFixed(2)} · stock: {p.stock}
                </p>
                {!p.activo && (
                  <p className="text-xs text-neutral-500">
                    Tiene ventas, así que se ocultó del catálogo en lugar de borrarse.
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between pt-2">
                  <button
                    onClick={() => setModal({ mode: "edit", product: p })}
                    className="text-sm underline"
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
                action={createProductAction}
                onDone={() => setModal(null)}
                submitLabel="Crear producto"
              />
            ) : (
              <ProductForm
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
