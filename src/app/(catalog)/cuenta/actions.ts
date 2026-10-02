"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { attachValues, type FormValues } from "@/lib/formValues";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/siteOrigin";
import { friendlyAuthError, friendlyDbError } from "@/lib/errors";
import { EMAIL_RE, normalizeTelefono, validatePassword } from "@/lib/validation";

export type AccountFormState = { error: string | null; message: string | null } & FormValues;

async function requireUser(redirectTo: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?redirect=${redirectTo}`);
  return { supabase, user };
}

async function updateProfileInner(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const nombre = String(formData.get("nombre") ?? "").trim().replace(/\s+/g, " ");
  const telefonoRaw = String(formData.get("telefono") ?? "").trim();

  if (nombre.length < 2 || nombre.length > 80) {
    return { error: "Escribe tu nombre (entre 2 y 80 caracteres).", message: null };
  }

  let telefono: string | null = null;
  if (telefonoRaw) {
    telefono = normalizeTelefono(telefonoRaw);
    if (!telefono) {
      return {
        error: "El teléfono debe ser dominicano de 10 dígitos (809, 829 u 849), por ejemplo 809-555-1234.",
        message: null,
      };
    }
  }

  const { supabase, user } = await requireUser("/cuenta/perfil");
  const { error } = await supabase.from("users").update({ nombre, telefono }).eq("id", user.id);
  if (error) return { error: friendlyDbError(error), message: null };

  // El nombre aparece en el encabezado y en los paneles.
  revalidatePath("/", "layout");
  return { error: null, message: "Guardamos tus datos." };
}

async function changeEmailInner(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return { error: "Escribe un email válido, por ejemplo nombre@correo.com.", message: null };

  const { supabase, user } = await requireUser("/cuenta/credenciales");
  if (email === user.email) return { error: "Ese ya es tu email actual.", message: null };

  // Supabase no cambia el email hasta que se abre el enlace que envía; al
  // volver, /auth/callback copia el nuevo email a public.users.
  const next = encodeURIComponent("/cuenta?email_actualizado=1");
  const { error } = await supabase.auth.updateUser(
    { email },
    { emailRedirectTo: `${await siteOrigin()}/auth/callback?next=${next}` }
  );
  if (error) return { error: friendlyAuthError(error), message: null };

  return {
    error: null,
    message: `Te enviamos un enlace a ${email}. Tu email cambia cuando lo abras. Si también te llega uno a tu email actual, ábrelo para confirmar.`,
  };
}

export async function changePasswordAction(
  _prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  const currentPassword = String(formData.get("currentPassword") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!currentPassword) return { error: "Escribe tu contraseña actual.", message: null };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError, message: null };
  if (password !== confirmPassword) return { error: "Las contraseñas no coinciden.", message: null };

  const { supabase, user } = await requireUser("/cuenta/credenciales");

  // Con la sesión abierta basta para cambiarla, pero se pide la actual para
  // que nadie la cambie desde un teléfono que quedó desbloqueado.
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email!, password: currentPassword });
  if (signInError) {
    if (signInError.code === "invalid_credentials") return { error: "Tu contraseña actual no es correcta.", message: null };
    return { error: friendlyAuthError(signInError), message: null };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendlyAuthError(error), message: null };

  return { error: null, message: "Cambiamos tu contraseña." };
}

export async function updateProfileAction(
  prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  return attachValues(await updateProfileInner(prevState, formData), formData, ["nombre", "telefono"]);
}

export async function changeEmailAction(
  prevState: AccountFormState,
  formData: FormData
): Promise<AccountFormState> {
  return attachValues(await changeEmailInner(prevState, formData), formData, ["email"]);
}
