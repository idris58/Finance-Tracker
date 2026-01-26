import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeDatabase } from "./lib/db";

// Initialize database before rendering the app
initializeDatabase().then(() => {
  createRoot(document.getElementById("root")!).render(<App />);
}).catch((error) => {
  console.error("Failed to initialize database:", error);
  // Still render the app, but database operations may fail
  createRoot(document.getElementById("root")!).render(<App />);
});
