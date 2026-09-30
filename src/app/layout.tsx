import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import ServiceWorkerRegister from "@/components/pwa/ServiceWorkerRegister";
import "./globals.css";

// next/font descarga las fuentes al compilar y las sirve desde este mismo
// dominio (compatible con la CSP, sin llamadas a Google en el navegador).
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "AltaEntrega · Negocios de Villa Altagracia",
    template: "%s · AltaEntrega",
  },
  description: "Restaurantes, empanadas, cafeterías, panaderías, reposterías y boutiques de Villa Altagracia, en la puerta de tu casa.",
  applicationName: "AltaEntrega",
  // iPhone: al agregarla a la pantalla de inicio abre sin barra de Safari.
  appleWebApp: { capable: true, title: "AltaEntrega", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#1c5136",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <body>
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
