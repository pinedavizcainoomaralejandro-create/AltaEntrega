"use server";

import { attachValues, type FormValues } from "@/lib/formValues";
import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@/lib/errors";
import { requireOwnStore } from "@/lib/supabase/current-store";
import { uploadStoreFile, deleteStoreFile, validateImageFile } from "@/lib/supabase/storage";

export type StoreProfileFormState = { error: string | null; success?: boolean } & FormValues;

async function updateStoreProfileInner(
  _prevState: StoreProfileFormState,
  formData: FormData
): Promise<StoreProfileFormState> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();

  if (!nombre || !direccion || !categoria) {
    return { error: "Completa nombre, dirección y categoría." };
  }

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
    .update({ nombre, direccion, categoria, logo })
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
  return attachValues(await updateStoreProfileInner(prevState, formData), formData, ["nombre", "direccion", "categoria"]);
}
