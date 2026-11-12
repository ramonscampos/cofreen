"use client";

import { useEffect } from "react";

// Registers the minimal service worker that makes the app installable
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Installability is a nicety; the app works without it
    });
  }, []);

  return null;
}
