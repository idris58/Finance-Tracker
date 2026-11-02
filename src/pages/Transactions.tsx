import { useState, useEffect, useMemo } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { CalendarIcon, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAccounts, useCategories, useTransactions } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow } from "@/components/TransactionRow";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";
import { formatMoney, roundMoney } from "@/lib/money";
import { useAppState } from "@/context/AppStateContext";
import { useHistoryBackDismiss } from "@/hooks/use-history-back-dismiss";
import { LoanSettlementModal } from "@/components/LoanSettlementModal";
import { TRANSACTION_FILTER_TYPES } from "@/components/TransactionTypeTabs";
import { monthKeyToDate } from "@/lib/month";
import { getTransactionEmptyState } from "@/lib/transaction-empty-state";

const filterTabs = TRANSACTION_FILTER_TYPES;

const PAGE_SIZE = 30;

const loanStatusTabs = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "partial", label: "Partial" },
  { id: "settled", label: "Settled" },
] as const;

type FilterType = (typeof filterTabs)[number]["id"];
type LoanStatusFilter = (typeof loanStatusTabs)[number]["id"];

export default function TransactionsPage() {
  const { searchTerm, setSearchTerm, filter, setFilter, loanStatusFilter, setLoanStatusFilter, tagFilter, setTagFilter, monthFilter, setMonthFilter, categoryFilter, setCategoryFilter } = useAppState();
  
  const [settlementTxId, setSettlementTxId] = useState<number | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filter, monthFilter, tagFilter, categoryFilter, loanStatusFilter, searchTerm]);
  useHistoryBackDismiss(settlementOpen, () => setSettlementOpen(false));

  

  const { data: allTransactions, isLoading } = useTransactions();
  const transactions = useMemo(() => {
    if (monthFilter === "all") return allTransactions || [];
    return (allTransactions || []).filter((tx) => {
      const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
      return format(d, "yyyy-MM") === monthFilter;
    });
  }, [allTransactions, monthFilter]);
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

    const sortedFilteredTx = useMemo(
    () => [...filteredTx].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [filteredTx]
  );
  const visibleTx = useMemo(
    () => sortedFilteredTx.slice(0, visibleCount),
    [sortedFilteredTx, visibleCount]
  );
  const groupedTx = useMemo(() => {
    return visibleTx.reduce<Record<string, typeof visibleTx>>((groups, tx) => {
      const key = format(new Date(tx.date), "yyyy-MM-dd");
      (groups[key] ??= []).push(tx);
      return groups;
    }, {});
  }, [visibleTx]);
  const summary = useMemo(() => {
    return sortedFilteredTx.reduce((totals, tx) => {
      const amount = Number(tx.amount) || 0;
      if (tx.type === "income" || (tx.type === "loan" && tx.loanType === "borrow")) totals.income += amount;
      else if ((tx.type || "expense") === "expense" || (tx.type === "loan" && tx.loanType === "lend")) totals.expense += amount;
      return totals;
    }, { income: 0, expense: 0 });
  }, [sortedFilteredTx]);
  const categoryName = (id: string) => id === "uncategorized"
    ? "Uncategorized"
    : categories?.find((category) => String(category.id) === id)?.name ?? "All categories";

  const hasAnyTransactions = (allTransactions || []).length > 0;
  const hasFilters = filter !== "all" || loanStatusFilter !== "all" || tagFilter !== "all" || categoryFilter !== "all" || monthFilter !== "all" || searchTerm.trim().length > 0;

  const emptyState = getTransactionEmptyState({
    context: "transactions",
    noAccounts,
    onAddAccount: () => setLocation("/accounts"),
    onAddTransaction: openNew,
    hasAnyTransactions,
    hasFilters,
    onClearFilters: () => {
      setSearchTerm("");
      setFilter("all");
      setTagFilter("all");
      setMonthFilter("all");
      setLoanStatusFilter("all");
      setCategoryFilter("all");
    },
  });

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
        {dayItems.map((tx) => (
          <TransactionRow
            key={tx.id}
            transaction={tx}
            currency={currency}
            variant="transactions"
            accountName={getAccountName(tx.accountId)}
            onOpen={() => tx.id && openEdit(tx)}
            onSettle={() => { setSettlementTxId(tx.id ?? null); setSettlementOpen(true); }}
          />
        ))}
            </div>
          </section>
        ))}

        {visibleCount < sortedFilteredTx.length && (
          <div className="flex flex-col items-center justify-center gap-2 pt-2 pb-4">
            <p className="text-xs text-muted-foreground">
              Showing {visibleTx.length} of {sortedFilteredTx.length} transactions
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-full px-6"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                Load more
              </Button>
              {sortedFilteredTx.length - visibleTx.length > PAGE_SIZE && (
                <Button
                  variant="ghost"
                  className="rounded-full text-xs text-muted-foreground"
                  onClick={() => setVisibleCount(sortedFilteredTx.length)}
                >
                  Load all ({sortedFilteredTx.length})
                </Button>
              )}
            </div>
          </div>
        )}
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
            <MonthPicker value={monthFilter} onChange={setMonthFilter} allowAll className="w-full rounded-2xl" />
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
          open={settlementOpen}
          onOpenChange={setSettlementOpen}
          onCloseAnimationEnd={() => setSettlementTxId((current) => current === settlementTx.id ? null : current)}
          transaction={settlementTx}
        />
      )}
    </div>
  );
}
