import { useState } from "react";
import { Download, Plus, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { usePwaInstall } from "@/lib/pwa";

export function PwaInstallButton() {
  const { isInstalled, isIos, canInstall, promptInstall } = usePwaInstall();
  const { toast } = useToast();
  const [iosGuideOpen, setIosGuideOpen] = useState(false);

  if (isInstalled || (!canInstall && !isIos)) return null;

  const handleInstall = async () => {
    if (canInstall) {
      try {
        const outcome = await promptInstall();
        if (outcome === "accepted") {
          toast({ title: "Install started", description: "Finance Tracker is being added to your device." });
        } else if (outcome === "dismissed") {
          toast({ title: "Installation canceled", description: "You can install Finance Tracker later from your browser menu." });
        }
      } catch (error) {
        toast({
          title: "Could not start installation",
          description: error instanceof Error ? error.message : "Your browser could not start the install prompt.",
          variant: "destructive",
        });
      }
      return;
    }

    if (isIos) setIosGuideOpen(true);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleInstall}
        className="h-9 rounded-full border-primary/25 bg-primary/5 px-2.5 text-foreground hover:bg-primary/10 sm:px-3"
        aria-label="Install Finance Tracker"
        title="Install Finance Tracker"
      >
        <Download className="h-4 w-4 text-primary" />
        <span className="hidden sm:inline">Install</span>
      </Button>

      <Dialog open={iosGuideOpen} onOpenChange={setIosGuideOpen}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader className="pr-8 text-left">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Download className="h-5 w-5" />
            </div>
            <DialogTitle>Install Finance Tracker</DialogTitle>
            <DialogDescription>
              Add the app to your home screen for quick access and offline use.
            </DialogDescription>
          </DialogHeader>
          <ol className="space-y-3 text-sm">
            <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-3">
              <Share className="h-4 w-4 shrink-0 text-primary" />
              <span>Tap <strong>Share</strong> in your browser.</span>
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-3">
              <Plus className="h-4 w-4 shrink-0 text-primary" />
              <span>Choose <strong>Add to Home Screen</strong>.</span>
            </li>
            <li className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/70 p-3">
              <Download className="h-4 w-4 shrink-0 text-primary" />
              <span>Tap <strong>Add</strong> to confirm.</span>
            </li>
          </ol>
        </DialogContent>
      </Dialog>
    </>
  );
}
