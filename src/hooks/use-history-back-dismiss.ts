import { useEffect, useRef } from "react";

let overlaySequence = 0;

export function useHistoryBackDismiss(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const marker = `finance-overlay-${++overlaySequence}`;
    const previousState = window.history.state;
    window.history.pushState({ ...(previousState && typeof previousState === "object" ? previousState : {}), __financeOverlay: marker }, "");
    let popped = false;
    const handlePopState = () => {
      popped = true;
      onCloseRef.current();
    };
    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!popped && window.history.state?.__financeOverlay === marker) window.history.back();
    };
  }, [open]);
}
