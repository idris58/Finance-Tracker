import { useMemo, useState, useEffect } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { Eye, EyeOff, CalendarIcon, ChevronLeft, ChevronRight, Zap } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAccounts, useSettings, useTransactions } from "@/hooks/use-finance";
import { useBalancePrivacy } from "@/hooks/use-balance-privacy";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";
import { formatMoney, roundMoney } from "@/lib/money";
import { LoanSettlementModal } from "@/components/LoanSettlementModal";
import type { Transaction } from "@shared/schema";

const typeTabs = [
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "loan", label: "Loan" },
] as const;

type TxType = (typeof typeTabs)[number]["id"];

export default function HomePage() {
  const [activeType, setActiveType] = useState<TxType>("expense");
  const [monthDate, setMonthDate] = useState<Date>(new Date());
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const { hideBalance, toggleHideBalance } = useBalancePrivacy();
  const [settlementTx, setSettlementTx] = useState<Transaction | null>(null);


  useEffect(() => {
    setPickerYear(monthDate.getFullYear());
  }, [monthDate]);

  const monthKey = format(monthDate, "yyyy-MM");
  const { data: settings } = useSettings();
  const { data: accounts } = useAccounts();
  const { data: transactions, isLoading } = useTransactions({ month: monthKey });
  const { data: allTransactions } = useTransactions();
  const { openEdit, openNew } = useTransactionEditor();
  const [, setLocation] = useLocation();

  const currency = settings?.currencySymbol || "$";
  const totalBalance = roundMoney(accounts?.reduce((sum, acc) => sum + Number(acc.balance || 0), 0) || 0);
  const noAccounts = (accounts || []).length === 0;

  const totals = useMemo(() => {
    const txs = transactions || [];
    const totalExpense = roundMoney(txs.filter((tx) => (tx.type || "expense") === "expense").reduce((sum, tx) => sum + Number(tx.amount), 0));
    const totalIncome = roundMoney(txs.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount), 0));
    const totalBorrow = roundMoney(txs.filter((tx) => tx.type === "loan" && tx.loanType === "borrow").reduce((sum, tx) => sum + Number(tx.amount), 0));
    const totalLend = roundMoney(txs.filter((tx) => tx.type === "loan" && tx.loanType === "lend").reduce((sum, tx) => sum + Number(tx.amount), 0));
    return { totalExpense, totalIncome, totalBorrow, totalLend };
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const txs = transactions || [];
    if (activeType === "loan") {
      return txs.filter((tx) => tx.type === "loan");
    }
    return txs.filter((tx) => (tx.type || "expense") === activeType);
  }, [transactions, activeType]);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof filteredTransactions> = {};
    filteredTransactions.forEach((tx) => {
      const key = format(new Date(tx.date), "EEE, d MMM");
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return groups;
  }, [filteredTransactions]);

  const carriedLoans = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    return (allTransactions || [])
      .filter((tx) => tx.type === "loan" && tx.loanStatus === "open" && new Date(tx.date) < monthStart)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, monthDate]);

  const hasAnyTypeTransactions = useMemo(() => {
    const txs = allTransactions || [];
    if (activeType === "loan") {
      return txs.some((tx) => tx.type === "loan");
    }
    return txs.some((tx) => (tx.type || "expense") === activeType);
  }, [activeType, allTransactions]);

  const emptyState = useMemo(() => {
    if (noAccounts) {
      return {
        title: "Add an account first",
        hint: "Create Cash, Bank, or Mobile Wallet before adding transactions.",
        primaryActionLabel: "Add account",
        onPrimaryAction: () => setLocation("/accounts"),
      };
    }

    if (hasAnyTypeTransactions) {
      return {
        title: `No ${activeType === "loan" ? "loans" : `${activeType}s`} in ${format(monthDate, "MMMM yyyy")}`,
        hint: "Try another month or add one now.",
        primaryActionLabel: "Add transaction",
        onPrimaryAction: openNew,
        secondaryActionLabel: "View last month",
        onSecondaryAction: () => setMonthDate(subMonths(monthDate, 1)),
      };
    }

    return {
      title: `No ${activeType === "loan" ? "loans" : activeType} yet`,
      hint: `Add your first ${activeType === "loan" ? "loan" : activeType} to get started.`,
      primaryActionLabel: "Add transaction",
      onPrimaryAction: openNew,
    };
  }, [activeType, hasAnyTypeTransactions, monthDate, noAccounts, openNew, setLocation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-full border-border/60 bg-card/70 px-4">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(monthDate, "MMMM yyyy")}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-4" align="start">
            <div className="flex items-center justify-between">
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
                onClick={() => setPickerYear((prev) => prev - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="text-sm font-semibold">{pickerYear}</div>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
                onClick={() => setPickerYear((prev) => prev + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Array.from({ length: 12 }, (_, idx) => {
                const monthLabel = format(new Date(2020, idx, 1), "MMM");
                const isActive = monthDate.getFullYear() === pickerYear && monthDate.getMonth() === idx;
                return (
                  <button
                    key={monthLabel}
                    type="button"
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border/60 bg-card/70 text-muted-foreground hover:border-primary/40"
                    )}
                    onClick={() => {
                      setMonthDate(new Date(pickerYear, idx, 1));
                      setIsMonthPickerOpen(false);
                    }}
                  >
                    {monthLabel}
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/60 to-card/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total balance</p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">
                {hideBalance ? "******" : `${currency}${formatMoney(totalBalance)}`}
              </h2>
              <button
                onClick={toggleHideBalance}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-muted-foreground"
              >
                {hideBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="rounded-2xl bg-background/50 px-3 py-2 text-xs text-muted-foreground">
            {format(monthDate, "MMM yyyy")}
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        {typeTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveType(tab.id)}
            className={cn(
              "flex-1 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
              activeType === tab.id
                ? "border-primary/40 bg-primary text-primary-foreground shadow-[0_12px_30px_-20px_rgba(244,63,94,0.8)]"
                : "border-border/60 bg-card/70 text-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeType === "expense" && (
        <div className="rounded-3xl border border-border/60 bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Total expenditure</p>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {currency}{formatMoney(totals.totalExpense)}
          </div>
        </div>
      )}

      {activeType === "income" && (
        <div className="rounded-3xl border border-border/60 bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Total income</p>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {currency}{formatMoney(totals.totalIncome)}
          </div>
        </div>
      )}

      {activeType === "loan" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-3xl border border-border/60 bg-card/80 p-4">
              <p className="text-xs text-muted-foreground">Borrow</p>
              <div className="mt-2 text-xl font-semibold text-rose-500">
                {currency}{formatMoney(totals.totalBorrow)}
              </div>
            </div>
            <div className="rounded-3xl border border-border/60 bg-card/80 p-4">
              <p className="text-xs text-muted-foreground">Lend</p>
              <div className="mt-2 text-xl font-semibold text-emerald-500">
                {currency}{formatMoney(totals.totalLend)}
              </div>
            </div>
          </div>

          {carriedLoans.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                <p className="font-medium">Unsettled loans from previous months</p>
                <span>Before {format(monthDate, "MMM yyyy")}</span>
              </div>

              <div className="space-y-2">
                {carriedLoans.map((tx) => {
                  const entry = getCategoryIcon(tx.categoryName);
                  const Icon = entry.icon;
                  const totalAmount = Number(tx.amount);
                  const totalSettled = roundMoney((tx.settlements ?? []).reduce((sum, s) => sum + Number(s.amount), 0));
                  const remaining = roundMoney(Math.max(0, totalAmount - totalSettled));
                  const percent = totalAmount > 0 ? (totalSettled / totalAmount) * 100 : 0;
                  return (
                    <div key={tx.id} className="overflow-hidden rounded-2xl border border-border/60 bg-background/70 transition hover:border-primary/20">
                      <button
                        onClick={() => tx.id && openEdit(tx)}
                        className="flex w-full items-center justify-between p-4 text-left"
                        aria-label={`Open loan ${tx.categoryName ?? ""} from ${tx.counterparty ?? "counterparty"}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-card">
                            <Icon className={cn("h-5 w-5", entry.className)} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{tx.categoryName || "Loan"}</p>
                              <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                {tx.loanStatus ?? "open"}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.date), "MMM d, yyyy")} · {tx.paymentMethod}
                            </p>
                            {tx.counterparty && <p className="text-xs text-muted-foreground/80">{tx.counterparty}</p>}
                            <div className="mt-2 space-y-1">
                              <div
                                className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
                                role="progressbar"
                                aria-valuenow={Math.round(percent)}
                                aria-valuemin={0}
                                aria-valuemax={100}
                              >
                                <div
                                  className={cn(
                                    "h-full rounded-full transition-all duration-500",
                                    tx.loanStatus === "partial" ? "bg-amber-400" : "bg-rose-400"
                                  )}
                                  style={{ width: `${Math.min(100, percent)}%` }}
                                />
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                {Math.round(percent)}% paid · {currency}{formatMoney(remaining)} left
                              </p>
                            </div>
                          </div>
                        </div>
                        <p className="ml-3 shrink-0 font-semibold text-foreground">
                          {tx.loanType === "borrow" ? "+" : "-"}
                          {currency}{formatMoney(Number(tx.amount))}
                        </p>
                      </button>
                      <div className="border-t border-border/40 px-4 pb-3 pt-2">
                        <button
                          type="button"
                          onClick={() => setSettlementTx(tx)}
                          className="flex items-center gap-1.5 rounded-xl bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-500/20 dark:text-indigo-400"
                        >
                          <Zap className="h-3 w-3" />
                          Pay now
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

        <div className="space-y-4">
          {isLoading && <p className="text-sm text-muted-foreground">Loading transactions...</p>}
          {!isLoading && filteredTransactions.length === 0 && (
            <EmptyState {...emptyState} />
          )}

        {!isLoading && filteredTransactions.length > 0 && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Recent transactions</p>
              <Link href="/transactions">
                <Button variant="outline" size="sm" className="rounded-full px-4">
                  View all
                </Button>
              </Link>
            </div>
            {Object.entries(grouped).map(([date, items]) => (
              <div key={date} className="space-y-3">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>{date}</span>
                  <span>
                    {currency}
                    {formatMoney(items.reduce((sum, tx) => sum + Number(tx.amount), 0))}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((tx) => {
                    const entry = getCategoryIcon(tx.categoryName);
                    const Icon = entry.icon;
                    const txSettled = tx.settlements?.reduce((s, st) => s + Number(st.amount), 0) || 0;
                    const txRemaining = Math.max(0, Number(tx.amount) - txSettled);
                    const isUnsettledLoan = tx.type === "loan" && tx.loanStatus !== "settled";

                    return (
                      <div
                        key={tx.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => tx.id && openEdit(tx)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            tx.id && openEdit(tx);
                          }
                        }}
                        className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4 text-left transition hover:border-primary/30 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background">
                            <Icon className={cn("h-5 w-5", entry.className)} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium truncate">{tx.categoryName || "Uncategorized"}</p>
                              {tx.type === "loan" && (
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase border",
                                    tx.loanStatus === "settled"
                                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                      : tx.loanStatus === "partial"
                                        ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                                        : "bg-rose-500/10 text-rose-600 border-rose-500/20"
                                  )}
                                >
                                  {tx.loanStatus === "settled" ? "Settled" : tx.loanStatus === "partial" ? "Partial" : "Unsettled"}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.date), "p")} - {tx.paymentMethod}
                            </p>
                            {tx.type === "loan" && tx.loanStatus === "partial" && (
                              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                Remaining: {currency}{formatMoney(txRemaining)}
                              </p>
                            )}
                            {tx.type === "loan" && tx.loanStatus === "settled" && tx.settlementDate && (
                              <p className="text-xs text-muted-foreground/80">
                                Settled {format(new Date(tx.settlementDate), "MMM d, yyyy")}
                                {tx.loanSettlementAccountId && tx.loanSettlementAccountId !== tx.accountId && accounts?.find((account) => account.id === tx.loanSettlementAccountId)?.name
                                  ? ` - ${accounts.find((account) => account.id === tx.loanSettlementAccountId)?.name}`
                                  : ""}
                              </p>
                            )}
                            {tx.counterparty && (
                              <p className="text-xs text-muted-foreground/80 truncate">{tx.counterparty}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className="font-semibold text-foreground">
                              {activeType === "income" || (tx.type === "loan" && tx.loanType === "borrow") ? "+" : "-"}
                              {currency}{formatMoney(Number(tx.amount))}
                            </p>
                          </div>
                          {isUnsettledLoan && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSettlementTx(tx);
                              }}
                              className="inline-flex items-center gap-1 rounded-xl bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-primary"
                              title="Settle or record partial payment"
                              aria-label={`Settle loan ${tx.categoryName || ""}`}
                            >
                              <Zap className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Settle</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {settlementTx && (
        <LoanSettlementModal
          open={!!settlementTx}
          onOpenChange={(o) => { if (!o) setSettlementTx(null); }}
          transaction={settlementTx}
        />
      )}
    </div>
  );
}
