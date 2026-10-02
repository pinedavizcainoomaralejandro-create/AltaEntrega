"use client";

import { Capacitor } from "@capacitor/core";
import { createClient } from "@/lib/supabase/client";

// Token de este teléfono, para poder darlo de baja al cerrar sesión.
const STORAGE_KEY = "altaentrega.push-token";

export function rememberPushToken(token: string) {
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {}
}

/**
 * Deja de enviar avisos de esta cuenta a este teléfono. Se llama antes de
 * cerrar sesión (después ya no hay permiso para hacerlo). Si tarda, no
 * bloquea la salida.
 */
export async function unregisterPushToken() {
  if (!Capacitor.isNativePlatform()) return;
  let token: string | null = null;
  try {
    token = localStorage.getItem(STORAGE_KEY);
  } catch {}
  if (!token) return;

  const supabase = createClient();
  await Promise.race([
    supabase.rpc("unregister_push_token", { p_token: token }),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
