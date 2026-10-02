import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database, UserRole } from "@/types/database";

/**
 * Crea la fila en public.users a partir de los metadatos guardados en el signUp,
 * si todavía no existe. Se llama justo después del registro (cuando hay sesión
 * inmediata) y también desde /auth/callback (cuando el proyecto exige confirmar
 * el correo antes de abrir sesión). Devuelve el error del insert, o null.
 */
export async function ensureUserProfile(
  supabase: SupabaseClient<Database>,
  user: User
) {
  const { data: existing } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) {
    // Cambió su email desde /cuenta/credenciales: el trigger sync_user_email
    // copia el de auth.users al actualizar la fila.
    if (user.email && existing.email !== user.email) {
      const { error } = await supabase.from("users").update({ email: user.email }).eq("id", user.id);
      if (error) console.error("ensureUserProfile", error);
      return error;
    }
    return null;
  }

  const meta = user.user_metadata as {
    nombre?: string;
    telefono?: string;
    rol?: UserRole;
  };

  // Los metadatos los escribe el navegador en el signUp: nunca confiar en un
  // rol distinto de los tres que se pueden elegir al registrarse.
  const rol: UserRole =
    meta.rol === "tienda" || meta.rol === "courier" ? meta.rol : "cliente";

  const { error } = await supabase.from("users").insert({
    id: user.id,
    email: user.email!,
    nombre: meta.nombre ?? user.email!.split("@")[0],
    telefono: meta.telefono ?? null,
    rol,
  });

  if (error) console.error("ensureUserProfile", error);
  return error;
}
