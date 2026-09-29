"use client";

import { useEffect, useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ProductRow } from "@/types/database";
import { etiquetasVariante } from "@/lib/categories";
import type { ProductFormState } from "@/app/dashboard/tienda/productos/actions";

const initialState: ProductFormState = { error: null };

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
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
  categoria,
}: {
  action: (state: ProductFormState, formData: FormData) => Promise<ProductFormState>;
  product?: ProductRow;
  onDone: () => void;
  submitLabel: string;
  categoria: string;
}) {
  const [state, formAction] = useActionState(action, initialState);
  const variante = etiquetasVariante(categoria);

  useEffect(() => {
    if (state.success) onDone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      {product && <input type="hidden" name="id" value={product.id} />}

      <div>
        <label className="label">Nombre</label>
        <input
          maxLength={120} name="nombre"
          required
          defaultValue={state.values?.nombre ?? product?.nombre}
          className="input"
        />
      </div>

      <div>
        <label className="label">Descripción</label>
        <textarea
          maxLength={1000} name="descripcion"
          defaultValue={state.values?.descripcion ?? product?.descripcion ?? ""}
          rows={2}
          className="input"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Tu precio (RD$ que recibes por unidad)</label>
          <input
            max="1000000" name="precio"
            type="number"
            step="0.01"
            min="0"
            required
            defaultValue={state.values?.precio ?? product?.precio}
            className="input"
          />
        </div>
        <div>
          <label className="label">Stock</label>
          <input
            max="100000" name="stock"
            type="number"
            min="0"
            step="1"
            required
            defaultValue={state.values?.stock ?? product?.stock ?? 0}
            className="input"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">{variante.talla}</label>
          <input
            maxLength={40} name="talla" placeholder={variante.tallaEjemplo}
            defaultValue={state.values?.talla ?? product?.talla ?? ""}
            className="input"
          />
        </div>
        <div>
          <label className="label">{variante.color}</label>
          <input
            maxLength={40} name="color" placeholder={variante.colorEjemplo}
            defaultValue={state.values?.color ?? product?.color ?? ""}
            className="input"
          />
        </div>
      </div>

      <div>
        <label className="label">
          Foto <span className="font-normal text-stone-500">(JPG, PNG o WebP, máx. 5 MB)</span>{" "}
          {product?.foto && "— deja vacío para conservar la actual"}
        </label>
        <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="btn-secondary"
        >
          Cancelar
        </button>
        <SubmitButton label={submitLabel} />
      </div>
    </form>
  );
}
