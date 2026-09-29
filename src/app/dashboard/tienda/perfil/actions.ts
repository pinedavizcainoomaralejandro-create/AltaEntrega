"use server";

import { attachValues, type FormValues } from "@/lib/formValues";
import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@/lib/errors";
import { isCategoriaSlug } from "@/lib/categories";
import { requireOwnStore } from "@/lib/supabase/current-store";
import { uploadStoreFile, deleteStoreFile, validateImageFile } from "@/lib/supabase/storage";

export type StoreProfileFormState = { error: string | null; success?: boolean } & FormValues;

async function updateStoreProfileInner(
  _prevState: StoreProfileFormState,
  formData: FormData
): Promise<StoreProfileFormState> {
  const categoria = String(formData.get("categoria") ?? "").trim();

  if (!isCategoriaSlug(categoria)) return { error: "Elige el tipo de negocio." };

  const { supabase, store } = await requireOwnStore();

  let logo = store.logo;
  const file = formData.get("logo");
  if (file instanceof File && file.size > 0) {
    const invalid = validateImageFile(file);
    if (invalid) return { error: invalid };
    try {
      logo = await uploadStoreFile(supabase, "store-logos", store.id, file);
    } catch {
      return { error: "No se pudo subir el logo. Inténtalo de nuevo." };
    }
    await deleteStoreFile(supabase, "store-logos", store.logo);
  }

  const { error } = await supabase
    .from("stores")
    // Nombre y dirección los verificó el admin: la tienda solo edita categoría y logo.
    .update({ categoria, logo })
    .eq("id", store.id);

  if (error) return { error: friendlyDbError(error, "No se pudieron guardar los cambios. Inténtalo de nuevo.") };

  revalidatePath("/dashboard/tienda/perfil");
  revalidatePath("/dashboard/tienda");
  return { error: null, success: true };
}

export async function updateStoreProfileAction(
  prevState: StoreProfileFormState,
  formData: FormData
): Promise<StoreProfileFormState> {
  return attachValues(await updateStoreProfileInner(prevState, formData), formData, ["categoria"]);
}
