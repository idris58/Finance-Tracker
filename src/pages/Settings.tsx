import { useRef, useState, type ChangeEvent } from "react";
import { CheckCircle2, Cloud, Download, Link2, Monitor, Moon, Smartphone, Sun, Unlink2, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useCloudBackupNow, useCloudBackupStatus, useCloudConnect, useCloudDisconnect, useCloudRestoreLatest, useExportData, useImportData, useSettings, useUpdateSettings } from "@/hooks/use-finance";
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
  const cloudConnect = useCloudConnect();
  const cloudDisconnect = useCloudDisconnect();
  const cloudBackupNow = useCloudBackupNow();
  const cloudRestoreLatest = useCloudRestoreLatest();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const { isInstalled, isKnownInstalled, isSupported, isIos, canInstall, promptInstall } = usePwaInstall();
  const [installFeedback, setInstallFeedback] = useState<"accepted" | "dismissed" | "unavailable" | null>(null);

  const handleInstall = async () => {
    const outcome = await promptInstall();
    setInstallFeedback(outcome);
  };

  const handleCurrencyChange = (value: string) => {
    updateSettings.mutate({ currencySymbol: value });
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
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Appearance</h2>
          <div className="rounded-2xl border border-border/60 bg-card/70 p-4">
            <div className="max-w-md rounded-2xl border border-border/60 bg-card/80 p-1.5">
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
            <div className="space-y-2">
              <Label>Default currency</Label>
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
                      : "No cloud backup yet."}
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
                    onClick={() => cloudConnect.mutate()}
                    disabled={cloudConnect.isPending}
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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="rounded-2xl"
                      disabled={!cloudStatus.data?.connected || cloudRestoreLatest.isPending}
                    >
                      <Download className="mr-2 h-4 w-4" /> Restore data
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Restore latest cloud backup?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will replace your current local data with the latest backup from Google Drive.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => cloudRestoreLatest.mutate()}>
                        Restore
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
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
                  ? "If the app is already installed on this device, open it from your home screen or app list. Otherwise, keep using the site in a supported browser until the browser offers the install prompt."
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
  );
}
