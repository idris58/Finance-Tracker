import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { getLoanProgress } from "@/lib/loans";
import type { Transaction } from "@shared/schema";

interface LoanProgressProps {
  tx: Partial<Transaction> | undefined | null;
  currency: string;
  className?: string;
  showLabels?: boolean;
}

export function LoanProgress({
  tx,
  currency,
  className,
  showLabels = true,
}: LoanProgressProps) {
  const { totalSettled, remaining, percent, isSettled, status } = getLoanProgress(tx);

  const fillClass = isSettled
    ? "bg-emerald-500"
    : status === "partial"
      ? "bg-amber-500"
      : "bg-rose-500";

  return (
    <div className={cn("mt-2 w-full space-y-1", className)}>
      {showLabels && (
        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Settled: {currency}{formatMoney(totalSettled)}</span>
          <span>Remaining: {currency}{formatMoney(remaining)}</span>
        </div>
      )}
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/80"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(percent)}% of loan settled`}
      >
        <div
          className={cn("h-full transition-all duration-300", fillClass)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

