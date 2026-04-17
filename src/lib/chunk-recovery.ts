const CHUNK_RELOAD_PREFIX = "praefectus:chunk-reload";

const CHUNK_ERROR_MARKERS = [
  "Failed to fetch dynamically imported module",
  "Importing a module script failed",
  "error loading dynamically imported module",
  "ChunkLoadError",
  "Loading chunk",
  "Load failed",
];

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return String(error ?? "");
}

function getReloadKey() {
  if (typeof window === "undefined") return CHUNK_RELOAD_PREFIX;
  return `${CHUNK_RELOAD_PREFIX}:${window.location.pathname}`;
}

export function clearChunkReloadState() {
  if (typeof window === "undefined") return;

  for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = sessionStorage.key(index);
    if (key?.startsWith(CHUNK_RELOAD_PREFIX)) {
      sessionStorage.removeItem(key);
    }
  }
}

export function isRecoverableChunkError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return CHUNK_ERROR_MARKERS.some((marker) => message.includes(marker.toLowerCase()));
}

export function recoverFromChunkError(error: unknown) {
  if (typeof window === "undefined" || !isRecoverableChunkError(error)) return false;

  const reloadKey = getReloadKey();
  const alreadyReloaded = sessionStorage.getItem(reloadKey) === "1";

  if (alreadyReloaded) {
    sessionStorage.removeItem(reloadKey);
    return false;
  }

  sessionStorage.setItem(reloadKey, "1");
  window.location.reload();
  return true;
}

export function installChunkErrorRecovery() {
  if (typeof window === "undefined") return;

  const handleError = (error: unknown) => {
    recoverFromChunkError(error);
  };

  window.addEventListener(
    "error",
    (event) => {
      const target = event.target;

      if (target instanceof HTMLScriptElement) {
        handleError(`Load failed: ${target.src || "script"}`);
        return;
      }

      if (target instanceof HTMLLinkElement && target.rel === "modulepreload") {
        handleError(`Load failed: ${target.href || "modulepreload"}`);
        return;
      }

      handleError(event.error ?? event.message);
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    handleError(event.reason);
  });
}

export async function lazyImportWithRecovery<T>(importer: () => Promise<T>): Promise<T> {
  try {
    const module = await importer();
    clearChunkReloadState();
    return module;
  } catch (error) {
    if (recoverFromChunkError(error)) {
      return new Promise<T>(() => undefined);
    }

    throw error;
  }
}