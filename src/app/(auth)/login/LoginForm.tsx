"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { loginAction, type AuthFormState } from "../actions";
import HomeLink from "@/components/HomeLink";
import PasswordInput from "@/components/PasswordInput";

const initialState: AuthFormState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Ingresando..." : "Ingresar"}
    </button>
  );
}

export default function LoginForm() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const params = useSearchParams();
  const checkEmail = params.get("check_email") === "1";
  const linkError = params.get("link_error") === "1";
  const redirectTo = params.get("redirect") ?? "";

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <HomeLink className="self-start" />
      <h1 className="text-2xl font-semibold">Ingresar a AltaEntrega</h1>

      {checkEmail && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          Revisa tu correo para confirmar la cuenta antes de iniciar sesión.
        </p>
      )}

      {linkError && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          El enlace del correo expiró o ya se usó. Si ya confirmaste tu cuenta, inicia sesión; si no,
          regístrate de nuevo o solicita otro enlace.
        </p>
      )}

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirect" value={redirectTo} />
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="email" name="email" defaultValue={state.values?.email} type="email" required className="w-full rounded-md border border-neutral-300 px-3 py-2" />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between">
            <label htmlFor="password" className="block text-sm font-medium">Contraseña</label>
            <Link href="/forgot-password" className="text-xs text-neutral-500 underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </div>
          <PasswordInput id="password" name="password" required className="w-full rounded-md border border-neutral-300 px-3 py-2" />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-neutral-500">
        ¿No tienes cuenta?{" "}
        <Link href="/register" className="font-medium text-neutral-900 underline">
          Regístrate
        </Link>
      </p>
    </div>
  );
}
