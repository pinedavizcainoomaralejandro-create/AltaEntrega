/**
 * Correos de aviso de las solicitudes de negocio y repartidor. Funciones puras
 * (sin envío) para poder probarlas; el envío está en src/lib/email.ts.
 */

export type SolicitudTipo = "tienda" | "courier";

export type EmailContent = { subject: string; html: string; text: string };

/** Los datos los escribe el usuario: se escapan antes de meterlos en el HTML. */
export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(parrafos: string[], boton: { href: string; label: string }) {
  const body = parrafos.map((p) => `<p style="margin:0 0 16px">${p}</p>`).join("");
  return `<div style="font-family:system-ui,-apple-system,sans-serif;font-size:15px;line-height:1.5;color:#292524;max-width:520px">
<p style="margin:0 0 24px;font-size:18px;font-weight:700;color:#14532d">AltaEntrega</p>
${body}
<p style="margin:24px 0"><a href="${escapeHtml(boton.href)}" style="background:#15803d;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none;font-weight:600">${escapeHtml(boton.label)}</a></p>
<p style="margin:32px 0 0;font-size:12px;color:#78716c">Villa Altagracia, República Dominicana</p>
</div>`;
}

const TIPO_LABEL: Record<SolicitudTipo, string> = { tienda: "negocio", courier: "repartidor" };

/** Aviso a los administradores: llegó una solicitud nueva (o corregida) para revisar. */
export function solicitudRecibidaEmail(params: {
  tipo: SolicitudTipo;
  nombre: string;
  email: string;
  detalle: string;
  reenviada: boolean;
  siteUrl: string;
}): EmailContent {
  const tipo = TIPO_LABEL[params.tipo];
  const accion = params.reenviada ? "corrigió y reenvió su solicitud" : "envió una solicitud";
  const subject = `Nueva solicitud de ${tipo}: ${params.nombre}`;
  const href = `${params.siteUrl}/admin`;

  const html = layout(
    [
      `<strong>${escapeHtml(params.nombre)}</strong> (${escapeHtml(params.email)}) ${accion} como ${tipo}.`,
      escapeHtml(params.detalle),
      "Revísala en el panel de administración para aprobarla o rechazarla.",
    ],
    { href, label: "Revisar solicitud" }
  );
  const text = `${params.nombre} (${params.email}) ${accion} como ${tipo}.\n${params.detalle}\n\nRevísala en ${href}`;

  return { subject, html, text };
}

/** Aviso al solicitante: su solicitud fue aprobada o rechazada. */
export function solicitudResueltaEmail(params: {
  tipo: SolicitudTipo;
  nombre: string;
  aprobada: boolean;
  siteUrl: string;
}): EmailContent {
  const saludo = `Hola ${escapeHtml(params.nombre.split(" ")[0])},`;
  const href = `${params.siteUrl}/login`;

  if (params.aprobada) {
    const queHacer =
      params.tipo === "tienda"
        ? "Ya puedes entrar a tu panel, subir tus productos y empezar a recibir pedidos."
        : "Ya puedes entrar a tu panel, marcarte como disponible y tomar entregas.";
    const subject =
      params.tipo === "tienda" ? "Tu negocio fue aprobado en AltaEntrega" : "Fuiste aprobado como repartidor en AltaEntrega";
    return {
      subject,
      html: layout([saludo, "¡Buenas noticias! Aprobamos tu solicitud.", queHacer], { href, label: "Entrar a mi panel" }),
      text: `${params.nombre.split(" ")[0]}, aprobamos tu solicitud. ${queHacer}\n\nEntra en ${href}`,
    };
  }

  const subject = "Revisamos tu solicitud en AltaEntrega";
  const motivo = "Algunos de tus datos no se pudieron verificar.";
  const queHacer = "Entra a la app, corrige tus datos y envíalos de nuevo. Los revisaremos otra vez.";
  return {
    subject,
    html: layout([saludo, `Revisamos tu solicitud y por ahora no la pudimos aprobar. ${motivo}`, queHacer], {
      href,
      label: "Corregir mis datos",
    }),
    text: `${params.nombre.split(" ")[0]}, revisamos tu solicitud y por ahora no la pudimos aprobar. ${motivo} ${queHacer}\n\nEntra en ${href}`,
  };
}
