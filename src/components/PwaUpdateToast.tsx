import { useEffect, useRef } from "react";
import { RefreshCw } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { Button } from "@/components/ui/button";
import { ToastClose, ToastTitle } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";

const UPDATE_TOAST_ID = "pwa-update-available";

export function PwaUpdateToast() {
  const { toast, dismiss } = useToast();
  const hasShownUpdateToast = useRef(false);
  const isActivatingUpdate = useRef(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("PWA service worker registration error:", error);
    },
  });

  useEffect(() => {
    if (
      !needRefresh ||
      hasShownUpdateToast.current ||
      !("serviceWorker" in navigator) ||
      !navigator.serviceWorker.controller
    ) {
      return;
    }

    hasShownUpdateToast.current = true;

    toast({
      id: UPDATE_TOAST_ID,
      duration: Infinity,
      className: "block w-[calc(100vw-2rem)] max-w-[370px] space-x-0 rounded-2xl border-border/70 bg-card p-0 text-card-foreground shadow-2xl ring-1 ring-primary/10",
      content: (
        <div className="overflow-hidden rounded-2xl">
          <div className="h-1 bg-gradient-to-r from-primary/55 via-primary to-primary/55" />
          <div className="p-4">
            <div className="flex items-start gap-3 pr-7">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                <RefreshCw className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <ToastTitle className="text-sm font-semibold text-foreground">Update available</ToastTitle>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  A new version of Finance Tracker is ready.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-muted-foreground"
                onClick={() => dismiss(UPDATE_TOAST_ID)}
              >
                Later
              </Button>
              <Button
                type="button"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  if (isActivatingUpdate.current) return;
                  isActivatingUpdate.current = true;
                  dismiss(UPDATE_TOAST_ID);
                  void updateServiceWorker(true).catch((error) => {
                    isActivatingUpdate.current = false;
                    console.error("Could not activate PWA update:", error);
                    toast({
                      title: "Update could not be installed",
                      description: "Try refreshing the page again later.",
                      variant: "destructive",
                    });
                  });
                }}
              >
                Update now
              </Button>
            </div>
          </div>
          <ToastClose
            aria-label="Dismiss update notification"
            className="right-3 top-3 rounded-lg p-1.5 text-muted-foreground opacity-100 hover:bg-muted hover:text-foreground focus:opacity-100 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
          </ToastClose>
        </div>
      ),
    });
  }, [dismiss, needRefresh, toast, updateServiceWorker]);

  return null;
}
