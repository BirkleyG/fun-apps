import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { APP_VERSION } from "./version";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    const swUrl = `${import.meta.env.BASE_URL}sw.js?v=${APP_VERSION}`;
    navigator.serviceWorker.register(swUrl).then((reg) => {
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
    }).catch(() => undefined);
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
