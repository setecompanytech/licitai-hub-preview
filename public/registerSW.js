(async () => {
  if (typeof window === "undefined") return;

  try {
    const registrations =
      "serviceWorker" in navigator
        ? await navigator.serviceWorker.getRegistrations()
        : [];

    const cacheKeys = "caches" in window ? await caches.keys() : [];
    const hadLegacyState = registrations.length > 0 || cacheKeys.length > 0;

    await Promise.all(
      registrations.map((registration) => registration.unregister())
    );
    await Promise.all(cacheKeys.map((key) => caches.delete(key)));

    if (hadLegacyState) {
      window.location.replace(window.location.href);
    }
  } catch (error) {
    console.warn("Legacy service worker cleanup failed", error);
  }
})();
