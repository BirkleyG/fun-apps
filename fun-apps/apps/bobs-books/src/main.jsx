import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "@fontsource-variable/newsreader";
import "@fontsource-variable/plus-jakarta-sans";
import "./index.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => registration.update().catch(() => undefined))
      .catch(() => undefined);
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
