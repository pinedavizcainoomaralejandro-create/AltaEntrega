"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { StoreRow } from "@/types/database";
import { updateStoreProfileAction, type StoreProfileFormState } from "@/app/dashboard/tienda/perfil/actions";

const initialState: StoreProfileFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary"
    >
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
}

export default function StoreProfileForm({ store }: { store: StoreRow }) {
  const [state, formAction] = useActionState(updateStoreProfileAction, initialState);
  const saved = Boolean(state.success);

  return (
    <form
      action={formAction}
      className="flex max-w-md flex-col gap-4"
    >
      <div>
        <span className="label">Estado</span>
        <span className="inline-block rounded-full bg-monte-100 px-3 py-1 text-xs font-medium text-monte-800">
          {store.estado}
        </span>
      </div>

      <div>
        <label className="label">Nombre de la tienda</label>
        <input
          name="nombre"
          required
          readOnly
          defaultValue={store.nombre}
          className="input"
        />
      </div>

      <div>
        <label className="label">Dirección</label>
        <input
          name="direccion"
          required
          readOnly
          defaultValue={store.direccion}
          className="input"
        />
        <p className="mt-1 text-xs text-stone-500">
          El nombre y la dirección fueron verificados por un administrador. Para cambiarlos, contacta a soporte.
        </p>
      </div>

      <div>
        <label className="label">Categoría</label>
        <input
          name="categoria"
          required
          defaultValue={state.values?.categoria ?? store.categoria}
          className="input"
        />
      </div>

      <div>
        <label className="label">
          Logo <span className="font-normal text-stone-500">(JPG, PNG o WebP, máx. 5 MB)</span>{" "}
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
