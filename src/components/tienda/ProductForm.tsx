"use client";

import { useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
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
  const [state, formAction] = useActionState(action, initialState);

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
          maxLength={120} name="nombre"
          required
          defaultValue={state.values?.nombre ?? product?.nombre}
          className="w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Descripción</label>
        <textarea
          maxLength={1000} name="descripcion"
          defaultValue={state.values?.descripcion ?? product?.descripcion ?? ""}
          rows={2}
          className="w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Tu precio (RD$ que recibes por unidad)</label>
          <input
            max="1000000" name="precio"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={state.values?.precio ?? product?.precio}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Stock</label>
          <input
            max="100000" name="stock"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={state.values?.stock ?? product?.stock ?? 0}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium">Talla</label>
          <input
            maxLength={40} name="talla"
            defaultValue={state.values?.talla ?? product?.talla ?? ""}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Color</label>
          <input
            maxLength={40} name="color"
            defaultValue={state.values?.color ?? product?.color ?? ""}
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
