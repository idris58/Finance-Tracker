import { Eye, EyeOff } from "lucide-react";
import { useCurrency } from "@/hooks/use-currency";
import { useBalancePrivacy } from "@/hooks/use-balance-privacy";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

interface BalanceCardProps {
  totalBalance: number;
  subtitle?: string;
  badgeText?: string;
  action?: React.ReactNode;
  className?: string;
}

export function BalanceCard({
  totalBalance,
  subtitle,
  badgeText,
  action,
  className,
}: BalanceCardProps) {
  const currency = useCurrency();
  const { hideBalance, toggleHideBalance } = useBalancePrivacy();

  return (
    <div
      className={cn(
        "rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/60 to-card/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Total balance</p>
          <div className="mt-2 flex items-center gap-3">
            <h2 className="text-3xl font-semibold tracking-tight">
              {hideBalance ? "******" : `${currency}${formatMoney(totalBalance)}`}
            </h2>
            <button
              type="button"
              onClick={toggleHideBalance}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-muted-foreground hover:text-foreground hover:bg-background/90 transition-colors"
              aria-label={hideBalance ? "Show balance" : "Hide balance"}
            >
              {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {subtitle && (
            <p className="mt-2 text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
        {action ? (
          <div className="shrink-0">{action}</div>
        ) : badgeText ? (
          <div className="rounded-2xl bg-background/50 px-3 py-2 text-xs text-muted-foreground font-medium shrink-0">
            {badgeText}
          </div>
        ) : null}
      </div>
    </div>
  );
}
