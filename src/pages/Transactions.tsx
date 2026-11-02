import { useState, useEffect, useMemo, useLayoutEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Search, X } from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import * as Tabs from "@radix-ui/react-tabs";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAccounts, useCategories, useTransactions, useTransactionsByTag, useTransfers } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow, TransferFeedRow } from "@/components/TransactionRow";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";
import { formatMoney, roundMoney } from "@/lib/money";
import { useAppState } from "@/context/AppStateContext";
import { useHistoryBackDismiss } from "@/hooks/use-history-back-dismiss";
import { LoanSettlementModal } from "@/components/LoanSettlementModal";
import { TRANSACTION_FILTER_TYPES } from "@/components/TransactionTypeTabs";
import { monthKeyToDate } from "@/lib/month";
import { getTransactionEmptyState } from "@/lib/transaction-empty-state";
import type { Transaction, Transfer } from "@shared/schema";

const filterTabs = TRANSACTION_FILTER_TYPES;

const loanStatusTabs = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "partial", label: "Partial" },
  { id: "settled", label: "Settled" },
] as const;

type FilterType = (typeof filterTabs)[number]["id"];
type LoanStatusFilter = (typeof loanStatusTabs)[number]["id"];
type FeedRecord = { kind: "transaction"; item: Transaction } | { kind: "transfer"; item: Transfer };
type FeedItem = { kind: "day"; dayKey: string } | { kind: "record"; dayKey: string; record: FeedRecord };

