"use server";

import { revalidatePath } from "next/cache";
import { friendlyDbError } from "@/lib/errors";
import { requireOwnStore } from "@/lib/supabase/current-store";
import { uploadStoreFile, deleteStoreFile, validateImageFile } from "@/lib/supabase/storage";

export type ProductFormState = { error: string | null; success?: boolean };

const UPLOAD_ERROR = "No se pudo subir la foto. Inténtalo de nuevo.";

type ParsedProductFields = {
  nombre: string;
  descripcion: string | null;
  precio: number;
  talla: string | null;
  color: string | null;
  stock: number;
};

function parseProductFields(
  formData: FormData
): { ok: true; fields: ParsedProductFields } | { ok: false; error: string } {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const descripcion = String(formData.get("descripcion") ?? "").trim();
  const precio = Number(formData.get("precio"));
  const talla = String(formData.get("talla") ?? "").trim();
  const color = String(formData.get("color") ?? "").trim();
  const stock = Number(formData.get("stock"));

  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (!Number.isFinite(precio) || precio < 0) return { ok: false, error: "El precio no es válido." };
  if (!Number.isFinite(stock) || stock < 0) return { ok: false, error: "El stock no es válido." };
  if (!Number.isInteger(stock)) return { ok: false, error: "El stock debe ser un número entero." };

  return {
    ok: true,
    fields: {
      nombre,
      descripcion: descripcion || null,
      precio,
      talla: talla || null,
      color: color || null,
      stock,
    },
  };
}

export async function createProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const parsed = parseProductFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { supabase, store } = await requireOwnStore();

  let foto: string | null = null;
  const file = formData.get("foto");
  if (file instanceof File && file.size > 0) {
    const invalid = validateImageFile(file);
    if (invalid) return { error: invalid };
    try {
      foto = await uploadStoreFile(supabase, "product-photos", store.id, file);
    } catch {
      return { error: UPLOAD_ERROR };
    }
  }

  const { error } = await supabase.from("products").insert({
    store_id: store.id,
    ...parsed.fields,
    foto,
  });

  if (error) return { error: friendlyDbError(error, "No se pudo guardar el producto. Inténtalo de nuevo.") };

  revalidatePath("/dashboard/tienda/productos");
  return { error: null, success: true };
}

export async function updateProductAction(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const productId = String(formData.get("id") ?? "");
  if (!productId) return { error: "Producto inválido." };

  const parsed = parseProductFields(formData);
  if (!parsed.ok) return { error: parsed.error };

  const { supabase, store } = await requireOwnStore();

  const { data: existing } = await supabase
    .from("products")
    .select("foto")
    .eq("id", productId)
    .eq("store_id", store.id)
    .maybeSingle();

  if (!existing) return { error: "Producto no encontrado." };

  let foto = existing.foto;
  const file = formData.get("foto");
  if (file instanceof File && file.size > 0) {
    const invalid = validateImageFile(file);
    if (invalid) return { error: invalid };
    try {
      foto = await uploadStoreFile(supabase, "product-photos", store.id, file);
    } catch {
      return { error: UPLOAD_ERROR };
    }
    await deleteStoreFile(supabase, "product-photos", existing.foto);
  }

  const { error } = await supabase
    .from("products")
    .update({ ...parsed.fields, foto })
    .eq("id", productId)
    .eq("store_id", store.id);

  if (error) return { error: friendlyDbError(error, "No se pudo guardar el producto. Inténtalo de nuevo.") };

  revalidatePath("/dashboard/tienda/productos");
  return { error: null, success: true };
}

export type DeleteProductState = { error: string | null };

export async function deleteProductAction(
  _prevState: DeleteProductState,
  formData: FormData
): Promise<DeleteProductState> {
  const productId = String(formData.get("id") ?? "");
  if (!productId) return { error: "Producto inválido." };

  const { supabase, store } = await requireOwnStore();

  const { data: existing } = await supabase
    .from("products")
    .select("foto")
    .eq("id", productId)
    .eq("store_id", store.id)
    .maybeSingle();

  if (!existing) return { error: "Producto no encontrado." };

  const { error } = await supabase.from("products").delete().eq("id", productId).eq("store_id", store.id);

  // 23503: el producto aparece en order_items (ON DELETE RESTRICT). No se puede
  // borrar sin romper el historial de pedidos, así que se oculta del catálogo
  // y se conserva la foto.
  if (error?.code === "23503") {
    const { error: hideError } = await supabase
      .from("products")
      .update({ activo: false })
      .eq("id", productId)
      .eq("store_id", store.id);
    if (hideError) return { error: friendlyDbError(hideError, "No se pudo ocultar el producto. Inténtalo de nuevo.") };

    revalidatePath("/dashboard/tienda/productos");
    return { error: null };
  }

  if (error) return { error: friendlyDbError(error, "No se pudo guardar el producto. Inténtalo de nuevo.") };

  await deleteStoreFile(supabase, "product-photos", existing.foto);

  revalidatePath("/dashboard/tienda/productos");
  return { error: null };
}

export async function reactivateProductAction(formData: FormData) {
  const productId = String(formData.get("id") ?? "");
  if (!productId) return;

  const { supabase, store } = await requireOwnStore();

  await supabase
    .from("products")
    .update({ activo: true })
    .eq("id", productId)
    .eq("store_id", store.id);

  revalidatePath("/dashboard/tienda/productos");
}
