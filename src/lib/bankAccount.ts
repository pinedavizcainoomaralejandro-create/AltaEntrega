/** Validación de cuentas bancarias dominicanas (mismas reglas que la base). */
export type BankAccountInput = {
  banco: string;
  tipo_cuenta: "ahorros" | "corriente";
  numero_cuenta: string;
  titular: string;
  documento: string;
};

export const BANCOS_RD = [
  "Banco Popular",
  "Banreservas",
  "BHD",
  "Scotiabank",
  "Banco Santa Cruz",
  "Banco Caribe",
  "Banco BDI",
  "Banco Promerica",
  "Banco Vimenca",
  "Banesco",
  "Banco López de Haro",
  "Asociación Popular de Ahorros y Préstamos",
  "Asociación Cibao de Ahorros y Préstamos",
  "Otro",
];

export function parseBankAccount(formData: FormData): { ok: true; cuenta: BankAccountInput } | { ok: false; error: string } {
  const banco = String(formData.get("banco") ?? "").trim();
  const tipo = String(formData.get("tipo_cuenta") ?? "");
  const numero = String(formData.get("numero_cuenta") ?? "").replace(/\D/g, "");
  const titular = String(formData.get("titular") ?? "").trim().replace(/\s+/g, " ");
  const documento = String(formData.get("documento") ?? "").replace(/\D/g, "");

  if (banco.length < 2 || banco.length > 60) return { ok: false, error: "Elige el banco." };
  if (tipo !== "ahorros" && tipo !== "corriente") return { ok: false, error: "Elige el tipo de cuenta." };
  if (!/^\d{6,20}$/.test(numero)) return { ok: false, error: "El número de cuenta debe tener entre 6 y 20 dígitos." };
  if (titular.length < 2 || titular.length > 100) return { ok: false, error: "Escribe el nombre del titular de la cuenta." };
  if (!/^(\d{9}|\d{11})$/.test(documento)) {
    return { ok: false, error: "La cédula (11 dígitos) o el RNC (9 dígitos) del titular no es válido." };
  }

  return { ok: true, cuenta: { banco, tipo_cuenta: tipo, numero_cuenta: numero, titular, documento } };
}

/** "****6789" para mostrar una cuenta sin exponer el número completo. */
export function enmascararCuenta(numero: string) {
  return `****${numero.slice(-4)}`;
}
