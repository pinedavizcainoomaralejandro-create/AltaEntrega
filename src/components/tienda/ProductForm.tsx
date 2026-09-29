"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { ProductRow } from "@/types/database";
import type { ProductFormState } from "@/app/dashboard/tienda/productos/actions";

const initialState: ProductFormState = { error: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

export default function ProductForm({
  action,
  product,
  onDone,
  submitLabel,
}: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  product?: ProductRow;
  onDone: () => void;
  submitLabel: string;
}) {
  const [state, formAction] = useFormState(action, initialState);

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div>
        <label className="mb-1 block text-sm font-medium">Nombre</label>
        <input
          name="nombre"
          required
          defaultValue={product?.nombre}
          className="w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Descripción</label>
        <textarea
          name="descripcion"
          defaultValue={product?.descripcion ?? ""}
          rows={2}
          className="w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Precio</label>
          <input
            name="precio"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={product?.precio}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Stock</label>
          <input
            name="stock"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={product?.stock ?? 0}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Talla</label>
          <input
            name="talla"
            defaultValue={product?.talla ?? ""}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Color</label>
          <input
            name="color"
            defaultValue={product?.color ?? ""}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Foto <span className="font-normal text-neutral-500">(JPG, PNG o WebP, máx. 5 MB)</span>{" "}
          {product?.foto && "— deja vacío para conservar la actual"}
        </label>
        <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm"
        >
          Cancelar
        </button>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
