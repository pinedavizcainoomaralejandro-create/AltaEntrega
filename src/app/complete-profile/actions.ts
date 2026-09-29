"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/errors";

export type ProfileFormState = { error: string | null };

export async function createStoreProfileAction(
  _prevState: ProfileFormState,
  formData: FormData
): Promise<ProfileFormState> {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const direccion = String(formData.get("direccion") ?? "").trim();
  const categoria = String(formData.get("categoria") ?? "").trim();

  if (!nombre || !direccion || !categoria) {
    return { error: "Completa nombre, dirección y categoría de la tienda." };
  }
  if (nombre.length > 80 || direccion.length > 200 || categoria.length > 60) {
    return { error: "Algún campo es demasiado largo (nombre 80, dirección 200, categoría 60 caracteres)." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("stores").insert({
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

// Cédula dominicana: 11 dígitos, con o sin guiones (000-0000000-0).
function normalizeCedula(raw: string) {
  return raw.replace(/\D/g, "");
}

function normalizeMatricula(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export async function createCourierProfileAction(
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
  if (!/^[A-Z0-9-]{5,10}$/.test(matricula)) {
    return { error: "La matrícula debe tener entre 5 y 10 letras o números, por ejemplo K123456." };
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.from("couriers").insert({
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
