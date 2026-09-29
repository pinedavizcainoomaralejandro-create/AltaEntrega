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
        className="btn-accent w-full py-3 text-base"
      >
        {sending ? "Abriendo AZUL..." : "Pagar con tarjeta"}
      </button>
      <p className="text-center text-xs text-stone-500">Pago seguro procesado por AZUL (Banco Popular).</p>
    </form>
  );
}
