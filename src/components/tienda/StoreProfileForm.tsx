"use client";

import { useEffect, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { StoreRow } from "@/types/database";
import { updateStoreProfileAction, type StoreProfileFormState } from "@/app/dashboard/tienda/perfil/actions";

const initialState: StoreProfileFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white disabled:opacity-50"
    >
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
}

export default function StoreProfileForm({ store }: { store: StoreRow }) {
  const [state, formAction] = useFormState(updateStoreProfileAction, initialState);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.success) setSaved(true);
  }, [state]);

  return (
    <form
      action={(fd) => {
        setSaved(false);
        return formAction(fd);
      }}
      className="flex max-w-md flex-col gap-4"
    >
      <div>
        <span className="mb-1 block text-sm font-medium">Estado</span>
        <span className="inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
          {store.estado}
        </span>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Nombre de la tienda</label>
        <input
          name="nombre"
          required
          defaultValue={store.nombre}
          className="w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Dirección</label>
        <input
          name="direccion"
          required
          defaultValue={store.direccion}
          className="w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Categoría</label>
        <input
          name="categoria"
          required
          defaultValue={store.categoria}
          className="w-full rounded-md border border-neutral-300 px-3 py-2"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Logo <span className="font-normal text-neutral-500">(JPG, PNG o WebP, máx. 5 MB)</span>{" "}
          {store.logo && "— deja vacío para conservar el actual"}
        </label>
        {store.logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={store.logo} alt="Logo actual" className="mb-2 h-16 w-16 rounded object-cover" />
        )}
        <input name="logo" type="file" accept="image/jpeg,image/png,image/webp" className="w-full text-sm" />
      </div>

      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      {saved && <p className="text-sm text-green-600">Perfil actualizado.</p>}

      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
