import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initSecurityGuard } from "./lib/security-guard";
import { clearChunkReloadState, installChunkErrorRecovery } from "./lib/chunk-recovery";

installChunkErrorRecovery();
clearChunkReloadState();

// Build version banner — usado para confirmar qual bundle o usuário está executando
try {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "(unset)";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const anonKeyTail = anonKey ? `…${anonKey.slice(-8)}` : "(unset)";
  // eslint-disable-next-line no-console
  console.info(
    `%c[PRAEFECTUS] Build ${__BUILD_ID__}\n%cBuild time: ${__BUILD_TIME__}\nSupabase URL: ${supabaseUrl}\nAnon key tail: ${anonKeyTail}`,
    "background:#0F172A;color:#3B82F6;font-weight:bold;padding:2px 6px;border-radius:3px;",
    "color:#94A3B8;"
  );
  (window as any).__PRAEFECTUS_BUILD__ = {
    id: __BUILD_ID__,
    time: __BUILD_TIME__,
    supabaseUrl,
    anonKeyTail,
  };
} catch (err) {
  console.warn("Failed to print build banner", err);
}

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
    clearChunkReloadState();
    void clearLegacyBrowserState();
    window.setTimeout(() => {
      clearChunkReloadState();
      void clearLegacyBrowserState();
    }, 1500);
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
