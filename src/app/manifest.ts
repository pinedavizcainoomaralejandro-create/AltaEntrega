import type { MetadataRoute } from "next";

// Permite instalar AltaEntrega en Android e iPhone desde el navegador (PWA).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AltaEntrega · Negocios de Villa Altagracia",
    short_name: "AltaEntrega",
    description:
      "Restaurantes, empanadas, cafeterías, panaderías, reposterías y boutiques de Villa Altagracia, en la puerta de tu casa.",
    lang: "es",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#faf6ef",
    theme_color: "#1c5136",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
