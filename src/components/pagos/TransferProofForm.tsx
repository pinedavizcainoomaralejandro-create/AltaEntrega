"use client";

import { useActionState } from "react";
import { submitOrderTransferAction, type TransferProofState } from "@/app/(catalog)/pagar/[orderId]/actions";

const initialState: TransferProofState = { error: null };

export default function TransferProofForm({ orderId }: { orderId: string }) {
  const [state, formAction, pending] = useActionState(submitOrderTransferAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="orderId" value={orderId} />
      <div>
        <label htmlFor="referencia" className="label">Referencia de la transferencia</label>
        <input id="referencia" name="referencia" required maxLength={100} placeholder="Número que te dio tu banco" className="input" />
      </div>
      <div>
        <label htmlFor="comprobante" className="label">
          Comprobante <span className="font-normal text-stone-500">(foto o PDF, máx. 5 MB)</span>
        </label>
        <input
          id="comprobante"
          name="comprobante"
          type="file"
          required
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-monte-50 file:px-3 file:py-2 file:font-semibold file:text-monte-700"
        />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn-accent w-full py-3 text-base">
        {pending ? "Enviando..." : "Ya transferí, enviar comprobante"}
      </button>
    </form>
  );
}
