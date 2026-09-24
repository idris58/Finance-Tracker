import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Cloud, Database, Download, History, Link2, Monitor, Moon, RefreshCw, ShieldAlert, ShieldCheck, Smartphone, Sun, Unlink2, Upload, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useCloudBackupNow, useCloudBackupStatus, useCloudBackupList, useCloudDisconnect, useCloudRestoreLatest, useCloudRestoreByFile, useDirectCloudConnect, useExportData, useImportData, usePreloadCloudBackupAuth, useSettings, useStoragePersistence, useUpdateSettings } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePwaInstall } from "@/lib/pwa";
import { cn } from "@/lib/utils";

const currencies = [
  { symbol: "৳", label: "BDT (৳)" },
  { symbol: "$", label: "USD ($)" },
  { symbol: "€", label: "EUR (€)" },
  { symbol: "£", label: "GBP (£)" },
  { symbol: "₹", label: "INR (₹)" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const exportData = useExportData();
  const importData = useImportData();
  const cloudStatus = useCloudBackupStatus();
  const cloudDisconnect = useCloudDisconnect();
  const cloudBackupNow = useCloudBackupNow();
  const cloudRestoreLatest = useCloudRestoreLatest();
  const preloadCloudBackupAuth = usePreloadCloudBackupAuth();
  const directCloudConnect = useDirectCloudConnect();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { isInstalled, isKnownInstalled, isSupported, isIos, canInstall, promptInstall } = usePwaInstall();
  const { isPersisted, isSupported: isStorageSupported, isRequesting: isRequestingStorage, requestPersist } = useStoragePersistence();
  const [installFeedback, setInstallFeedback] = useState<"accepted" | "dismissed" | "unavailable" | null>(null);
  const [isConnectingCloud, setIsConnectingCloud] = useState(false);
  const [showRestorePicker, setShowRestorePicker] = useState(false);
  const [pickerSelectedId, setPickerSelectedId] = useState<string | null>(null);
  const cloudBackupList = useCloudBackupList();
  const cloudRestoreByFile = useCloudRestoreByFile();

  const handleInstall = async () => {
    const outcome = await promptInstall();
    setInstallFeedback(outcome);
  };

  const handleCurrencyChange = (value: string) => {
    updateSettings.mutate({ currencySymbol: value });
  };

  useEffect(() => {
    preloadCloudBackupAuth();
  }, [preloadCloudBackupAuth]);

  const handleCloudConnect = () => {
    if (isConnectingCloud) return;
    setIsConnectingCloud(true);
    // Use .then/.catch (NOT async/await) so the popup opens
    // in the same synchronous stack frame as the click event.
    directCloudConnect()
      .then(() => setIsConnectingCloud(false))
      .catch(() => setIsConnectingCloud(false));
  };

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const data = JSON.parse(text);
    importData.mutate(data);
    event.target.value = "";
  };

  return (
    <>
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <div className="max-w-md rounded-2xl bg-card/80 p-1.5">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "inline-flex w-1/3 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                  theme === "light"
                    ? "bg-primary text-primary-foreground shadow-[0_10px_22px_-16px_rgba(244,63,94,0.9)]"
                    : "text-foreground/80 hover:text-foreground"
                )}
              >
                <Sun className="h-4 w-4" /> Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "inline-flex w-1/3 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                  theme === "dark"
                    ? "bg-primary text-primary-foreground shadow-[0_10px_22px_-16px_rgba(244,63,94,0.9)]"
                    : "text-foreground/80 hover:text-foreground"
                )}
              >
                <Moon className="h-4 w-4" /> Dark
              </button>
              <button
                onClick={() => setTheme("system")}
                className={cn(
                  "inline-flex w-1/3 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition-all",
                  theme === "system"
                    ? "bg-primary text-primary-foreground shadow-[0_10px_22px_-16px_rgba(244,63,94,0.9)]"
                    : "text-foreground/80 hover:text-foreground"
                )}
              >
                <Monitor className="h-4 w-4" /> System
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Currency</h2>
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <div className="rounded-2xl bg-card/80 p-1.5">
              <Select value={settings?.currencySymbol} onValueChange={handleCurrencyChange}>
                <SelectTrigger className="w-full rounded-2xl border-border/60 bg-card/70">
                  <SelectValue placeholder="Choose currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.symbol} value={currency.symbol}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <h2 className="text-lg font-semibold">Data management</h2>
        <div className="space-y-5 rounded-2xl border border-border/60 bg-card/70 p-4">
          <div className="space-y-3">
            <h3 className="text-base font-semibold">Cloud backup</h3>
            <p className="text-sm text-muted-foreground">
              Backup your app data to Google Drive.
            </p>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-sm">
                  <p className="font-medium">
                    Status: {cloudStatus.data?.connected ? "Connected" : "Not connected"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {cloudStatus.data?.lastBackupAt
                      ? `Last backup: ${new Date(cloudStatus.data.lastBackupAt).toLocaleString()}`
                      : "Stored only on this device until your first backup."}
                  </p>
                  {cloudStatus.data?.connected && cloudStatus.data?.email && (
                    <p className="text-xs text-muted-foreground">
                      Account: {cloudStatus.data.email}
                    </p>
                  )}
                </div>
                {cloudStatus.data?.connected ? (
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={() => cloudDisconnect.mutate()}
                    disabled={cloudDisconnect.isPending}
                  >
                    <Unlink2 className="mr-2 h-4 w-4" /> Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    className="rounded-2xl"
                    onClick={handleCloudConnect}
                    disabled={isConnectingCloud}
                  >
                    <Link2 className="mr-2 h-4 w-4" /> Connect Google
                  </Button>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <Button
                  className="rounded-2xl"
                  onClick={() => cloudBackupNow.mutate()}
                  disabled={!cloudStatus.data?.connected || cloudBackupNow.isPending}
                >
                  <Cloud className="mr-2 h-4 w-4" /> Backup now
                </Button>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  disabled={!cloudStatus.data?.connected || cloudBackupList.isFetching}
                  onClick={() => {
                    setPickerSelectedId(null);
                    setShowRestorePicker(true);
                    cloudBackupList.refetch();
                  }}
                >
                  <History className="mr-2 h-4 w-4" /> Restore data
                </Button>
              </div>
            </div>
          </div>

          <div className="border-t border-border/60" />

          <div className="space-y-3">
            <h3 className="text-base font-semibold">Local backup</h3>
            <p className="text-sm text-muted-foreground">
              Export/import backup files on this device. Importing data will replace your current data.
            </p>
            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button variant="outline" onClick={exportData} className="flex-1 rounded-2xl">
                  <Download className="mr-2 h-4 w-4" /> Export data
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="flex-1 rounded-2xl">
                      <Upload className="mr-2 h-4 w-4" /> Import data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Replace existing data?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Importing a backup will remove your current data. Make sure you have exported a backup if needed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => fileRef.current?.click()}>
                        Continue
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border/60" />

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold">Data eviction protection</h3>
                <p className="text-sm text-muted-foreground">
                  Prevent browsers (especially Safari & Chrome) from wiping your offline data when disk space gets low.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-border/60 bg-background/50 p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      isPersisted === true
                        ? "bg-emerald-500/10 text-emerald-500"
                        : isPersisted === false
                        ? "bg-amber-500/10 text-amber-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isPersisted === true ? (
                      <ShieldCheck className="h-5 w-5" />
                    ) : (
                      <ShieldAlert className="h-5 w-5" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {isPersisted === true
                          ? "Storage is persistent"
                          : isPersisted === false
                          ? "Storage is best-effort (evictable)"
                          : "Checking storage status..."}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                          isPersisted === true
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                            : isPersisted === false
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {isPersisted === true
                          ? "Protected"
                          : isPersisted === false
                          ? "Unprotected"
                          : "Checking"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isPersisted === true
                        ? "Your IndexedDB data will not be cleared automatically by the browser."
                        : !isStorageSupported
                        ? "Persistent storage API is not supported in this browser. Regular cloud or manual backups are recommended."
                        : "The browser may evict local data after inactivity or during storage cleanup. Click Protect to request permanent storage."}
                    </p>
                  </div>
                </div>

                {isStorageSupported && isPersisted === false && (
                  <Button
                    onClick={() => requestPersist()}
                    disabled={isRequestingStorage}
                    className="shrink-0 rounded-2xl"
                    size="sm"
                  >
                    {isRequestingStorage ? (
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    Protect data
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">App</h2>
        <p className="text-sm text-muted-foreground">
          Install the app for faster access and offline usage.
        </p>
        <div className="space-y-3 rounded-2xl border border-border/60 bg-card/70 p-4">
          {isKnownInstalled ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-500" />
              <div>
                <p className="font-medium text-foreground">App already installed</p>
                <p className="text-muted-foreground">
                  {isInstalled
                    ? "Open it from your home screen for the best app-like experience."
                    : "This device already has the installed app. Open it from your home screen or app list."}
                </p>
              </div>
            </div>
          ) : isIos ? (
            <div className="space-y-3 rounded-2xl border border-border/60 bg-background/50 p-4 text-sm">
              <div className="flex items-start gap-3">
                <Smartphone className="mt-0.5 h-4 w-4 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Install on iPhone or iPad</p>
                  <p className="text-muted-foreground">Safari does not show a direct install prompt for PWAs.</p>
                </div>
              </div>
              <p className="text-muted-foreground">
                Open this site in Safari, tap the Share button, then choose <span className="font-medium text-foreground">Add to Home Screen</span>.
              </p>
            </div>
          ) : canInstall ? (
            <>
              <Button onClick={handleInstall} className="w-full rounded-2xl">
                <Smartphone className="mr-2 h-4 w-4" />
                Install app
              </Button>
              {installFeedback === "accepted" && (
                <p className="text-sm text-emerald-500">Install prompt accepted.</p>
              )}
              {installFeedback === "dismissed" && (
                <p className="text-sm text-muted-foreground">Install prompt dismissed. You can try again later.</p>
              )}
            </>
          ) : (
            <div className="space-y-2 rounded-2xl border border-border/60 bg-background/50 p-4 text-sm">
              <p className="font-medium text-foreground">
                {isSupported ? "Install prompt not available in this tab" : "Install is not supported here"}
              </p>
              <p className="text-muted-foreground">
                {isSupported
                  ? "If the app is already installed, open it from your home screen or app list. Otherwise, keep using this site until the browser offers install."
                  : "Try Chrome or Edge on Android or desktop to get the install prompt."}
              </p>
              {installFeedback === "unavailable" && (
                <p className="text-sm text-muted-foreground">No browser install prompt is available right now.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* ── Restore version picker modal ── */}
    {showRestorePicker && (
      <div
        className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        aria-modal="true"
        role="dialog"
        aria-label="Pick a cloud backup version to restore"
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => setShowRestorePicker(false)}
        />

        {/* Panel */}
        <div className="relative z-10 w-full max-w-md rounded-t-3xl sm:rounded-3xl border border-border/60 bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
            <div>
              <h2 className="text-base font-semibold">Choose backup version</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Up to 5 versions kept. Pick any to restore.</p>
            </div>
            <button
              onClick={() => setShowRestorePicker(false)}
              className="rounded-xl p-1.5 hover:bg-muted transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto px-3 py-3 space-y-2">
            {cloudBackupList.isFetching && (
              <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" /> Loading backups…
              </div>
            )}
            {!cloudBackupList.isFetching && cloudBackupList.data && cloudBackupList.data.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">No cloud backups found.</p>
            )}
            {!cloudBackupList.isFetching && cloudBackupList.data?.map((file, idx) => {
              const date = new Date(file.createdTime);
              const isSelected = pickerSelectedId === file.id;
              return (
                <button
                  key={file.id}
                  onClick={() => setPickerSelectedId(isSelected ? null : file.id)}
                  className={cn(
                    "w-full text-left rounded-2xl border px-4 py-3 transition-all",
                    isSelected
                      ? "border-primary bg-primary/10 ring-1 ring-primary"
                      : "border-border/60 bg-background/50 hover:bg-muted/50"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">
                        {idx === 0 ? "Latest" : `Version ${cloudBackupList.data!.length - idx}`}
                        {idx === 0 && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                            newest
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {date.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}
                        {" · "}
                        {date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {isSelected && (
                      <div className="h-4 w-4 shrink-0 rounded-full bg-primary flex items-center justify-center">
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t border-border/60 px-4 py-3 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 rounded-2xl"
              onClick={() => setShowRestorePicker(false)}
            >
              Cancel
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  className="flex-1 rounded-2xl"
                  disabled={!pickerSelectedId || cloudRestoreByFile.isPending}
                >
                  {cloudRestoreByFile.isPending ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Restoring…</>
                  ) : (
                    <><Download className="mr-2 h-4 w-4" /> Restore</>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl">
                <AlertDialogHeader>
                  <AlertDialogTitle>Replace all local data?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will overwrite your current local data with the selected cloud backup. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      const file = cloudBackupList.data?.find((f) => f.id === pickerSelectedId);
                      if (file) {
                        cloudRestoreByFile.mutate(file, {
                          onSuccess: () => setShowRestorePicker(false),
                        });
                      }
                    }}
                  >
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
