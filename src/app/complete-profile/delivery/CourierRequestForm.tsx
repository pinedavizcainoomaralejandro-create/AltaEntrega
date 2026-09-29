"use client";

import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { createCourierProfileAction, type ProfileFormState } from "../actions";
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

export type CourierRequestInitial = { vehiculo: string; documento_identidad: string; matricula: string } | null;

export default function CourierRequestForm({ initial }: { initial: CourierRequestInitial }) {
  const [state, formAction] = useActionState(createCourierProfileAction, initialState);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4">
      <HomeLink className="self-start" />
      <div>
        <h1 className="text-2xl font-semibold">
          {initial ? "Corrige tus datos de repartidor" : "Completa tu perfil de repartidor"}
        </h1>
        {initial && (
          <p className="text-sm text-amber-700">
            Tu solicitud fue rechazada. Revisa los datos y envíala de nuevo.
          </p>
        )}
        <p className="text-sm text-neutral-500">
          Necesitamos verificar tu identidad con tu cédula y la matrícula de tu vehículo
          antes de aprobarte. Cada documento y matrícula solo puede usarse en una cuenta.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label htmlFor="vehiculo" className="mb-1 block text-sm font-medium">Vehículo</label>
          <input id="vehiculo" name="vehiculo" required maxLength={60} defaultValue={state.values?.vehiculo ?? initial?.vehiculo} placeholder="Motocicleta, bicicleta, carro..." className="w-full rounded-md border border-neutral-300 px-3 py-2" />
        </div>

        <div>
          <label htmlFor="documento_identidad" className="mb-1 block text-sm font-medium">Cédula</label>
          <input
            id="documento_identidad"
            name="documento_identidad"
            required
            defaultValue={state.values?.documento_identidad ?? initial?.documento_identidad}
            placeholder="000-0000000-0"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="matricula" className="mb-1 block text-sm font-medium">Matrícula del vehículo</label>
          <input
            id="matricula"
            name="matricula"
            required
            defaultValue={state.values?.matricula ?? initial?.matricula}
            placeholder="Matrícula/placa"
            className="w-full rounded-md border border-neutral-300 px-3 py-2"
          />
        </div>

        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}

        <SubmitButton />
      </form>
    </div>
  );
}
