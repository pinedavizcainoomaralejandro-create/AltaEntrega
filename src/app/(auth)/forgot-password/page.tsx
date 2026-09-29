"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { requestPasswordResetAction, type ForgotPasswordState } from "../actions";

const initialState: ForgotPasswordState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Enviando..." : "Enviar enlace"}
    </button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(requestPasswordResetAction, initialState);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-semibold">Restablecer contraseña</h1>
        <p className="text-sm text-neutral-500">
          Ingresa tu email y te enviaremos un enlace para crear una nueva contraseña.
        </p>
      </div>

      {state?.message ? (
        <p className="rounded-md bg-green-50 p-3 text-sm text-green-800">{state.message}</p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-md border border-neutral-300 px-3 py-2"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <SubmitButton />
        </form>
      )}

      <p className="text-center text-sm text-neutral-500">
        <Link href="/login" className="font-medium text-neutral-900 underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </div>
  );
}
