"use client";

import { useEffect } from "react";

export function RegisterSW() {
  useEffect(() => {
    // Only register service worker in browser (not during SSR)
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/service-worker.js")
        .then((registration) => {
          console.log("ServiceWorker registered:", registration.scope);

          // Check for updates periodically
          registration.update();
        })
        .catch((error) => {
          console.error("ServiceWorker registration failed:", error);
        });
    }
  }, []);

  return null; // This component doesn't render anything
}
