import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeDatabase } from "./lib/db";

declare global {
  interface Window {
    deferredInstallPrompt?: Event;
  }
}

const handleBeforeInstallPrompt = (event: Event) => {
  event.preventDefault();
  window.deferredInstallPrompt = event;
  window.dispatchEvent(new Event("app-installable"));
};

const handleAppInstalled = () => {
  window.deferredInstallPrompt = undefined;
  window.dispatchEvent(new Event("app-installed"));
};

window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
window.addEventListener("appinstalled", handleAppInstalled);

// Initialize database before rendering the app
initializeDatabase().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}).catch((error) => {
  console.error("Failed to initialize database:", error);
  // Still render the app, but database operations may fail
  createRoot(document.getElementById("root")!).render(<App />);
});
