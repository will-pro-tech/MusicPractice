import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Gate from "./Gate";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gate>
      <App />
    </Gate>
  </StrictMode>,
);

// Register the service worker so the app is installable ("Add to Home Screen").
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* offline support is best-effort */
    });
  });
}
