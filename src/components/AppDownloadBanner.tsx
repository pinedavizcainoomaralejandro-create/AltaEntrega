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

function StoreButton({ href, store, platform }: { href?: string; store: string; platform: string }) {
  const content = (
    <>
      <span className="text-[10px] uppercase tracking-wide text-monte-200">{href ? store : "Próximamente"}</span>
      <span className="text-sm font-semibold">{platform}</span>
    </>
  );
  const className = "flex flex-1 flex-col items-center rounded-xl bg-monte-950 px-3 py-2 text-white";

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
        <StoreButton href={PLAY_STORE_URL} store="Disponible en Google Play" platform="Android" />
        <StoreButton href={APP_STORE_URL} store="Descárgala en App Store" platform="iPhone" />
      </div>
    </section>
  );
}