export default function TransactionsPage() {
  const { searchTerm, setSearchTerm, filter, setFilter, loanStatusFilter, setLoanStatusFilter, tagFilter, setTagFilter, monthFilter, setMonthFilter, categoryFilter, setCategoryFilter } = useAppState();
  
  const [settlementTxId, setSettlementTxId] = useState<number | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const [feedScrollMargin, setFeedScrollMargin] = useState(0);
  useHistoryBackDismiss(settlementOpen, () => setSettlementOpen(false));

  

  const { data: allTransactions, isLoading } = useTransactions();
  const { data: transactionsWithTag, isLoading: isLoadingTaggedTransactions } = useTransactionsByTag(tagFilter === "all" ? null : tagFilter);
  const { data: allTransfers, isLoading: isLoadingTransfers } = useTransfers();
  const transactions = useMemo(() => {
    if (monthFilter === "all") return allTransactions || [];
    return (allTransactions || []).filter((tx) => {
      const d = tx.date instanceof Date ? tx.date : new Date(tx.date);
      return format(d, "yyyy-MM") === monthFilter;
    });
  }, [allTransactions, monthFilter]);
  const transfers = useMemo(() => {
    if (monthFilter === "all") return allTransfers || [];
    return (allTransfers || []).filter((item) => format(new Date(item.date), "yyyy-MM") === monthFilter);
  }, [allTransfers, monthFilter]);
  const transactionsForCurrentTag = useMemo(() => {
    if (tagFilter === "all") return transactions;
    return (transactionsWithTag || []).filter((tx) => {
      if (monthFilter === "all") return true;
      return format(new Date(tx.date), "yyyy-MM") === monthFilter;
    });
  }, [monthFilter, tagFilter, transactions, transactionsWithTag]);
  const settlementTx = allTransactions?.find((transaction) => transaction.id === settlementTxId) ?? null;
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { openEdit, openEditTransfer, openNew } = useTransactionEditor();
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

  const filteredTx = transactionsForCurrentTag.filter((tx) => {
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

  const filteredTransfers = (transfers || []).filter((item) => {
    const query = searchTerm.toLowerCase();
    const matchesSearch = !query || item.note?.toLowerCase().includes(query)
      || getAccountName(item.fromAccountId).toLowerCase().includes(query)
      || getAccountName(item.toAccountId).toLowerCase().includes(query);
    return (filter === "all" || filter === "transfer")
      && matchesSearch
      && tagFilter === "all"
      && categoryFilter === "all";
  });

  const sortedFilteredTx = useMemo(
    () => ([
      ...filteredTx.map((item): FeedRecord => ({ kind: "transaction", item })),
      ...filteredTransfers.map((item): FeedRecord => ({ kind: "transfer", item })),
    ]).sort((a, b) => new Date(b.item.date).getTime() - new Date(a.item.date).getTime()),
    [filteredTx, filteredTransfers]
  );
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    let previousDay = "";
    for (const record of sortedFilteredTx) {
      const dayKey = format(new Date(record.item.date), "yyyy-MM-dd");
      if (dayKey !== previousDay) {
        items.push({ kind: "day", dayKey });
        previousDay = dayKey;
      }
      items.push({ kind: "record", dayKey, record });
    }
    return items;
  }, [sortedFilteredTx]);
  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      const element = feedContainerRef.current;
      if (element) setFeedScrollMargin(element.getBoundingClientRect().top + window.scrollY);
    };
    updateScrollMargin();
    window.addEventListener("resize", updateScrollMargin);
    return () => window.removeEventListener("resize", updateScrollMargin);
  }, [filter, sortedFilteredTx.length]);
  const feedVirtualizer = useWindowVirtualizer({
    count: feedItems.length,
    estimateSize: (index) => feedItems[index]?.kind === "day" ? 42 : feedItems[index]?.record.kind === "transfer" ? 112 : 168,
    getItemKey: (index) => {
      const item = feedItems[index];
      if (!item) return index;
      if (item.kind === "day") return `day-${item.dayKey}`;
      return item.record.kind === "transaction"
        ? `transaction-${item.record.item.id}`
        : `transfer-${item.record.item.id}`;
    },
    overscan: 8,
    scrollMargin: feedScrollMargin,
  });
  const summary = useMemo(() => {
    return sortedFilteredTx.reduce((totals, tx) => {
      if (tx.kind !== "transaction") {
        totals.transfers += Number(tx.item.amount) || 0;
        return totals;
      }
      const amount = Number(tx.item.amount) || 0;
      if (tx.item.type === "income" || (tx.item.type === "loan" && tx.item.loanType === "borrow")) totals.income += amount;
      else if ((tx.item.type || "expense") === "expense" || (tx.item.type === "loan" && tx.item.loanType === "lend")) totals.expense += amount;
      return totals;
    }, { income: 0, expense: 0, transfers: 0 });
  }, [sortedFilteredTx]);
  const categoryName = (id: string) => id === "uncategorized"
    ? "Uncategorized"
    : categories?.find((category) => String(category.id) === id)?.name ?? "All categories";

  const hasAnyTransactions = (allTransactions || []).length + (allTransfers || []).length > 0;
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

  const virtualItems = feedVirtualizer.getVirtualItems();
  const firstVisibleVirtualItem = virtualItems.find((item) => item.end >= (feedVirtualizer.scrollOffset ?? 0));
  const firstVirtualIndex = firstVisibleVirtualItem?.index ?? virtualItems[0]?.index ?? 0;
  let stickyDayKey: string | null = null;
  for (let index = firstVirtualIndex; index >= 0; index--) {
    const candidate = feedItems[index];
    if (candidate?.kind === "day") {
      stickyDayKey = candidate.dayKey;
      break;
    }
  }
  const stickyDate = stickyDayKey ? new Date(`${stickyDayKey}T12:00:00`) : null;

  const transactionResults = (
      <div className="space-y-4">
        {(isLoading || isLoadingTransfers || isLoadingTaggedTransactions) && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !isLoadingTransfers && !isLoadingTaggedTransactions && sortedFilteredTx.length === 0 && <EmptyState {...emptyState} />}
        {sortedFilteredTx.length > 0 && (
          <div className={cn("grid grid-cols-2 gap-2", filter === "transfer" ? "sm:grid-cols-2" : "sm:grid-cols-5")}>
            <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Records</p><p className="mt-1 font-semibold">{sortedFilteredTx.length}</p></div>
            {filter === "transfer" ? (
              <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Transferred</p><p className="mt-1 font-semibold">{currency}{formatMoney(summary.transfers)}</p></div>
            ) : (
              <>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Income</p><p className="mt-1 font-semibold text-emerald-600">{currency}{formatMoney(summary.income)}</p></div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Expense</p><p className="mt-1 font-semibold">{currency}{formatMoney(summary.expense)}</p></div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Transfers</p><p className="mt-1 font-semibold">{currency}{formatMoney(summary.transfers)}</p></div>
                <div className="rounded-2xl border border-border/60 bg-card/70 p-3"><p className="text-xs text-muted-foreground">Net</p><p className={cn("mt-1 font-semibold", summary.income - summary.expense >= 0 ? "text-emerald-600" : "text-rose-500")}>{currency}{formatMoney(summary.income - summary.expense)}</p></div>
              </>
            )}
          </div>
        )}
        {sortedFilteredTx.length > 0 && (
          <div
            ref={feedContainerRef}
            className="relative w-full"
            style={{ height: `${Math.max(0, feedVirtualizer.getTotalSize() - feedScrollMargin)}px` }}
          >
            {stickyDate && (
              <div className="sticky top-0 z-10 h-0">
                <h2 className="-mx-1 bg-background/95 px-1 py-2 text-sm font-semibold text-muted-foreground backdrop-blur">
                  {isToday(stickyDate) ? "Today" : isYesterday(stickyDate) ? "Yesterday" : format(stickyDate, "EEEE, MMM d, yyyy")}
                </h2>
              </div>
            )}
            {feedVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = feedItems[virtualItem.index];
              if (!item) return null;
              let content;
              if (item.kind === "day") {
                content = (
                  <h2 className="-mx-1 mb-2 bg-background/95 px-1 py-2 text-sm font-semibold text-muted-foreground">
                    {isToday(new Date(`${item.dayKey}T12:00:00`)) ? "Today" : isYesterday(new Date(`${item.dayKey}T12:00:00`)) ? "Yesterday" : format(new Date(`${item.dayKey}T12:00:00`), "EEEE, MMM d, yyyy")}
                  </h2>
                );
              } else if (item.record.kind === "transaction") {
                const transaction = item.record.item;
                content = (
                  <div className="pb-2.5">
                    <TransactionRow
                      transaction={transaction}
                      currency={currency}
                      variant="transactions"
                      accountName={getAccountName(transaction.accountId)}
                      onOpen={() => transaction.id && openEdit(transaction)}
                      onSettle={() => { setSettlementTxId(transaction.id ?? null); setSettlementOpen(true); }}
                    />
                  </div>
                );
              } else {
                const transfer = item.record.item;
                content = (
                  <div className="pb-2.5">
                    <TransferFeedRow
                      transfer={transfer}
                      currency={currency}
                      fromAccountName={getAccountName(transfer.fromAccountId)}
                      toAccountName={getAccountName(transfer.toAccountId)}
                      onOpen={() => openEditTransfer(transfer)}
                    />
                  </div>
                );
              }
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={feedVirtualizer.measureElement}
                  className="absolute left-0 top-0 w-full"
                  style={{ transform: `translateY(${virtualItem.start - feedScrollMargin}px)` }}
                >
                  {content}
                </div>
              );
            })}
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
