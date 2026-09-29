import { fileURLToPath } from "node:url";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseWs = supabaseUrl.replace(/^https:/, "wss:");
const isDev = process.env.NODE_ENV !== "production";

// CSP moderada: Next.js necesita scripts inline para hidratar (y eval en
// desarrollo). Lo importante aquí es limitar a dónde se conecta la página
// (solo este origen y Supabase), prohibir que otro sitio la meta en un iframe
// y bloquear plugins y cambios de <base>.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabaseUrl}`,
  "font-src 'self'",
  `connect-src 'self' ${supabaseUrl} ${supabaseWs}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  // La Página de Pagos de AZUL recibe el formulario de pago.
  "form-action 'self' https://pruebas.azul.com.do https://pagos.azul.com.do",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Fija la raíz del proyecto: hay otro package-lock.json en la carpeta de
  // usuario y Next.js lo tomaría como raíz del workspace.
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
  // Las fotos de productos y logos se suben con Server Actions, que por defecto
  // aceptan 1 MB. La app permite imágenes de hasta 5 MB (validateImageFile y
  // los buckets), más el margen del multipart.
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
