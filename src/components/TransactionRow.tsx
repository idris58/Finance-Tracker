import { format } from "date-fns";
import { Zap } from "lucide-react";
import type { Transaction } from "@shared/schema";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";
import { getLoanProgress } from "@/lib/loans";
import { SensitiveValue } from "@/context/AppStateContext";
import { LoanProgress } from "@/components/LoanProgress";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";

type TransactionRowProps = {
  transaction: Transaction;
  currency: string;
  variant: "home" | "transactions" | "account";
  accountName?: string;
  categoryLabel?: string;
  categoryColor?: string;
  onOpen?: () => void;
  onSettle?: () => void;
};

export function TransactionRow({
  transaction: tx,
  currency,
  variant,
  accountName,
  categoryLabel,
  categoryColor,
  onOpen,
  onSettle,
}: TransactionRowProps) {
  const label = categoryLabel || tx.categoryName || "Uncategorized";
  const positive = tx.type === "income" || (tx.type === "loan" && tx.loanType === "borrow");
  const amount = Number(tx.amount) || 0;

  if (variant === "account") {
    return (
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-3">
        <div className="flex min-w-0 items-center gap-3">
          {categoryColor && <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{label}</p>
            {tx.note && <p className="truncate text-xs text-muted-foreground">{tx.note}</p>}
          </div>
        </div>
        <span className={cn("ml-2 shrink-0 text-sm font-semibold", positive ? "text-emerald-600" : "text-rose-600")}>
          <SensitiveValue>{positive ? "+" : "-"}{currency}{formatMoney(amount)}</SensitiveValue>
        </span>
      </div>
    );
  }

  const entry = getCategoryIcon(label);
  const Icon = entry.icon;
  const isLoan = tx.type === "loan";
  const { remaining } = getLoanProgress(tx);
  const dateText = variant === "home"
    ? `${format(new Date(tx.date), "p")} · ${accountName ?? "Unknown account"}`
    : `${format(new Date(tx.date), "MMM d, yyyy")} · ${accountName ?? "Unknown account"}`;

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 transition hover:border-primary/20">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-start justify-between p-4 text-left",
          variant === "home" && "items-center rounded-2xl hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        )}
        aria-label={`${label}, ${positive ? "+" : "-"}${currency}${formatMoney(amount)}, ${format(new Date(tx.date), "MMM d, yyyy")}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", variant === "home" ? "bg-background" : "bg-background")}>
            <Icon className={cn("h-5 w-5", entry.className)} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="truncate font-medium">{label}</p>
              {isLoan && <StatusBadge status={tx.loanStatus} fallbackLabel="Unsettled" />}
              {variant === "transactions" && isLoan && tx.loanType && (
                <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">{tx.loanType}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{dateText}</p>
            {variant === "transactions" && tx.note && <p className="text-xs italic text-muted-foreground/70">{tx.note}</p>}
            {tx.counterparty && <p className="truncate text-xs text-muted-foreground/80">{tx.counterparty}</p>}
            {variant === "home" && isLoan && tx.loanStatus === "partial" && (
              <p className="text-xs font-medium text-amber-600 dark:text-amber-400">Remaining: {currency}{formatMoney(remaining)}</p>
            )}
            {variant === "transactions" && Array.isArray(tx.tags) && tx.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {tx.tags.map((tag) => <span key={tag} className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-muted-foreground">#{tag}</span>)}
              </div>
            )}
            {variant === "transactions" && isLoan && <LoanProgress tx={tx} currency={currency} />}
          </div>
        </div>
        <div className="ml-3 shrink-0 text-right">
          <p className={cn("font-semibold", variant === "home" ? "text-foreground" : positive ? "text-emerald-500" : "text-foreground")}>
            {positive ? "+" : "-"}{currency}{formatMoney(amount)}
          </p>
          {variant === "transactions" && <p className="text-xs text-muted-foreground">{format(new Date(tx.date), "p")}</p>}
        </div>
      </button>
      {onSettle && isLoan && tx.loanStatus !== "settled" && tx.id !== undefined && (
        <div className="border-t border-border/40 px-4 pb-3 pt-2">
          <button
            type="button"
            onClick={onSettle}
            className="flex items-center gap-1.5 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary"
            aria-label={`Record a payment for loan from ${tx.counterparty ?? "counterparty"}`}
          >
            <Zap className="h-3 w-3" />
            {variant === "home" ? <span className="hidden sm:inline">Settle</span> : "Record payment"}
          </button>
        </div>
      )}
    </div>
  );
}
