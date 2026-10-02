/** Bucket de las fotos de perfil (migración 20261004000000_user_avatars). */
export const AVATAR_BUCKET = "avatars";

// Mismos límites que el bucket. El navegador la reduce a 256x256 antes de subirla.
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** URL pública de la foto a partir de su ruta en el bucket ("<user_id>/<archivo>"). */
export function avatarUrl(path: string | null | undefined) {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${AVATAR_BUCKET}/${path}`;
}
