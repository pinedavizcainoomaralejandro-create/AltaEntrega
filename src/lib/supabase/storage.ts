import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

function publicPrefix(bucket: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/`;
}

// Mismos límites que los buckets (migración 20260929000001).
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Devuelve un mensaje de error si el archivo no es una imagen aceptada, o null si es válido. */
export function validateImageFile(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "La imagen debe ser JPG, PNG o WebP.";
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return "La imagen no puede pesar más de 5 MB.";
  }
  return null;
}

/** Sube un archivo a `<bucket>/<storeId>/...` y devuelve su URL pública. */
export async function uploadStoreFile(
  supabase: SupabaseClient<Database>,
  bucket: "product-photos" | "store-logos",
  storeId: string,
  file: File
) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${storeId}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}

/** Borra un archivo previamente subido a partir de su URL pública. */
export async function deleteStoreFile(
  supabase: SupabaseClient<Database>,
  bucket: "product-photos" | "store-logos",
  publicUrl: string | null
) {
  if (!publicUrl) return;
  const prefix = publicPrefix(bucket);
  if (!publicUrl.startsWith(prefix)) return;
  const path = publicUrl.slice(prefix.length);
  await supabase.storage.from(bucket).remove([path]);
}
