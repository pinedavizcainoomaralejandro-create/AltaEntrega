"use server";

import { attachValues, type FormValues } from "@/lib/formValues";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";
import { isValidMatricula, normalizeCedula, normalizeMatricula } from "@/lib/validation";
import { isCategoriaSlug } from "@/lib/categories";

export type ProfileFormState = { error: string | null } & FormValues;

async function createStoreProfileInner(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();

  if (!nombre || !direccion || !categoria) {
    return { error: "Completa el nombre, la dirección y el tipo de negocio." };
  }
  if (!isCategoriaSlug(categoria)) {
    return { error: "Elige el tipo de negocio." };
  }
  if (nombre.length > 80 || direccion.length > 200) {
    return { error: "Algún campo es demasiado largo (nombre 80 y dirección 200 caracteres)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Una solicitud rechazada se corrige y vuelve a "pendiente"; si no hay
  // solicitud, se crea.
  const { data: existing } = await supabase.from("stores").select("id, estado").eq("user_id", user.id).maybeSingle();

  const { error } =
    existing?.estado === "rechazado"
      ? await supabase
          .from("stores")
          .update({ nombre, direccion, categoria, estado: "pendiente" })
          .eq("id", existing.id)
      : await supabase.from("stores").insert({
          user_id: user.id,
          nombre,
          direccion,
          categoria,
        });

  if (error) {
    if (error.code === "23505") return { error: "Ya registraste una tienda con esta cuenta." };
    return { error: friendlyDbError(error, "No se pudo guardar la tienda. Inténtalo de nuevo.") };
  }

  redirect("/pending-approval");
}


async function createCourierProfileInner(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const vehiculo = String(formData.get("vehiculo") ?? "").trim();
  const documentoRaw = String(formData.get("documento_identidad") ?? "").trim();
  const matriculaRaw = String(formData.get("matricula") ?? "").trim();

  if (!vehiculo || !documentoRaw || !matriculaRaw) {
    return { error: "Completa el vehículo, tu cédula y la matrícula del vehículo." };
  }

  const documento_identidad = normalizeCedula(documentoRaw);
  if (documento_identidad.length !== 11) {
    return { error: "La cédula debe tener 11 dígitos (formato 000-0000000-0)." };
  }

  if (vehiculo.length > 60) return { error: "El tipo de vehículo es demasiado largo (máximo 60 caracteres)." };

  const matricula = normalizeMatricula(matriculaRaw);
  if (!isValidMatricula(matricula)) {
    return { error: "La matrícula debe tener entre 5 y 10 letras o números, por ejemplo K123456." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Una solicitud rechazada se corrige y vuelve a "pendiente"; si no hay
  // solicitud, se crea.
  const { data: existing } = await supabase.from("couriers").select("id, estado").eq("user_id", user.id).maybeSingle();

  const { error } =
    existing?.estado === "rechazado"
      ? await supabase
          .from("couriers")
          .update({ vehiculo, documento_identidad, matricula, estado: "pendiente" })
          .eq("id", existing.id)
      : await supabase.from("couriers").insert({
          user_id: user.id,
          vehiculo,
          documento_identidad,
          matricula,
        });

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("user_id")) {
        return { error: "Ya registraste un perfil de repartidor con esta cuenta." };
      }
      if (error.message.includes("matricula")) {
        return { error: "Esa matrícula ya está registrada con otra cuenta de repartidor." };
      }
      return { error: "Esa cédula ya está registrada con otra cuenta de repartidor." };
    }
    return { error: friendlyDbError(error, "No se pudo guardar tu perfil. Inténtalo de nuevo.") };
  }

  redirect("/pending-approval");
}

export async function createStoreProfileAction(
  prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  return attachValues(await createStoreProfileInner(prevState, formData), formData, ["nombre", "direccion", "categoria"]);
}

export async function createCourierProfileAction(
  prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  return attachValues(await createCourierProfileInner(prevState, formData), formData, ["vehiculo", "documento_identidad", "matricula"]);
}
