import "server-only";
import { headers } from "next/headers";

// La URL de los enlaces de correo sale de la configuración, no del header
// Origin (que manda el navegador y un atacante puede cambiar). Sin
// NEXT_PUBLIC_SITE_URL se usa el origen de la petición, solo aceptable en desarrollo.
export async function siteOrigin() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? (await headers()).get("origin") ?? "http://localhost:3000";
}
