"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { updatePasswordAction, type ResetPasswordState } from "../actions";
import HomeLink from "@/components/HomeLink";

const initialState: ResetPasswordState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Guardando..." : "Guardar nueva contraseña"}
    </button>
  );
}

export default function ResetPasswordPage() {
  const [state, formAction] = useActionState(updatePasswordAction, initialState);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <HomeLink className="self-start" />
      <div>
        <h1 className="text-2xl font-semibold">Crea una nueva contraseña</h1>
        <p className="text-sm text-neutral-500">Elige una contraseña nueva para tu cuenta.</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">
            Nueva contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>
    </div>
  );
}
