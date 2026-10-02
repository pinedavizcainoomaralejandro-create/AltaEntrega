"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { AVATAR_BUCKET } from "@/lib/avatar";

export type DeleteAccountState = { error: string | null };

export async function deleteAccountAction(
  _prevState: DeleteAccountState,
  formData: FormData
): Promise<DeleteAccountState> {
  if (String(formData.get("confirmacion") ?? "").trim().toUpperCase() !== "ELIMINAR") {
    return { error: "Escribe ELIMINAR para confirmar." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirect=/cuenta/eliminar");

  // Se comprueba antes de tocar Storage: si la cuenta no se puede eliminar,
  // las fotos del negocio tienen que seguir ahí.
  const { data: blocker, error: blockerError } = await supabase.rpc("account_deletion_blocker");
  if (blockerError) return { error: friendlyDbError(blockerError) };
  if (blocker) return { error: blocker };

  // Fotos de productos y logo del negocio. Supabase no deja borrar archivos de
  // Storage con SQL, y después de delete_my_account() el usuario ya no es
  // dueño de la carpeta, así que se borran ahora.
  const { data: store } = await supabase.from("stores").select("id").eq("user_id", user.id).maybeSingle();
  if (store) {
    for (const bucket of ["product-photos", "store-logos"] as const) {
      const { data: files } = await supabase.storage.from(bucket).list(store.id, { limit: 1000 });
      const paths = (files ?? []).map((f) => `${store.id}/${f.name}`);
      if (paths.length) await supabase.storage.from(bucket).remove(paths);
    }
  }

  // Foto de perfil: misma razón que las fotos del negocio.
  const { data: avatarFiles } = await supabase.storage.from(AVATAR_BUCKET).list(user.id, { limit: 100 });
  const avatarPaths = (avatarFiles ?? []).map((f) => `${user.id}/${f.name}`);
  if (avatarPaths.length) await supabase.storage.from(AVATAR_BUCKET).remove(avatarPaths);

  const { error } = await supabase.rpc("delete_my_account");
  if (error) return { error: friendlyDbError(error) };

  // El usuario ya no existe en Auth: signOut solo limpia las cookies.
  await supabase.auth.signOut();
  redirect("/login?cuenta_eliminada=1");
}
