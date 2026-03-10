import "./app";
import { APP_VERSION } from "./version";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js?v=${APP_VERSION}`;
    const cleanKey = `museumMasterpiecesSwClean_${APP_VERSION}`;
    const cleanup = () => {
      if (window.localStorage.getItem(cleanKey)) return Promise.resolve(false);
      window.localStorage.setItem(cleanKey, "1");
      return navigator.serviceWorker.getRegistrations().then((regs) => {
        const targets = regs.filter((r) => r.scope.includes("/museum-masterpieces/") && !r.active?.scriptURL?.includes(`sw.js?v=${APP_VERSION}`));
        return Promise.all(targets.map((r) => r.unregister())).then(() => true);
      }).then((didUnregister) => {
        if (!("caches" in window)) return didUnregister;
        return caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("museum-masterpieces-")).map((k) => caches.delete(k)))).then(() => didUnregister);
      }).catch(() => false);
    };
    navigator.serviceWorker.register(swUrl, { updateViaCache: "none" }).then((reg) => {
      reg.update();
      if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" });
      reg.addEventListener("updatefound", () => {
        const next = reg.installing;
        if (!next) return;
        next.addEventListener("statechange", () => {
          if (next.state === "installed" && navigator.serviceWorker.controller) {
            next.postMessage({ type: "SKIP_WAITING" });
          }
        });
      });
      cleanup().then((didClean) => { if (didClean) window.location.reload(); });
    }).catch(() => undefined);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}