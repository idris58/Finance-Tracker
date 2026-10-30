import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";

export function PwaUpdateToast() {
  const { toast } = useToast();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(error) {
      console.error("PWA Service Worker registration error:", error);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      toast({
        title: "New version available",
        description: "An update is ready to install. Reload to apply changes.",
        action: (
          <ToastAction
            altText="Reload to update"
            onClick={() => {
              void updateServiceWorker(true);
            }}
          >
            Reload
          </ToastAction>
        ),
        duration: 30000,
      });
    }
  }, [needRefresh, toast, updateServiceWorker]);

  return null;
}

