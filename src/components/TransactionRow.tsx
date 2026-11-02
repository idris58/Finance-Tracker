import { format } from "date-fns";
import { ArrowLeftRight, Zap } from "lucide-react";
import type { Transaction, Transfer } from "@shared/schema";
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
  runningBalance?: number;
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
  runningBalance,
  onOpen,
  onSettle,
}: TransactionRowProps) {
  const label = categoryLabel || tx.categoryName || "Uncategorized";
  const positive = tx.type === "income" || (tx.type === "loan" && tx.loanType === "borrow");
  const amount = Number(tx.amount) || 0;

  if (variant === "account") {
    const content = (
      <>
        <div className="flex min-w-0 items-center gap-3">
          {categoryColor && <div className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: categoryColor }} />}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{label}</p>
            {tx.note && <p className="truncate text-xs text-muted-foreground">{tx.note}</p>}
            {tx.counterparty && <p className="truncate text-xs text-muted-foreground/80">{tx.counterparty}</p>}
          </div>
        </div>
        <div className="ml-2 shrink-0 text-right">
          <p className={cn("text-sm font-semibold", positive ? "text-emerald-600" : "text-rose-600")}>
            <SensitiveValue>{positive ? "+" : "-"}{currency}{formatMoney(amount)}</SensitiveValue>
          </p>
          {runningBalance !== undefined && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Balance <SensitiveValue>{currency}{formatMoney(runningBalance)}</SensitiveValue>
            </p>
          )}
        </div>
      </>
    );
    return onOpen ? (
      <button type="button" onClick={onOpen} className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-3 text-left transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        {content}
      </button>
    ) : (
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-3">{content}</div>
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

export function TransferFeedRow({
  transfer,
  currency,
  fromAccountName,
  toAccountName,
  onOpen,
}: {
  transfer: Transfer;
  currency: string;
  fromAccountName: string;
  toAccountName: string;
  onOpen: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 transition hover:border-primary/20">
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full flex-col gap-3 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary sm:flex-row sm:items-center sm:justify-between"
        aria-label={`Transfer ${currency}${formatMoney(Number(transfer.amount))} from ${fromAccountName} to ${toAccountName}`}
      >
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ArrowLeftRight className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">Transfer</p>
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Between accounts</span>
            </div>
            <p className="break-words text-xs text-muted-foreground">{fromAccountName} <span aria-hidden="true">→</span> {toAccountName}</p>
            {transfer.note && <p className="break-words text-xs text-muted-foreground/80">{transfer.note}</p>}
          </div>
        </div>
        <div className="flex w-full items-center justify-between gap-2 pl-14 sm:w-auto sm:shrink-0 sm:pl-0">
          <span className="text-xs text-muted-foreground sm:hidden">{format(new Date(transfer.date), "p")}</span>
          <div className="text-right">
            <p className="font-semibold text-foreground">{currency}{formatMoney(Number(transfer.amount))}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">{format(new Date(transfer.date), "p")}</p>
          </div>
        </div>
      </button>
    </div>
  );
}
