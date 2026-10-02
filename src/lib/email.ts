import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { siteOrigin } from "@/lib/siteOrigin";
import { solicitudRecibidaEmail, solicitudResueltaEmail, type EmailContent, type SolicitudTipo } from "./emailTemplates";

/**
 * Envía un correo con Resend (https://resend.com). Sin RESEND_API_KEY no envía
 * nada (desarrollo). Nunca lanza: un aviso que falla no debe impedir guardar
 * una solicitud ni aprobarla.
 */
export async function sendEmail(to: string[], content: EmailContent) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[email] Sin RESEND_API_KEY, no se envía "${content.subject}" a ${to.join(", ")}`);
    return;
  }
  if (to.length === 0) return;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "AltaEntrega <onboarding@resend.dev>",
        to,
        subject: content.subject,
        html: content.html,
        text: content.text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) console.error("[email]", res.status, await res.text());
  } catch (error) {
    console.error("[email]", error);
  }
}

/**
 * Emails de los administradores. Se leen con la service role porque quien
 * envía la solicitud no puede ver a otros usuarios por RLS. ADMIN_EMAILS
 * (separados por comas) reemplaza la consulta si se define.
 */
async function adminEmails() {
  const fromEnv = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;

  try {
    const { data, error } = await createAdminClient().from("users").select("email").eq("rol", "admin");
    if (error) throw error;
    return (data ?? []).map((u) => u.email);
  } catch (error) {
    console.error("[email] No se pudieron leer los emails de los administradores", error);
    return [];
  }
}

export async function notifyAdminsSolicitud(params: {
  tipo: SolicitudTipo;
  nombre: string;
  email: string;
  detalle: string;
  reenviada: boolean;
}) {
  const content = solicitudRecibidaEmail({ ...params, siteUrl: await siteOrigin() });
  await sendEmail(await adminEmails(), content);
}

export async function notifySolicitante(params: {
  tipo: SolicitudTipo;
  email: string;
  nombre: string;
  aprobada: boolean;
}) {
  const content = solicitudResueltaEmail({ ...params, siteUrl: await siteOrigin() });
  await sendEmail([params.email], content);
}
