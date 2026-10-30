import { useAppState } from "@/context/AppStateContext";

export function useBalancePrivacy() {
  const { hideBalance, toggleHideBalance } = useAppState();
  return { hideBalance, toggleHideBalance };
}
