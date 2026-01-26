import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { Download, Moon, Smartphone, Sun, Upload } from "lucide-react";
import { useTheme } from "next-themes";
import { useExportData, useImportData, useSettings, useUpdateSettings } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const currencies = [
  { symbol: "$", label: "$" },
  { symbol: "€", label: "€" },
  { symbol: "£", label: "£" },
  { symbol: "?", label: "?" },
  { symbol: "?", label: "?" },
];

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const exportData = useExportData();
  const importData = useImportData();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as any);
      setIsInstallable(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
    setIsInstallable(false);
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
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Appearance</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setTheme("light")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium",
              theme === "light" ? "border-primary/50 bg-primary text-primary-foreground" : "border-border/60 bg-card/70"
            )}
          >
            <Sun className="h-4 w-4" /> Light
          </button>
          <button
            onClick={() => setTheme("dark")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium",
              theme === "dark" ? "border-primary/50 bg-primary text-primary-foreground" : "border-border/60 bg-card/70"
            )}
          >
            <Moon className="h-4 w-4" /> Dark
          </button>
          <button
            onClick={() => setTheme("system")}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium",
              theme === "system" ? "border-primary/50 bg-primary text-primary-foreground" : "border-border/60 bg-card/70"
            )}
          >
            System
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Currency</h2>
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

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Data management</h2>
        <p className="text-sm text-muted-foreground">
          Importing data will remove your current data and replace it with the imported file.
        </p>
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

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">App</h2>
        <p className="text-sm text-muted-foreground">
          Install the app for faster access and offline usage.
        </p>
        <Button
          onClick={handleInstall}
          className="w-full rounded-2xl"
          disabled={!isInstallable}
        >
          <Smartphone className="mr-2 h-4 w-4" />
          {isInstallable ? "Install app" : "Install not available"}
        </Button>
      </div>
    </div>
  );
}
