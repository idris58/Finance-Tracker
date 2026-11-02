import { useMemo, useState } from "react";
import { format, startOfMonth, subMonths } from "date-fns";
import { Zap } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAccounts, useTransactions } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { useHistoryBackDismiss } from "@/hooks/use-history-back-dismiss";
import { useAppState } from "@/context/AppStateContext";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { MonthPicker } from "@/components/MonthPicker";
import { BalanceCard } from "@/components/BalanceCard";
import { LoanProgress } from "@/components/LoanProgress";
import { StatusBadge } from "@/components/StatusBadge";
import { getLoanProgress } from "@/lib/loans";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";
import { formatMoney, roundMoney } from "@/lib/money";
import { LoanSettlementModal } from "@/components/LoanSettlementModal";
import type { Transaction } from "@shared/schema";
import { TransactionTypeTabs, type TransactionType } from "@/components/TransactionTypeTabs";
import { getTransactionEmptyState } from "@/lib/transaction-empty-state";
import { TransactionRow } from "@/components/TransactionRow";

export default function HomePage() {
  const [activeType, setActiveType] = useState<TransactionType>("expense");
  const { monthDate, setMonthDate } = useAppState();
  
  const [settlementTxId, setSettlementTxId] = useState<number | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  useHistoryBackDismiss(settlementOpen, () => setSettlementOpen(false));


  

  const monthKey = format(monthDate, "yyyy-MM");
  const { data: accounts } = useAccounts();
  const { data: allTransactions, isLoading } = useTransactions();
  const transactions = useMemo(() => {
    return (allTransactions || []).filter((tx) => {
      const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
      return format(d, "yyyy-MM") === monthKey;
    });
  }, [allTransactions, monthKey]);
  const settlementTx = allTransactions?.find((transaction) => transaction.id === settlementTxId) ?? null;
  const { openEdit, openNew } = useTransactionEditor();
  const [, setLocation] = useLocation();

  const currency = useCurrency();
  const totalBalance = roundMoney(accounts?.reduce((sum, acc) => sum + Number(acc.balance || 0), 0) || 0);
  const noAccounts = (accounts || []).length === 0;
  const getAccountName = (accountId?: number | null) => accounts?.find((account) => account.id === accountId)?.name ?? "Unknown account";

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

  const recentTransactions = useMemo(
    () => [...filteredTransactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10),
    [filteredTransactions]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, typeof recentTransactions> = {};
    recentTransactions.forEach((tx) => {
      const key = format(new Date(tx.date), "EEE, d MMM");
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return groups;
  }, [recentTransactions]);

  const carriedLoans = useMemo(() => {
    const monthStart = startOfMonth(monthDate);
    return (allTransactions || [])
      .filter((tx) => tx.type === "loan" && tx.loanStatus !== "settled" && new Date(tx.date) < monthStart)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, monthDate]);

  const hasAnyTypeTransactions = useMemo(() => {
    const txs = allTransactions || [];
    if (activeType === "loan") {
      return txs.some((tx) => tx.type === "loan");
    }
    return txs.some((tx) => (tx.type || "expense") === activeType);
  }, [activeType, allTransactions]);

  const emptyState = getTransactionEmptyState({
    context: "home",
    noAccounts,
    onAddAccount: () => setLocation("/accounts"),
    onAddTransaction: openNew,
    hasAnyTypeTransactions,
    activeType,
    monthDate,
    onViewPreviousMonth: () => setMonthDate(subMonths(monthDate, 1)),
  });

  return (
    <div className="space-y-6">
      <BalanceCard
        totalBalance={totalBalance}
        action={<MonthPicker value={monthDate} onChange={setMonthDate} align="end" />}
      />

      <TransactionTypeTabs value={activeType} onValueChange={setActiveType} />

      <div className="grid grid-cols-3 gap-2 sm:gap-3" aria-label="Monthly income, expense, and net totals">
        <div className="min-w-0 rounded-2xl border border-border/60 bg-card/80 p-3 sm:rounded-3xl sm:p-4">
          <p className="truncate text-[11px] text-muted-foreground sm:text-sm">Income</p>
          <p className="mt-1 truncate text-sm font-semibold text-emerald-600 sm:text-lg">{currency}{formatMoney(totals.totalIncome)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-border/60 bg-card/80 p-3 sm:rounded-3xl sm:p-4">
          <p className="truncate text-[11px] text-muted-foreground sm:text-sm">Expense</p>
          <p className="mt-1 truncate text-sm font-semibold text-rose-600 sm:text-lg">{currency}{formatMoney(totals.totalExpense)}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-border/60 bg-card/80 p-3 sm:rounded-3xl sm:p-4">
          <p className="truncate text-[11px] text-muted-foreground sm:text-sm">Net</p>
          <p className={cn("mt-1 truncate text-sm font-semibold sm:text-lg", totals.totalIncome - totals.totalExpense >= 0 ? "text-emerald-600" : "text-rose-600")}>
            {currency}{formatMoney(roundMoney(totals.totalIncome - totals.totalExpense))}
          </p>
        </div>
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
                  const { totalSettled, remaining, percent } = getLoanProgress(tx);
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
                              <StatusBadge status={tx.loanStatus} fallbackLabel="Unsettled" />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.date), "MMM d, yyyy")} · {getAccountName(tx.accountId)}
                            </p>
                            {tx.counterparty && <p className="text-xs text-muted-foreground/80">{tx.counterparty}</p>}
                            <LoanProgress tx={tx} currency={currency} />
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
                          onClick={() => { setSettlementTxId(tx.id ?? null); setSettlementOpen(true); }}
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
                  {activeType === "loan" ? (
                    <div className="flex gap-3 text-xs">
                      <span className="text-rose-500">Borrow {currency}{formatMoney(items.filter((tx) => tx.loanType === "borrow").reduce((sum, tx) => sum + Number(tx.amount), 0))}</span>
                      <span className="text-emerald-500">Lend {currency}{formatMoney(items.filter((tx) => tx.loanType === "lend").reduce((sum, tx) => sum + Number(tx.amount), 0))}</span>
                    </div>
                  ) : (
                    <span>
                      {currency}{formatMoney(items.reduce((sum, tx) => sum + Number(tx.amount), 0))}
                    </span>
                  )}
                </div>
                <div className="space-y-2">
                  {items.map((tx) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={tx}
                      currency={currency}
                      variant="home"
                      accountName={getAccountName(tx.accountId)}
                      onOpen={() => tx.id && openEdit(tx)}
                      onSettle={() => { setSettlementTxId(tx.id ?? null); setSettlementOpen(true); }}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {settlementTxId !== null && settlementTx && (
        <LoanSettlementModal
          open={settlementOpen}
          onOpenChange={setSettlementOpen}
          onCloseAnimationEnd={() => setSettlementTxId((current) => current === settlementTx.id ? null : current)}
          transaction={settlementTx}
        />
      )}
    </div>
  );
}
