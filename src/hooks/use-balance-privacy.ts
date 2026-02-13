import { useEffect, useState } from "react";

const STORAGE_KEY = "hideBalance";

export function useBalancePrivacy() {
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "true";
  });

  const toggleHideBalance = () => {
    setHideBalance((prev) => !prev);
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, String(hideBalance));
  }, [hideBalance]);

  return { hideBalance, toggleHideBalance };
}
