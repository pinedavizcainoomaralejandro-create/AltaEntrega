import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Cliente con la service role: salta RLS. Solo se usa en el servidor para
 * registrar el resultado de un pago (confirm_payment / fail_payment), que
 * ningún usuario puede llamar por su cuenta. "server-only" hace fallar el
 * build si este archivo llega a importarse desde código del navegador.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY: es necesaria para registrar pagos.");
  }

  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
