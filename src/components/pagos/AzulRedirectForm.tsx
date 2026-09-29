"use client";

import { useState } from "react";

/**
 * Formulario firmado hacia la Página de Pagos de AZUL. Los datos de la
 * tarjeta se escriben en AZUL, nunca en AltaEntrega.
 */
export default function AzulRedirectForm({
  form,
}: {
  form: { action: string; fields: Record<string, string> };
}) {
  const [sending, setSending] = useState(false);

  return (
    <form method="POST" action={form.action} onSubmit={() => setSending(true)} className="flex flex-col gap-2">
      {Object.entries(form.fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-md bg-neutral-900 px-4 py-3 text-white disabled:opacity-50"
      >
        {sending ? "Abriendo AZUL..." : "Pagar con tarjeta"}
      </button>
      <p className="text-center text-xs text-neutral-500">Pago seguro procesado por AZUL (Banco Popular).</p>
    </form>
  );
}
