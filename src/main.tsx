import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";
import { initSecurityGuard } from "./lib/security-guard";
import { clearChunkReloadState, installChunkErrorRecovery } from "./lib/chunk-recovery";
import {
  validateAndCleanAuthStorage,
  installAuthFetchInterceptor,
} from "./lib/auth-bootstrap";

installChunkErrorRecovery();
clearChunkReloadState();

// CRÍTICO: deve rodar ANTES de qualquer import que use o client Supabase.
// Remove sessões corrompidas/expiradas do localStorage para evitar
// "Failed to fetch" / "refresh_token_not_found" no boot do SDK.
validateAndCleanAuthStorage();
installAuthFetchInterceptor(import.meta.env.VITE_SUPABASE_URL ?? "");

// Build version banner — usado para confirmar qual bundle o usuário está executando
try {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "";
  const projectRef = supabaseUrl ? supabaseUrl.replace(/https?:\/\//, "").split(".")[0] : "NÃO DEFINIDA";
  const anonKeyTail = anonKey ? `…${anonKey.slice(-8)}` : "(unset)";

  // eslint-disable-next-line no-console
  console.info(
    `%c[PRAEFECTUS] Build ${__BUILD_ID__}\n%cBuild time: ${__BUILD_TIME__}\nSupabase project: ${projectRef}.supabase.co\nAnon key: ${anonKey ? `Sim (${anonKey.length} chars, tail ${anonKeyTail})` : "AUSENTE"}`,
    "background:#0F172A;color:#3B82F6;font-weight:bold;padding:2px 6px;border-radius:3px;",
    "color:#94A3B8;"
  );

  if (!supabaseUrl || !anonKey) {
    console.error(
      "[PRAEFECTUS] ERRO CRÍTICO: variáveis de ambiente do backend ausentes no bundle.\n" +
      "VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY são injetadas no build — esse bundle precisa ser republicado."
    );
  }

  (window as any).__PRAEFECTUS_BUILD__ = {
    id: __BUILD_ID__,
    time: __BUILD_TIME__,
    supabaseUrl,
    projectRef,
    anonKeyTail,
  };
} catch (err) {
  console.warn("Failed to print build banner", err);
}

/**
 * Limpa Service Workers e Cache Storage legados — APENAS UMA VEZ por dispositivo.
 * Antes rodava a cada boot, concorrendo com fetch de auth em redes lentas (3G/4G)
 * e causando falsos "Failed to fetch" / "Conexão instável" no login.
 */
const LEGACY_CLEANUP_FLAG = "praefectus_legacy_cleanup_v2";
const clearLegacyBrowserState = async () => {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(LEGACY_CLEANUP_FLAG) === "done") return;
  } catch { /* storage indisponível, segue */ }

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const cacheKeys = await caches.keys();
      await Promise.all(cacheKeys.map((key) => caches.delete(key)));
    }
    try { localStorage.setItem(LEGACY_CLEANUP_FLAG, "done"); } catch { /* ignore */ }
  } catch (error) {
    console.warn("Failed to clear legacy browser state", error);
  }
};

void clearLegacyBrowserState();
initSecurityGuard();

if (typeof window !== "undefined") {
  window.addEventListener("load", () => {
    clearChunkReloadState();
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
