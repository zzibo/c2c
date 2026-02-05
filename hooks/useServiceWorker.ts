import { useEffect, useState } from "react";

type SWStatus = "loading" | "ready" | "error" | "unsupported";

/**
 * Hook to register Serwist service worker
 * Serwist handles caching, updates, and lifecycle automatically
 */
export function useServiceWorker() {
  const [status, setStatus] = useState<SWStatus>("loading");

  useEffect(() => {
    // Skip in SSR or if SW not supported
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setStatus("unsupported");
      return;
    }

    // In development, Serwist is disabled via next.config.ts
    if (process.env.NODE_ENV === "development") {
      setStatus("unsupported");
      return;
    }

    // Register the SW (Serwist builds it to /sw.js)
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {
        console.log("✅ Service Worker registered:", registration.scope);
        setStatus("ready");

        // Listen for updates
        registration.addEventListener("updatefound", () => {
          console.log("🔄 New Service Worker version available");
        });
      })
      .catch((error) => {
        console.error("❌ Service Worker registration failed:", error);
        setStatus("error");
      });
  }, []);

  return status;
}
