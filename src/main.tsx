import { useEffect, useState, type ChangeEvent } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeDatabase } from "./lib/db";
import { storage } from "./lib/storage";
import { backupFileSchema, CURRENT_SCHEMA_VERSION } from "@shared/schema";
import type { BeforeInstallPromptEvent } from "./lib/pwa";

const handleBeforeInstallPrompt = (event: Event) => {
  event.preventDefault();
  window.deferredInstallPrompt = event as BeforeInstallPromptEvent;
  window.dispatchEvent(new Event("app-installable"));
};

const handleAppInstalled = () => {
  window.deferredInstallPrompt = undefined;
  window.dispatchEvent(new Event("app-installed"));
};

window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
window.addEventListener("appinstalled", handleAppInstalled);

if (typeof navigator !== "undefined" && navigator.storage?.persist) {
  navigator.storage.persisted().then((isPersisted) => {
    if (!isPersisted) navigator.storage.persist().catch(() => {});
  }).catch(() => {});
}

function DatabaseFailureScreen({ error, onRecovered }: { error: unknown; onRecovered: () => void }) {
  const [isImporting, setIsImporting] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [message, setMessage] = useState("");

  const recover = async () => {
    setIsRetrying(true);
    setMessage("");
    try {
      await initializeDatabase();
      onRecovered();
    } catch (retryError) {
      setMessage(retryError instanceof Error ? retryError.message : "The database is still unavailable.");
    } finally {
      setIsRetrying(false);
    }
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setMessage("");
    try {
      const raw: unknown = JSON.parse(await file.text());
      if (raw && typeof raw === "object" && "schemaVersion" in raw) {
        const version = (raw as { schemaVersion?: unknown }).schemaVersion;
        if (typeof version === "number" && version > CURRENT_SCHEMA_VERSION) {
          throw new Error(`This backup uses schema version ${version}, newer than this app supports (${CURRENT_SCHEMA_VERSION}). Update the app before importing it.`);
        }
      }
      const parsed = backupFileSchema.safeParse(raw);
      if (!parsed.success) {
        throw new Error(parsed.error.errors.slice(0, 4).map((issue) => `${issue.path.join(".") || "file"}: ${issue.message}`).join("; "));
      }
      await storage.importData(parsed.data as any);
      await initializeDatabase();
      onRecovered();
    } catch (importError) {
      setMessage(importError instanceof Error ? importError.message : "Could not read or import this backup.");
    } finally {
      setIsImporting(false);
      event.target.value = "";
    }
  };

  const initialMessage = error instanceof Error ? error.message : "The local database could not be opened.";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <section className="w-full max-w-xl space-y-5 rounded-3xl border border-border bg-card p-6 shadow-lg sm:p-8" role="alert">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Your local database is unavailable</h1>
          <p className="text-sm text-muted-foreground">
            Finance Tracker could not open browser storage. IndexedDB may be blocked or disabled, which can happen in private browsing or when site storage is restricted. The app is paused to protect your data.
          </p>
        </div>
        <details className="rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium">Technical details</summary>
          <p className="mt-2 break-words">{initialMessage}</p>
        </details>
        <div className="space-y-3">
          <label className="block text-sm font-medium" htmlFor="startup-backup">Import a JSON backup</label>
          <input
            id="startup-backup"
            type="file"
            accept="application/json,.json"
            onChange={handleImport}
            disabled={isImporting || isRetrying}
            className="block w-full text-sm file:mr-3 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:font-semibold file:text-primary-foreground"
          />
          {isImporting && <p className="text-sm text-muted-foreground">Validating and importing backup…</p>}
        </div>
        {message && <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{message}</p>}
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void recover()}
            disabled={isRetrying || isImporting}
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {isRetrying ? "Retrying…" : "Retry database"}
          </button>
          <p className="self-center text-xs text-muted-foreground">If storage is disabled, enable it in your browser and retry.</p>
        </div>
      </section>
    </main>
  );
}

function StartupGate() {
  const [startupError, setStartupError] = useState<unknown>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initializeDatabase().then(() => setReady(true)).catch((error) => {
      console.error("Failed to initialize database:", error);
      setStartupError(error);
    });
  }, []);

  if (ready) return <App />;
  if (startupError) return <DatabaseFailureScreen error={startupError} onRecovered={() => { setStartupError(null); setReady(true); }} />;
  return <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Opening your local database…</main>;
}

createRoot(document.getElementById("root")!).render(<StartupGate />);
