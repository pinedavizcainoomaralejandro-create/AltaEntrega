"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import Link from "next/link";
import { signUpAction, type AuthFormState } from "../actions";
import HomeLink from "@/components/HomeLink";

const initialState: AuthFormState = { error: null };

const ROLES = [
  { value: "cliente", label: "Cliente" },
  { value: "tienda", label: "Tienda" },
  { value: "courier", label: "Delivery" },
] as const;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-900 px-4 py-2 text-white disabled:opacity-50"
    >
      {pending ? "Creando cuenta..." : "Crear cuenta"}
    </button>
  );
}

export default function RegisterPage() {
  const [state, formAction] = useActionState(signUpAction, initialState);

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <HomeLink className="self-start" />
      <div>
        <h1 className="text-2xl font-semibold">Crear cuenta en AltaEntrega</h1>
        <p className="text-sm text-neutral-500">
          Si te registras como Tienda o Delivery, luego completarás un perfil
          que debe ser aprobado por un administrador.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Quiero registrarme como</label>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center justify-center rounded-md border border-neutral-300 p-2 text-sm has-[:checked]:border-neutral-900 has-[:checked]:bg-neutral-900 has-[:checked]:text-white"
              >
                <input
                  type="radio"
                  name="rol"
                  value={r.value}
                  defaultChecked={r.value === (state.values?.rol ?? "cliente")}
                  className="sr-only"
                />
                {r.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label htmlFor="nombre" className="mb-1 block text-sm font-medium">Nombre</label>
          <input id="nombre" name="nombre" defaultValue={state.values?.nombre} required minLength={2} maxLength={80} autoComplete="name" className="w-full rounded-md border border-neutral-300 px-3 py-2" />
        </div>

        <div>
          <label htmlFor="telefono" className="mb-1 block text-sm font-medium">
            Teléfono <span className="font-normal text-neutral-500">(opcional)</span>
          </label>
          <input
            id="telefono"
            name="telefono" defaultValue={state.values?.telefono}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="809-555-1234"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium">Email</label>
          <input id="email" name="email" defaultValue={state.values?.email} type="email" required autoComplete="email" className="w-full rounded-md border border-neutral-300 px-3 py-2" />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
          <p className="mt-1 text-xs text-neutral-500">Mínimo 8 caracteres, con letras y números.</p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-1 block text-sm font-medium">Confirmar contraseña</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>

      <p className="text-center text-sm text-neutral-500">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-neutral-900 underline">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
