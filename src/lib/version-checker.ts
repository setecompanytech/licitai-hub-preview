/**
 * Detector automático de nova versão do PRAEFECTUS.
 *
 * Faz polling do /index.html (sem cache) e compara o hash do bundle principal
 * (assets/index-[hash].js) com o que está carregado no momento.
 *
 * Quando uma nova versão é detectada, recarrega a página automaticamente,
 * eliminando a necessidade do usuário usar Cmd+Shift+R.
 *
 * Estratégia conservadora:
 *  - só atua em produção (build);
 *  - aguarda a aba ficar VISÍVEL e o usuário OCIOSO antes de recarregar;
 *  - nunca recarrega em meio a digitação/edição de formulário.
 */

const POLL_INTERVAL_MS = 2 * 60 * 1000; // 2 minutos
const IDLE_THRESHOLD_MS = 30 * 1000; // 30s sem interação
const RELOAD_FLAG = "praefectus:version-reload";

let currentBundleHash: string | null = null;
let lastInteractionAt = Date.now();
let reloadScheduled = false;

function markInteraction() {
  lastInteractionAt = Date.now();
}

function isUserEditing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  // Diálogos/modais abertos — evita recarregar e perder estado
  if (document.querySelector('[role="dialog"][data-state="open"]')) return true;
  return false;
}

async function fetchRemoteBundleHash(): Promise<string | null> {
  try {
    const res = await fetch(`/index.html?_v=${Date.now()}`, {
      cache: "no-store",
      credentials: "omit",
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Captura o primeiro script de entry: assets/index-[hash].js (ou main-[hash].js)
    const match = html.match(/assets\/(?:index|main)-([A-Za-z0-9_-]+)\.js/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function readCurrentBundleHash(): string | null {
  const scripts = Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"));
  for (const s of scripts) {
    const m = s.src.match(/assets\/(?:index|main)-([A-Za-z0-9_-]+)\.js/);
    if (m) return m[1];
  }
  return null;
}

function scheduleReload() {
  if (reloadScheduled) return;
  reloadScheduled = true;

  const tryReload = () => {
    const idle = Date.now() - lastInteractionAt > IDLE_THRESHOLD_MS;
    const visible = document.visibilityState === "visible";
    const editing = isUserEditing();

    if (!visible || editing || !idle) {
      // Adia e tenta de novo em 15s
      setTimeout(tryReload, 15_000);
      return;
    }

    try {
      sessionStorage.setItem(RELOAD_FLAG, "1");
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  // Primeira tentativa em 5s (dá tempo do usuário "respirar")
  setTimeout(tryReload, 5_000);
}

async function checkOnce() {
  const remote = await fetchRemoteBundleHash();
  if (!remote) return;
  if (!currentBundleHash) {
    currentBundleHash = readCurrentBundleHash();
  }
  if (currentBundleHash && remote !== currentBundleHash) {
    scheduleReload();
  }
}

export function installVersionChecker() {
  if (typeof window === "undefined") return;
  // Só faz sentido em build (em dev o HMR cuida disso)
  if (import.meta.env.DEV) return;

  currentBundleHash = readCurrentBundleHash();

  ["mousemove", "keydown", "click", "scroll", "touchstart"].forEach((evt) => {
    window.addEventListener(evt, markInteraction, { passive: true });
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void checkOnce();
    }
  });

  // Primeira verificação 30s após o boot (não compete com o load inicial)
  setTimeout(() => {
    void checkOnce();
    setInterval(() => void checkOnce(), POLL_INTERVAL_MS);
  }, 30_000);
}
