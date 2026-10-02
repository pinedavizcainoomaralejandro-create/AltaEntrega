import type { CapacitorConfig } from "@capacitor/cli";

// La app usa SSR, Server Actions y el proxy de Supabase, así que no se puede
// exportar como sitio estático. La app nativa carga el sitio de producción y
// solo empaqueta capacitor-www/, que se muestra cuando no hay conexión.
const config: CapacitorConfig = {
  appId: "com.altaentrega.app",
  appName: "AltaEntrega",
  webDir: "capacitor-www",
  server: {
    url: "https://altaentrega.netlify.app",
    errorPath: "index.html",
  },
  android: {
    backgroundColor: "#faf6ef",
  },
  plugins: {
    // Con la app abierta, los avisos también se muestran (y suenan).
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
    // La web usa viewport-fit=cover y se aparta sola con env(safe-area-inset-*).
    SystemBars: {
      insetsHandling: "native",
      initialViewportFitValueHint: "cover",
      // Íconos oscuros sobre el fondo arena claro.
      style: "LIGHT",
    },
  },
};

export default config;
