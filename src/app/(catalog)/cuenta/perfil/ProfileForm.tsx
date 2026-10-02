"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { updateProfileAction, type AccountFormState } from "../actions";

const initialState: AccountFormState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-primary w-full">
      {pending ? "Guardando..." : "Guardar cambios"}
    </button>
  );
}

export default function ProfileForm({ nombre, telefono }: { nombre: string; telefono: string }) {
  const [state, formAction] = useActionState(updateProfileAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <div>
        <label htmlFor="nombre" className="label">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
          defaultValue={state.values?.nombre ?? nombre}
          className="input"
        />
      </div>

      <div>
        <label htmlFor="telefono" className="label">
          Teléfono <span className="font-normal text-stone-400">(opcional)</span>
        </label>
        <input
          id="telefono"
          name="telefono"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="809-555-1234"
          defaultValue={state.values?.telefono ?? telefono}
          className="input"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.message && <p className="text-sm text-monte-700">{state.message}</p>}

      <SubmitButton />
    </form>
  );
}
