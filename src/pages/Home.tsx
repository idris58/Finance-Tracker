import { useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Eye, EyeOff } from "lucide-react";
import { Link } from "wouter";
import { useAccounts, useSettings, useTransactions } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";

const typeTabs = [
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "loan", label: "Loan" },
] as const;

type TxType = (typeof typeTabs)[number]["id"];

export default function HomePage() {
  const [activeType, setActiveType] = useState<TxType>("expense");
  const [monthDate, setMonthDate] = useState<Date>(new Date());
  const [hideBalance, setHideBalance] = useState<boolean>(() => {
    const saved = localStorage.getItem("hideBalance");
    return saved === "true";
  });

  const monthKey = format(monthDate, "yyyy-MM");
  const { data: settings } = useSettings();
  const { data: accounts } = useAccounts();
  const { data: transactions, isLoading } = useTransactions({ month: monthKey });
  const { openEdit, openNew } = useTransactionEditor();

  const currency = settings?.currencySymbol || "$";
  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.balance || 0), 0) || 0;

  const totals = useMemo(() => {
    const txs = transactions || [];
    const totalExpense = txs.filter((tx) => (tx.type || "expense") === "expense").reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalIncome = txs.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalBorrow = txs.filter((tx) => tx.type === "loan" && tx.loanType === "borrow").reduce((sum, tx) => sum + Number(tx.amount), 0);
    const totalLend = txs.filter((tx) => tx.type === "loan" && tx.loanType === "lend").reduce((sum, tx) => sum + Number(tx.amount), 0);
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

  const handleTogglePrivacy = () => {
    const next = !hideBalance;
    setHideBalance(next);
    localStorage.setItem("hideBalance", String(next));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="rounded-full border-border/60 bg-card/70 px-4">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(monthDate, "MMMM yyyy")}
            </Button>
          </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={monthDate}
            onSelect={(date) => date && setMonthDate(date)}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      </div>

      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/60 to-card/90 p-6 shadow-[0_20px_60px_-40px_rgba(15,23,42,0.4)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Total balance</p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="text-3xl font-semibold tracking-tight">
                {hideBalance ? "******" : `${currency}${totalBalance.toLocaleString()}`}
              </h2>
              <button
                onClick={handleTogglePrivacy}
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
            {currency}{totals.totalExpense.toLocaleString()}
          </div>
        </div>
      )}

      {activeType === "income" && (
        <div className="rounded-3xl border border-border/60 bg-card/80 p-5">
          <p className="text-sm text-muted-foreground">Total income</p>
          <div className="mt-2 text-2xl font-semibold text-foreground">
            {currency}{totals.totalIncome.toLocaleString()}
          </div>
        </div>
      )}

      {activeType === "loan" && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-3xl border border-border/60 bg-card/80 p-4">
            <p className="text-xs text-muted-foreground">Borrow</p>
            <div className="mt-2 text-xl font-semibold text-rose-500">
              {currency}{totals.totalBorrow.toLocaleString()}
            </div>
          </div>
          <div className="rounded-3xl border border-border/60 bg-card/80 p-4">
            <p className="text-xs text-muted-foreground">Lend</p>
            <div className="mt-2 text-xl font-semibold text-emerald-500">
              {currency}{totals.totalLend.toLocaleString()}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading transactions...</p>}
        {!isLoading && filteredTransactions.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">No transactions yet for this month.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Add your first {activeType === "loan" ? "loan" : activeType} to get started.
            </p>
            <Button onClick={openNew} className="mt-4 rounded-full px-6">
              Add transaction
            </Button>
          </div>
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
                    {items.reduce((sum, tx) => sum + Number(tx.amount), 0).toLocaleString()}
                  </span>
                </div>
                <div className="space-y-2">
                  {items.map((tx) => {
                    const entry = getCategoryIcon(tx.categoryName);
                    const Icon = entry.icon;
                    return (
                      <button
                        key={tx.id}
                        onClick={() => tx.id && openEdit(tx)}
                        className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4 text-left transition hover:border-primary/30 hover:bg-card"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background">
                            <Icon className={cn("h-5 w-5", entry.className)} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{tx.categoryName || "Uncategorized"}</p>
                              {tx.type === "loan" && tx.loanStatus && (
                                <span
                                  className={cn(
                                    "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                    tx.loanStatus === "settled"
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-rose-100 text-rose-700"
                                  )}
                                >
                                  {tx.loanStatus}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(tx.date), "p")} - {tx.paymentMethod}
                            </p>
                            {tx.counterparty && (
                              <p className="text-xs text-muted-foreground/80">{tx.counterparty}</p>
                            )}
                          </div>
                        </div>
                        <p className="font-semibold text-foreground">
                          {activeType === "income" || (tx.type === "loan" && tx.loanType === "borrow") ? "+" : "-"}
                          {currency}{Number(tx.amount).toLocaleString()}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

