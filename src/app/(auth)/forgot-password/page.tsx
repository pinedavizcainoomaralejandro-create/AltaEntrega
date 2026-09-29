"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetAction, type ForgotPasswordState } from "../actions";
import AuthShell from "@/components/brand/AuthShell";

const initialState: ForgotPasswordState = { error: null, message: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-primary w-full"
    >
      {pending ? "Enviando..." : "Enviar enlace"}
    </button>
  );
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(requestPasswordResetAction, initialState);

  return (
    <AuthShell
      title="¿Olvidaste tu contraseña?"
      subtitle="Escribe tu email y te enviaremos un enlace para crear una nueva."
    >

      {state?.message ? (
        <p className="rounded-xl bg-green-50 p-3 text-sm text-green-800">{state.message}</p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <div>
            <label htmlFor="email" className="label">
              Email
            </label>
            <input
              id="email"
              name="email" defaultValue={state.values?.email}
              type="email"
              required
              className="input"
            />
          </div>

          {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

          <SubmitButton />
        </form>
      )}

      <p className="text-center text-sm text-stone-500">
        <Link href="/login" className="link">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthShell>
  );
}
