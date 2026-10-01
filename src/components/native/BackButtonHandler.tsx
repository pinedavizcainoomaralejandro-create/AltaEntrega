"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

/** App Android: el botón atrás vuelve a la página anterior y, en la primera, cierra la app. */
export default function BackButtonHandler() {
  useEffect(() => {
    if (Capacitor.getPlatform() !== "android") return;
    const listener = App.addListener("backButton", ({ canGoBack }) => {
      if (canGoBack) window.history.back();
      else App.exitApp();
    });
    return () => {
      listener.then((handle) => handle.remove());
    };
  }, []);
  return null;
}
