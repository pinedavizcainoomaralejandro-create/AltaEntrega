"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { createStoreProfileAction, type ProfileFormState } from "../actions";
import AuthShell from "@/components/brand/AuthShell";
import CategoryPicker from "@/components/tienda/CategoryPicker";

const initialState: ProfileFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full"
    >
      {pending ? "Enviando..." : "Enviar para aprobación"}
    </button>
  );
}

export type StoreRequestInitial = { nombre: string; direccion: string; categoria: string } | null;

export default function StoreRequestForm({ initial }: { initial: StoreRequestInitial }) {
  const [state, formAction] = useActionState(createStoreProfileAction, initialState);

  return (
    <AuthShell
      title={initial ? "Corrige los datos de tu negocio" : "Cuéntanos de tu negocio"}
      subtitle={
        initial
          ? "Tu solicitud fue rechazada. Revisa los datos y envíala de nuevo para que un administrador la revise."
          : "Un administrador revisará estos datos antes de que puedas publicar tus productos."
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="nombre" className="label">Nombre del negocio</label>
          <input id="nombre" name="nombre" required maxLength={80} defaultValue={state.values?.nombre ?? initial?.nombre} className="input" />
        </div>

        <div>
          <label htmlFor="direccion" className="label">Dirección</label>
          <input id="direccion" name="direccion" required maxLength={200} defaultValue={state.values?.direccion ?? initial?.direccion} placeholder="Calle, número, sector (Villa Altagracia)" className="input" />
        </div>

        <CategoryPicker defaultValue={state.values?.categoria ?? initial?.categoria} />

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>
    </AuthShell>
  );
}
