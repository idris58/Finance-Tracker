import { useEffect, useMemo, useState } from "react";

export type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform?: string }>;
};

declare global {
  interface Navigator {
    standalone?: boolean;
  }

  interface Window {
    deferredInstallPrompt?: BeforeInstallPromptEvent;
  }
}

const isIosDevice = () => {
  if (typeof window === "undefined") return false;
  const userAgent = window.navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

const isStandaloneMode = () => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
};

const canUseInstallPrompt = () => {
  if (typeof window === "undefined") return false;
  return "onbeforeinstallprompt" in window;
};

export function usePwaInstall() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(() => {
    if (typeof window === "undefined") return null;
    return window.deferredInstallPrompt ?? null;
  });
  const [isInstalled, setIsInstalled] = useState(() => isStandaloneMode());
  const [isIos, setIsIos] = useState(() => isIosDevice());

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");

    const syncInstallState = () => {
      setIsInstalled(isStandaloneMode());
      setIsIos(isIosDevice());
      setInstallPrompt(window.deferredInstallPrompt ?? null);
    };

    const handleInstallable = () => {
      setInstallPrompt(window.deferredInstallPrompt ?? null);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    syncInstallState();
    window.addEventListener("app-installable", handleInstallable);
    window.addEventListener("app-installed", handleInstalled);
    mediaQuery.addEventListener("change", syncInstallState);

    return () => {
      window.removeEventListener("app-installable", handleInstallable);
      window.removeEventListener("app-installed", handleInstalled);
      mediaQuery.removeEventListener("change", syncInstallState);
    };
  }, []);

  const canInstall = !!installPrompt && !isInstalled;
  const isSupported = useMemo(() => {
    return isIos || canUseInstallPrompt() || canInstall || isInstalled;
  }, [canInstall, isInstalled, isIos]);

  const promptInstall = async (): Promise<"accepted" | "dismissed" | "unavailable"> => {
    const deferred = window.deferredInstallPrompt ?? installPrompt;
    if (!deferred || isInstalled) {
      return "unavailable";
    }

    await deferred.prompt();
    const choice = await deferred.userChoice;
    window.deferredInstallPrompt = undefined;
    setInstallPrompt(null);

    if (choice.outcome === "accepted") {
      setIsInstalled(true);
      return "accepted";
    }

    return "dismissed";
  };

  return {
    isInstalled,
    isSupported,
    isIos,
    canInstall,
    promptInstall,
  };
}
