import { describe, expect, it } from "vitest";
import { escapeHtml, solicitudRecibidaEmail, solicitudResueltaEmail } from "@/lib/emailTemplates";

describe("escapeHtml", () => {
  it("escapa los caracteres de HTML", () => {
    expect(escapeHtml(`<a href="x">Pan & 'Café'</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Pan &amp; &#39;Café&#39;&lt;/a&gt;"
    );
  });
});

describe("solicitudRecibidaEmail", () => {
  const base = {
    tipo: "courier" as const,
    nombre: "Juan <script>",
    email: "juan@correo.com",
    detalle: "Vehículo: Moto. Matrícula: K123456.",
    reenviada: false,
    siteUrl: "https://altaentrega.com",
  };

  it("enlaza al panel de admin y escapa los datos del solicitante", () => {
    const email = solicitudRecibidaEmail(base);
    expect(email.subject).toBe("Nueva solicitud de repartidor: Juan <script>");
    expect(email.html).toContain("https://altaentrega.com/admin");
    expect(email.html).toContain("Juan &lt;script&gt;");
    expect(email.html).not.toContain("<script>");
  });

  it("indica cuando la solicitud se reenvió corregida", () => {
    expect(solicitudRecibidaEmail({ ...base, reenviada: true }).text).toContain("corrigió y reenvió");
  });
});

describe("solicitudResueltaEmail", () => {
  const base = { tipo: "tienda" as const, nombre: "Ana Pérez", siteUrl: "https://altaentrega.com" };

  it("aprobada: saluda por el primer nombre y lleva al login", () => {
    const email = solicitudResueltaEmail({ ...base, aprobada: true });
    expect(email.subject).toBe("Tu negocio fue aprobado en AltaEntrega");
    expect(email.html).toContain("Hola Ana,");
    expect(email.html).toContain("https://altaentrega.com/login");
  });

  it("rechazada: pide corregir los datos", () => {
    const email = solicitudResueltaEmail({ ...base, tipo: "courier", aprobada: false });
    expect(email.subject).toBe("Revisamos tu solicitud en AltaEntrega");
    expect(email.text).toContain("corrige tus datos");
  });
});
