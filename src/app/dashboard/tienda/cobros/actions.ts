"use server";

import { revalidatePath } from "next/cache";
import { attachValues, type FormValues } from "@/lib/formValues";
import { friendlyDbError } from "@/lib/errors";
import { parseBankAccount } from "@/lib/bankAccount";
import { requireOwnStore } from "@/lib/supabase/current-store";

export type BankAccountState = { error: string | null; saved?: boolean } & FormValues;

async function saveStoreBankAccountInner(_prev: BankAccountState, formData: FormData): Promise<BankAccountState> {
  const parsed = parseBankAccount(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { supabase, store } = await requireOwnStore();
  const { error } = await supabase
    .from("store_payout_accounts")
    .upsert({ store_id: store.id, ...parsed.cuenta }, { onConflict: "store_id" });
  if (error) return { error: friendlyDbError(error, "No se pudo guardar la cuenta. Inténtalo de nuevo.") };

  revalidatePath("/dashboard/tienda/cobros");
  return { error: null, saved: true };
}

export async function saveStoreBankAccountAction(prevState: BankAccountState, formData: FormData): Promise<BankAccountState> {
  return attachValues(await saveStoreBankAccountInner(prevState, formData), formData, [
    "banco",
    "tipo_cuenta",
    "numero_cuenta",
    "titular",
    "documento",
  ]);
}
