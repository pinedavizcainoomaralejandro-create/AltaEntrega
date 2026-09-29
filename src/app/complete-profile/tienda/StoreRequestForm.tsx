"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { createStoreProfileAction, type ProfileFormState } from "../actions";
import HomeLink from "@/components/HomeLink";

const initialState: ProfileFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Enviando..." : "Enviar para aprobación"}
    </button>
  );
}

export type StoreRequestInitial = { nombre: string; direccion: string; categoria: string } | null;

export default function StoreRequestForm({ initial }: { initial: StoreRequestInitial }) {
  const [state, formAction] = useActionState(createStoreProfileAction, initialState);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <HomeLink className="self-start" />
      <div>
        <h1 className="text-2xl font-semibold">
          {initial ? "Corrige los datos de tu tienda" : "Completa el perfil de tu tienda"}
        </h1>
        <p className="text-sm text-neutral-500">
          {initial
            ? "Tu solicitud fue rechazada. Revisa los datos y envíala de nuevo para que un administrador la revise."
            : "Un administrador revisará estos datos antes de que puedas publicar productos."}
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="nombre" className="mb-1 block text-sm font-medium">Nombre de la tienda</label>
          <input id="nombre" name="nombre" required maxLength={80} defaultValue={state.values?.nombre ?? initial?.nombre} className="w-full rounded-md border border-neutral-300 px-3 py-2" />
        </div>

        <div>
          <label htmlFor="direccion" className="mb-1 block text-sm font-medium">Dirección</label>
          <input id="direccion" name="direccion" required maxLength={200} defaultValue={state.values?.direccion ?? initial?.direccion} placeholder="Villa Altagracia..." className="w-full rounded-md border border-neutral-300 px-3 py-2" />
        </div>

        <div>
          <label htmlFor="categoria" className="mb-1 block text-sm font-medium">Categoría</label>
          <input id="categoria" name="categoria" required maxLength={60} defaultValue={state.values?.categoria ?? initial?.categoria} placeholder="Ropa, calzado, accesorios..." className="w-full rounded-md border border-neutral-300 px-3 py-2" />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>
    </div>
  );
}
