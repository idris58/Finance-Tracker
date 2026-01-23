import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeDatabase } from "./lib/db";

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        console.log('Service Worker registered:', registration);
      })
      .catch((error) => {
        console.log('Service Worker registration failed:', error);
      });
  });
}

// Initialize database before rendering the app
initializeDatabase().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}).catch((error) => {
  console.error("Failed to initialize database:", error);
  // Still render the app, but database operations may fail
  createRoot(document.getElementById("root")!).render(<App />);
});
