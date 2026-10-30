import { useSettings } from "@/hooks/use-finance";

const DEFAULT_CURRENCY_SYMBOL = "৳";

export function useCurrency(): string {
  const { data: settings } = useSettings();
  return settings?.currencySymbol || DEFAULT_CURRENCY_SYMBOL;
}
