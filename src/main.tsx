import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initSecurityGuard } from "./lib/security-guard";

const clearLegacyBrowserState = async () => {
  if (typeof window === "undefined") return;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("Failed to clear legacy browser state", error);
  }
};

void clearLegacyBrowserState();
initSecurityGuard();

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    void clearLegacyBrowserState();
    window.setTimeout(() => {
      void clearLegacyBrowserState();
    }, 1500);
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
