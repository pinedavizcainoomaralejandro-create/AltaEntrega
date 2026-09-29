import type { Metadata } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

// next/font descarga las fuentes al compilar y las sirve desde este mismo
// dominio (compatible con la CSP, sin llamadas a Google en el navegador).
const sans = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-display", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "AltaEntrega · Boutiques de Villa Altagracia",
    template: "%s · AltaEntrega",
  },
  description: "Las boutiques de Villa Altagracia, en la puerta de tu casa.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sans.variable} ${display.variable}`}>
      <body>{children}</body>
    </html>
  );
}
