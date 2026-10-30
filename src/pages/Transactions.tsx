import { useState, useEffect, useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Search, X, Zap } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAccounts, useCategories, useTransactions } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";
import { EmptyState } from "@/components/EmptyState";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";
import { formatMoney, roundMoney } from "@/lib/money";
import { useAppState } from "@/context/AppStateContext";
import { useHistoryBackDismiss } from "@/hooks/use-history-back-dismiss";
import { LoanSettlementModal } from "@/components/LoanSettlementModal";
import type { Transaction } from "@shared/schema";

const filterTabs = [
  { id: "all", label: "All" },
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "loan", label: "Loan" },
] as const;

const loanStatusTabs = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "partial", label: "Partial" },
  { id: "settled", label: "Settled" },
] as const;

type FilterType = (typeof filterTabs)[number]["id"];
type LoanStatusFilter = (typeof loanStatusTabs)[number]["id"];

const monthKeyToDate = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
};

function LoanProgressBar({ tx, currency }: { tx: Transaction; currency: string }) {
  const totalAmount = Number(tx.amount);
  const totalSettled = roundMoney((tx.settlements ?? []).reduce((sum, s) => sum + Number(s.amount), 0));
  const remaining = roundMoney(Math.max(0, totalAmount - totalSettled));
  const percent = totalAmount > 0 ? (totalSettled / totalAmount) * 100 : 0;

  const color =
    tx.loanStatus === "settled"
      ? "bg-emerald-500"
      : tx.loanStatus === "partial"
        ? "bg-amber-400"
        : "bg-rose-400";

  return (
    <div className="mt-2 space-y-1">
      <div
        className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${Math.round(percent)}% of loan settled`}
      >
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{Math.round(percent)}% paid</span>
        {remaining > 0 && <span>{currency}{formatMoney(remaining)} left</span>}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { searchTerm, setSearchTerm, filter, setFilter, loanStatusFilter, setLoanStatusFilter, tagFilter, setTagFilter, monthFilter, setMonthFilter, categoryFilter, setCategoryFilter } = useAppState();
  const [pickerYear, setPickerYear] = useState<number>(new Date().getFullYear());
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);
  const [settlementTxId, setSettlementTxId] = useState<number | null>(null);
  const [urlReady, setUrlReady] = useState(false);
  useHistoryBackDismiss(settlementTxId !== null, () => setSettlementTxId(null));

  useEffect(() => {
    if (monthFilter === "all") {
      setPickerYear(new Date().getFullYear());
    } else {
      setPickerYear(Number(monthFilter.split("-")[0]));
    }
  }, [monthFilter]);

  const { data: transactions, isLoading } = useTransactions({
    month: monthFilter === "all" ? undefined : monthFilter,
  });
  const { data: allTransactions } = useTransactions();
  const settlementTx = allTransactions?.find((transaction) => transaction.id === settlementTxId) ?? null;
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { openEdit, openNew } = useTransactionEditor();
  const [, setLocation] = useLocation();

  const currency = useCurrency();
  const noAccounts = (accounts || []).length === 0;
  const getAccountName = (accountId?: number | null) => accounts?.find((account) => account.id === accountId)?.name ?? "Unknown account";

  const applyUrlFilters = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.size > 0) {
      const month = params.get("month");
      const type = params.get("type");
      const status = params.get("status");
      setMonthFilter(month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "all");
      setFilter(filterTabs.some((tab) => tab.id === type) ? type as FilterType : "all");
      setLoanStatusFilter(loanStatusTabs.some((tab) => tab.id === status) ? status as LoanStatusFilter : "all");
      setTagFilter(params.get("tag") || "all");
      setCategoryFilter(params.get("category") || "all");
      setSearchTerm(params.get("q") || "");
    }
    setUrlReady(true);
  };

  useEffect(() => {
    applyUrlFilters();
    window.addEventListener("popstate", applyUrlFilters);
    return () => window.removeEventListener("popstate", applyUrlFilters);
  }, []);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (monthFilter !== "all") params.set("month", monthFilter);
    if (filter !== "all") params.set("type", filter);
    if (filter === "loan" && loanStatusFilter !== "all") params.set("status", loanStatusFilter);
    if (tagFilter !== "all") params.set("tag", tagFilter);
    if (categoryFilter !== "all") params.set("category", categoryFilter);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [urlReady, monthFilter, filter, loanStatusFilter, tagFilter, categoryFilter, searchTerm]);

  const availableTags = useMemo(
    () => Array.from(new Set((allTransactions || []).flatMap((tx) => Array.isArray(tx.tags) ? tx.tags : []))).sort(),
    [allTransactions]
  );

  useEffect(() => {
    if (tagFilter !== "all" && !availableTags.includes(tagFilter)) {
      setTagFilter("all");
    }
  }, [availableTags, tagFilter]);

  useEffect(() => {
    if (categoryFilter !== "all" && categoryFilter !== "uncategorized" && categories
      && !categories.some((category) => String(category.id) === categoryFilter)) {
      setCategoryFilter("all");
    }
  }, [categories, categoryFilter, setCategoryFilter]);

  const filteredTx = (transactions || []).filter((tx) => {
    const matchesSearch =
      tx.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      getAccountName(tx.accountId).toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.counterparty?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (Array.isArray(tx.tags) && tx.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())));

    const type = tx.type || "expense";
    const matchesFilter = filter === "all" || type === filter;
    const matchesTag = tagFilter === "all" || (Array.isArray(tx.tags) && tx.tags.includes(tagFilter));
    const matchesCategory = categoryFilter === "all"
      || (categoryFilter === "uncategorized" ? !tx.categoryId : String(tx.categoryId) === categoryFilter);
    const matchesLoanStatus =
      filter !== "loan" ||
      loanStatusFilter === "all" ||
      tx.loanStatus === loanStatusFilter;

    return matchesSearch && matchesFilter && matchesTag && matchesCategory && matchesLoanStatus;
  });

  const sortedFilteredTx = [...filteredTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const groupedTx = sortedFilteredTx.reduce<Record<string, typeof sortedFilteredTx>>((groups, tx) => {
    const key = format(new Date(tx.date), "yyyy-MM-dd");
    (groups[key] ??= []).push(tx);
    return groups;
  }, {});
  const summary = sortedFilteredTx.reduce((totals, tx) => {
    const amount = Number(tx.amount) || 0;
    if (tx.type === "income" || (tx.type === "loan" && tx.loanType === "borrow")) totals.income += amount;
    else if ((tx.type || "expense") === "expense" || (tx.type === "loan" && tx.loanType === "lend")) totals.expense += amount;
    return totals;
  }, { income: 0, expense: 0 });
  const categoryName = (id: string) => id === "uncategorized"
    ? "Uncategorized"
    : categories?.find((category) => String(category.id) === id)?.name ?? "All categories";

  const hasAnyTransactions = (allTransactions || []).length > 0;
  const hasFilters = filter !== "all" || loanStatusFilter !== "all" || tagFilter !== "all" || categoryFilter !== "all" || monthFilter !== "all" || searchTerm.trim().length > 0;

  const emptyState = (() => {
    if (noAccounts) {
      return {
        title: "Add an account first",
        hint: "Create an account before tracking transactions.",
        primaryActionLabel: "Add account",
        onPrimaryAction: () => setLocation("/accounts"),
      };
    }

    if (hasAnyTransactions && hasFilters) {
      return {
        title: "No transactions match",
        hint: "Try another month or clear filters.",
        primaryActionLabel: "Clear filters",
        onPrimaryAction: () => {
          setSearchTerm("");
          setFilter("all");
          setTagFilter("all");
          setMonthFilter("all");
          setLoanStatusFilter("all");
          setCategoryFilter("all");
        },
        secondaryActionLabel: "Add transaction",
        onSecondaryAction: openNew,
      };
    }

    return {
      title: "No transactions yet",
      hint: "Add your first transaction to start tracking.",
      primaryActionLabel: "Add transaction",
      onPrimaryAction: openNew,
    };
  })();

  const transactionResults = (
      <div className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && filteredTx.length === 0 && <EmptyState {...emptyState} />}
        {sortedFilteredTx.length > 0 && (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Transactions</p><p className="mt-1 font-semibold">{sortedFilteredTx.length}</p></div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Income</p><p className="mt-1 font-semibold text-emerald-600">{currency}{formatMoney(summary.income)}</p></div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Expense</p><p className="mt-1 font-semibold">{currency}{formatMoney(summary.expense)}</p></div>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Net</p><p className={cn("mt-1 font-semibold", summary.income - summary.expense >= 0 ? "text-emerald-600" : "text-rose-500")}>{currency}{formatMoney(summary.income - summary.expense)}</p></div>
          </div>
        )}
        {Object.entries(groupedTx).map(([dayKey, dayItems]) => (
          <section key={dayKey}>
            <h2 className="sticky top-0 z-10 -mx-1 mb-2 bg-background/95 px-1 py-2 text-sm font-semibold text-muted-foreground backdrop-blur">
              {isToday(new Date(`${dayKey}T12:00:00`)) ? "Today" : isYesterday(new Date(`${dayKey}T12:00:00`)) ? "Yesterday" : format(new Date(`${dayKey}T12:00:00`), "EEEE, MMM d, yyyy")}
            </h2>
            <div className="space-y-2.5">
        {dayItems.map((tx) => {
          const entry = getCategoryIcon(tx.categoryName);
          const Icon = entry.icon;
          const accountName = getAccountName(tx.accountId);
          const isLoan = tx.type === "loan";
          const isPositive = tx.type === "income" || (isLoan && tx.loanType === "borrow");
          const statusColor =
            tx.loanStatus === "settled"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
              : tx.loanStatus === "partial"
                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400"
                : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400";

          return (
            <div key={tx.id} className="overflow-hidden rounded-2xl border border-border/60 bg-card/80 transition hover:border-primary/20">
              <button
                onClick={() => tx.id && openEdit(tx)}
                className="flex w-full items-start justify-between p-4 text-left"
                aria-label={`${tx.categoryName ?? "Transaction"}, ${isPositive ? "+" : "-"}${currency}${formatMoney(Number(tx.amount))}, ${format(new Date(tx.date), "MMM d, yyyy")}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-background">
                    <Icon className={cn("h-5 w-5", entry.className)} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="font-medium">{tx.categoryName || "Uncategorized"}</p>
                      {isLoan && tx.loanStatus && (
                        <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", statusColor)}>
                          {tx.loanStatus}
                        </span>
                      )}
                      {isLoan && tx.loanType && (
                        <span className="inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400">
                          {tx.loanType}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(tx.date), "MMM d, yyyy")} · {accountName}
                    </p>
                    {tx.counterparty && (
                      <p className="text-xs text-muted-foreground/80">{tx.counterparty}</p>
                    )}
                    {tx.note && <p className="text-xs text-muted-foreground/70 italic">{tx.note}</p>}
                    {Array.isArray(tx.tags) && tx.tags.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tx.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    {isLoan && <LoanProgressBar tx={tx} currency={currency} />}
                  </div>
                </div>
                <div className="ml-4 shrink-0 text-right">
                  <p className={cn("font-semibold", isPositive ? "text-emerald-500" : "text-foreground")}>
                    {isPositive ? "+" : "-"}{currency}{formatMoney(Number(tx.amount))}
                  </p>
                  <p className="text-xs text-muted-foreground">{format(new Date(tx.date), "p")}</p>
                </div>
              </button>

              {/* Quick settle button for non-settled loans */}
              {isLoan && tx.loanStatus !== "settled" && tx.id && (
                <div className="border-t border-border/40 px-4 pb-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSettlementTxId(tx.id ?? null)}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-500/10 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-500/20 dark:text-indigo-400"
                    aria-label={`Record a payment for loan from ${tx.counterparty ?? "counterparty"}`}
                  >
                    <Zap className="h-3 w-3" />
                    Record payment
                  </button>
                </div>
              )}
            </div>
          );
        })}
            </div>
          </section>
        ))}
      </div>

  );

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        {/* Search + filters row */}
        <div className="flex flex-col gap-2.5 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by category, note, counterparty, tag…"
              className="rounded-2xl border-border/60 bg-card/70 pl-9 pr-10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-label="Search transactions"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="sm:w-48">
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="rounded-2xl border-border/60 bg-card/70" aria-label="Filter by tag">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>#{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-48">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="rounded-2xl border-border/60 bg-card/70" aria-label="Filter by category">
                <SelectValue placeholder="Filter by category">{categoryName(categoryFilter)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="uncategorized">Uncategorized</SelectItem>
                {(categories || []).map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Month picker */}
          <div className="sm:w-48">
            <Popover open={isMonthPickerOpen} onOpenChange={setIsMonthPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full rounded-2xl border-border/60 bg-card/70 px-3">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {monthFilter === "all"
                    ? "All months"
                    : format(monthKeyToDate(monthFilter), "MMMM yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-4" align="start">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
                    onClick={() => setPickerYear((prev) => prev - 1)}
                    aria-label="Previous year"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div className="text-sm font-semibold">{pickerYear}</div>
                  <button
                    type="button"
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:text-foreground"
                    onClick={() => setPickerYear((prev) => prev + 1)}
                    aria-label="Next year"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {Array.from({ length: 12 }, (_, idx) => {
                    const monthLabel = format(new Date(2020, idx, 1), "MMM");
                    const value = `${pickerYear}-${String(idx + 1).padStart(2, "0")}`;
                    const isActive = monthFilter === value;
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
                          setMonthFilter(value);
                          setIsMonthPickerOpen(false);
                        }}
                      >
                        {monthLabel}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setMonthFilter("all");
                      setIsMonthPickerOpen(false);
                    }}
                  >
                    All months
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Type filter tabs */}
      <Tabs.Root value={filter} onValueChange={(value) => {
        setFilter(value as FilterType);
        if (value !== "loan") setLoanStatusFilter("all");
      }}>
      <Tabs.List className="flex flex-wrap gap-2" aria-label="Filter by type">
        {filterTabs.map((tab) => (
          <Tabs.Trigger
            key={tab.id}
            value={tab.id}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-semibold transition",
              filter === tab.id
                ? "border-primary/40 bg-primary text-primary-foreground"
                : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>

      {filterTabs.map((tab) => (
        <Tabs.Content key={tab.id} value={tab.id} className="mt-4 focus-visible:outline-none">
          {filter === tab.id && (tab.id === "loan" ? (
            <Tabs.Root value={loanStatusFilter} onValueChange={(value) => setLoanStatusFilter(value as LoanStatusFilter)}>
              <Tabs.List className="mb-4 flex flex-wrap gap-2" aria-label="Filter by loan status">
                {loanStatusTabs.map((statusTab) => (
                  <Tabs.Trigger
                    key={statusTab.id}
                    value={statusTab.id}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-semibold transition",
                      loanStatusFilter === statusTab.id
                        ? statusTab.id === "settled" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600"
                          : statusTab.id === "partial" ? "border-amber-400/40 bg-amber-400/10 text-amber-600"
                          : statusTab.id === "open" ? "border-rose-500/40 bg-rose-500/10 text-rose-600"
                          : "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {statusTab.label}
                  </Tabs.Trigger>
                ))}
              </Tabs.List>
              {loanStatusTabs.map((statusTab) => (
                <Tabs.Content key={statusTab.id} value={statusTab.id} className="focus-visible:outline-none">
                  {loanStatusFilter === statusTab.id && transactionResults}
                </Tabs.Content>
              ))}
            </Tabs.Root>
          ) : transactionResults)}
        </Tabs.Content>
      ))}
      </Tabs.Root>

      {/* Loan Settlement Modal */}
      {settlementTxId !== null && settlementTx && (
        <LoanSettlementModal
          open={settlementTxId !== null}
          onOpenChange={(o) => { if (!o) setSettlementTxId(null); }}
          transaction={settlementTx}
        />
      )}
    </div>
  );
}
