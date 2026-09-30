import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Mismos límites que el bucket "comprobantes" (migración 20261001000000).
const MAX_BYTES = 5 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

export function validateComprobante(file: unknown): string | null {
  if (!(file instanceof File) || file.size === 0) return "Adjunta la foto o el PDF del comprobante.";
  if (!TIPOS.includes(file.type)) return "El comprobante debe ser una imagen (JPG, PNG, WebP) o un PDF.";
  if (file.size > MAX_BYTES) return "El comprobante no puede pesar más de 5 MB.";
  return null;
}

/**
 * Sube un comprobante al bucket privado. La carpeta decide quién puede verlo:
 * "pedidos/<order_id>" (cliente, negocio y admin) o "suscripciones/<user_id>"
 * (el dueño y el admin).
 */
export async function uploadComprobante(supabase: SupabaseClient<Database>, carpeta: string, file: File) {
  const ext = file.type === "application/pdf" ? "pdf" : file.name.split(".").pop() || "jpg";
  const path = `${carpeta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("comprobantes").upload(path, file, { contentType: file.type });
  if (error) throw error;
  return path;
}
