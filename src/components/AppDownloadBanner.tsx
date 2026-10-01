"use client";

import { useSyncExternalStore } from "react";
import { Capacitor } from "@capacitor/core";

// Enlaces de las tiendas. Mientras no existan, el botón dice "Próximamente".
const PLAY_STORE_URL = process.env.NEXT_PUBLIC_PLAY_STORE_URL;
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL;

const subscribe = () => () => {};

// Dentro de la app nativa o de la PWA instalada no tiene sentido invitar a descargarla.
function isBrowser() {
  return !Capacitor.isNativePlatform() && !window.matchMedia("(display-mode: standalone)").matches;
}

// Logos de Simple Icons (CC0).
function AndroidLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-[#3ddc84]" aria-hidden>
      <path d="M18.4395 5.5586c-.675 1.1664-1.352 2.3318-2.0274 3.498-.0366-.0155-.0742-.0286-.1113-.043-1.8249-.6957-3.484-.8-4.42-.787-1.8551.0185-3.3544.4643-4.2597.8203-.084-.1494-1.7526-3.021-2.0215-3.4864a1.1451 1.1451 0 0 0-.1406-.1914c-.3312-.364-.9054-.4859-1.379-.203-.475.282-.7136.9361-.3886 1.5019 1.9466 3.3696-.0966-.2158 1.9473 3.3593.0172.031-.4946.2642-1.3926 1.0177C2.8987 12.176.452 14.772 0 18.9902h24c-.119-1.1108-.3686-2.099-.7461-3.0683-.7438-1.9118-1.8435-3.2928-2.7402-4.1836a12.1048 12.1048 0 0 0-2.1309-1.6875c.6594-1.122 1.312-2.2559 1.9649-3.3848.2077-.3615.1886-.7956-.0079-1.1191a1.1001 1.1001 0 0 0-.8515-.5332c-.5225-.0536-.9392.3128-1.0488.5449zm-.0391 8.461c.3944.5926.324 1.3306-.1563 1.6503-.4799.3197-1.188.0985-1.582-.4941-.3944-.5927-.324-1.3307.1563-1.6504.4727-.315 1.1812-.1086 1.582.4941zM7.207 13.5273c.4803.3197.5506 1.0577.1563 1.6504-.394.5926-1.1038.8138-1.584.4941-.48-.3197-.5503-1.0577-.1563-1.6504.4008-.6021 1.1087-.8106 1.584-.4941z" />
    </svg>
  );
}

function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0 fill-white" aria-hidden>
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

function StoreButton({
  href,
  store,
  platform,
  logo,
}: {
  href?: string;
  store: string;
  platform: string;
  logo: React.ReactNode;
}) {
  const content = (
    <>
      {logo}
      <span className="flex flex-col leading-tight">
        <span className="text-[10px] uppercase tracking-wide text-monte-200">{href ? store : "Próximamente"}</span>
        <span className="text-sm font-semibold">{platform}</span>
      </span>
    </>
  );
  const className = "flex flex-1 items-center justify-center gap-2 rounded-xl bg-monte-950 px-3 py-2 text-white";

  if (!href) {
    return <span className={`${className} opacity-60`}>{content}</span>;
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${className} hover:bg-monte-900`}>
      {content}
    </a>
  );
}

/** Anuncio de las apps de Android y iPhone, con los enlaces de descarga. */
export default function AppDownloadBanner() {
  const show = useSyncExternalStore(subscribe, isBrowser, () => false);
  if (!show) return null;

  return (
    <section className="rounded-2xl border border-monte-100 bg-monte-50 p-4">
      <p className="text-sm font-semibold text-monte-900">
        {PLAY_STORE_URL || APP_STORE_URL ? "AltaEntrega ya está en tu celular" : "Muy pronto en tu celular"}
      </p>
      <p className="mt-1 text-xs text-stone-600">La app de AltaEntrega para Android y iPhone, para pedir más rápido.</p>
      <div className="mt-3 flex gap-2">
        <StoreButton href={PLAY_STORE_URL} store="Disponible en Google Play" platform="Android" logo={<AndroidLogo />} />
        <StoreButton href={APP_STORE_URL} store="Descárgala en App Store" platform="iPhone" logo={<AppleLogo />} />
      </div>
    </section>
  );
}
