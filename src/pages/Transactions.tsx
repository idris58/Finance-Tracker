import { useState, useEffect, useMemo, useLayoutEffect, useRef } from "react";
import { format, isToday, isYesterday } from "date-fns";
import { Search, X, SlidersHorizontal } from "lucide-react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import * as Tabs from "@radix-ui/react-tabs";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useAccounts, useCategories, useTransactions, useTransactionsByTag, useTransfers } from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/EmptyState";
import { MonthPicker } from "@/components/MonthPicker";
import { TransactionRow, TransferFeedRow } from "@/components/TransactionRow";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";
import { formatMoney } from "@/lib/money";
import { useAppState, type TransactionSortOrder } from "@/context/AppStateContext";
import { useHistoryBackDismiss } from "@/hooks/use-history-back-dismiss";
import { LoanSettlementModal } from "@/components/LoanSettlementModal";
import { TRANSACTION_FILTER_TYPES } from "@/components/TransactionTypeTabs";
import { getTransactionEmptyState } from "@/lib/transaction-empty-state";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
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
  const {
    searchTerm, setSearchTerm, filter, setFilter, loanStatusFilter, setLoanStatusFilter,
    tagFilter, setTagFilter, monthFilter, setMonthFilter, categoryFilter, setCategoryFilter,
    accountFilter, setAccountFilter, minimumAmount, setMinimumAmount, maximumAmount, setMaximumAmount,
    dateFrom, setDateFrom, dateTo, setDateTo, sortOrder, setSortOrder,
  } = useAppState();
  const [searchInput, setSearchInput] = useState(searchTerm);
  
  const [settlementTxId, setSettlementTxId] = useState<number | null>(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [urlReady, setUrlReady] = useState(false);
  const feedContainerRef = useRef<HTMLDivElement>(null);
  const [feedScrollMargin, setFeedScrollMargin] = useState(0);
  useHistoryBackDismiss(settlementOpen, () => setSettlementOpen(false));

  useEffect(() => setSearchInput(searchTerm), [searchTerm]);
  useEffect(() => {
    if (searchInput === searchTerm) return;
    const timeout = window.setTimeout(() => setSearchTerm(searchInput), 200);
    return () => window.clearTimeout(timeout);
  }, [searchInput, searchTerm, setSearchTerm]);

  

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
  const accountById = useMemo(
    () => new Map((accounts || []).flatMap((account) => account.id === undefined ? [] : [[account.id, account.name] as const])),
    [accounts]
  );
  const categoryById = useMemo(
    () => new Map((categories || []).flatMap((category) => category.id === undefined ? [] : [[category.id, category.name] as const])),
    [categories]
  );
  const { openEdit, openEditTransfer, openNew } = useTransactionEditor();
  const [, setLocation] = useLocation();

  const currency = useCurrency();
  const noAccounts = (accounts || []).length === 0;
  const getAccountName = (accountId?: number | null) => accountById.get(accountId ?? -1) ?? "Unknown account";

  const applyUrlFilters = () => {
    const params = new URLSearchParams(window.location.search);
    if (params.size === 0) {
      setUrlReady(true);
      return;
    }
    const month = params.get("month");
    const type = params.get("type");
    const status = params.get("status");
    const amountMin = params.get("min") || "";
    const amountMax = params.get("max") || "";
    const startDate = params.get("from") || "";
    const endDate = params.get("to") || "";
    const query = params.get("q") || "";
    const sort = params.get("sort");
    setMonthFilter(month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : "all");
    setFilter(filterTabs.some((tab) => tab.id === type) ? type as FilterType : "all");
    setLoanStatusFilter(loanStatusTabs.some((tab) => tab.id === status) ? status as LoanStatusFilter : "all");
    setTagFilter(params.get("tag") || "all");
    setCategoryFilter(params.get("category") || "all");
    setAccountFilter(params.get("account") || "all");
    setMinimumAmount(amountMin);
    setMaximumAmount(amountMax);
    setDateFrom(startDate);
    setDateTo(endDate);
    setSortOrder(sort === "oldest" || sort === "amount-desc" || sort === "amount-asc" ? sort as TransactionSortOrder : "newest");
    setSearchTerm(query);
    setSearchInput(query);
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
    if (accountFilter !== "all") params.set("account", accountFilter);
    if (minimumAmount) params.set("min", minimumAmount);
    if (maximumAmount) params.set("max", maximumAmount);
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    if (sortOrder !== "newest") params.set("sort", sortOrder);
    if (searchTerm.trim()) params.set("q", searchTerm.trim());
    const query = params.toString();
    const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [urlReady, monthFilter, filter, loanStatusFilter, tagFilter, categoryFilter, accountFilter, minimumAmount, maximumAmount, dateFrom, dateTo, sortOrder, searchTerm]);

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
      && !categoryById.has(Number(categoryFilter))) {
      setCategoryFilter("all");
    }
  }, [categories, categoryById, categoryFilter, setCategoryFilter]);

  useEffect(() => {
    if (accountFilter !== "all" && accounts && !accountById.has(Number(accountFilter))) {
      setAccountFilter("all");
    }
  }, [accounts, accountById, accountFilter]);

  const normalizedSearch = searchTerm.toLowerCase();
  const amountSearchQuery = normalizedSearch.replace(/[^\d.-]/g, "");
  const minimumAmountValue = minimumAmount === "" ? null : Number(minimumAmount);
  const maximumAmountValue = maximumAmount === "" ? null : Number(maximumAmount);
  const invalidAmountRange = minimumAmountValue !== null && maximumAmountValue !== null && minimumAmountValue > maximumAmountValue;
  const invalidDateRange = !!dateFrom && !!dateTo && dateFrom > dateTo;
  const filteredTx = useMemo(() => transactionsForCurrentTag.filter((tx) => {
    const amount = Number(tx.amount) || 0;
    const matchesAmountSearch = !!amountSearchQuery && [String(amount), formatMoney(amount)]
      .some((value) => value.replace(/,/g, "").includes(amountSearchQuery));
    const txDate = format(new Date(tx.date), "yyyy-MM-dd");
    const matchesSearch = !normalizedSearch ||
      tx.categoryName?.toLowerCase().includes(normalizedSearch) ||
      tx.note?.toLowerCase().includes(normalizedSearch) ||
      (accountById.get(tx.accountId ?? -1) ?? "Unknown account").toLowerCase().includes(normalizedSearch) ||
      tx.counterparty?.toLowerCase().includes(normalizedSearch) ||
      (Array.isArray(tx.tags) && tx.tags.some((tag) => tag.toLowerCase().includes(normalizedSearch))) ||
      matchesAmountSearch;

    const type = tx.type || "expense";
    const matchesFilter = filter === "all" || type === filter;
    const matchesTag = tagFilter === "all" || (Array.isArray(tx.tags) && tx.tags.includes(tagFilter));
    const matchesAccount = accountFilter === "all" || tx.accountId === Number(accountFilter);
    const matchesAmount = (minimumAmountValue === null || amount >= minimumAmountValue) && (maximumAmountValue === null || amount <= maximumAmountValue);
    const matchesDate = !invalidDateRange && (!dateFrom || txDate >= dateFrom) && (!dateTo || txDate <= dateTo);
    const matchesCategory = categoryFilter === "all"
      || (categoryFilter === "uncategorized" ? !tx.categoryId : String(tx.categoryId) === categoryFilter);
    const matchesLoanStatus = filter !== "loan" || loanStatusFilter === "all" || tx.loanStatus === loanStatusFilter;
    return matchesSearch && matchesFilter && matchesTag && matchesCategory && matchesAccount && matchesAmount && matchesDate && matchesLoanStatus;
  }), [transactionsForCurrentTag, normalizedSearch, amountSearchQuery, accountById, filter, tagFilter, categoryFilter, loanStatusFilter, accountFilter, minimumAmountValue, maximumAmountValue, dateFrom, dateTo, invalidDateRange]);

  const filteredTransfers = useMemo(() => (transfers || []).filter((item) => {
    const amount = Number(item.amount) || 0;
    const matchesAmountSearch = !!amountSearchQuery && [String(amount), formatMoney(amount)]
      .some((value) => value.replace(/,/g, "").includes(amountSearchQuery));
    const txDate = format(new Date(item.date), "yyyy-MM-dd");
    const matchesSearch = !normalizedSearch || item.note?.toLowerCase().includes(normalizedSearch)
      || (accountById.get(item.fromAccountId) ?? "Unknown account").toLowerCase().includes(normalizedSearch)
      || (accountById.get(item.toAccountId) ?? "Unknown account").toLowerCase().includes(normalizedSearch)
      || matchesAmountSearch;
    const matchesAccount = accountFilter === "all" || item.fromAccountId === Number(accountFilter) || item.toAccountId === Number(accountFilter);
    const matchesAmount = (minimumAmountValue === null || amount >= minimumAmountValue) && (maximumAmountValue === null || amount <= maximumAmountValue);
    const matchesDate = !invalidDateRange && (!dateFrom || txDate >= dateFrom) && (!dateTo || txDate <= dateTo);
    return (filter === "all" || filter === "transfer")
      && matchesSearch
      && matchesAccount
      && matchesAmount
      && matchesDate
      && tagFilter === "all"
      && categoryFilter === "all";
  }), [transfers, normalizedSearch, amountSearchQuery, accountById, filter, tagFilter, categoryFilter, accountFilter, minimumAmountValue, maximumAmountValue, dateFrom, dateTo, invalidDateRange]);

  const sortedFilteredTx = useMemo(
    () => ([
      ...filteredTx.map((item): FeedRecord => ({ kind: "transaction", item })),
      ...filteredTransfers.map((item): FeedRecord => ({ kind: "transfer", item })),
    ]).sort((a, b) => {
      const amountDifference = Number(a.item.amount) - Number(b.item.amount);
      const dateDifference = new Date(a.item.date).getTime() - new Date(b.item.date).getTime();
      if (sortOrder === "amount-desc") return amountDifference ? -amountDifference : -dateDifference;
      if (sortOrder === "amount-asc") return amountDifference || -dateDifference;
      return sortOrder === "oldest" ? dateDifference : -dateDifference;
    }),
    [filteredTx, filteredTransfers, sortOrder]
  );
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    let previousDay = "";
    for (const record of sortedFilteredTx) {
      const dayKey = format(new Date(record.item.date), "yyyy-MM-dd");
      if ((sortOrder === "newest" || sortOrder === "oldest") && dayKey !== previousDay) {
        items.push({ kind: "day", dayKey });
        previousDay = dayKey;
      }
      items.push({ kind: "record", dayKey, record });
    }
    return items;
  }, [sortedFilteredTx, sortOrder]);
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
  const summary = useMemo(() => sortedFilteredTx.reduce((totals, record) => {
    if (record.kind === "transfer") {
      totals.transfers += Number(record.item.amount) || 0;
      return totals;
    }
    const amount = Number(record.item.amount) || 0;
    if (record.item.type === "income" || (record.item.type === "loan" && record.item.loanType === "borrow")) totals.income += amount;
    else if ((record.item.type || "expense") === "expense" || (record.item.type === "loan" && record.item.loanType === "lend")) totals.expense += amount;
    return totals;
  }, { income: 0, expense: 0, transfers: 0 }), [sortedFilteredTx]);
  const categoryName = (id: string) => id === "uncategorized"
    ? "Uncategorized"
    : categoryById.get(Number(id)) ?? "All categories";

  const hasAnyTransactions = (allTransactions || []).length + (allTransfers || []).length > 0;
  const hasAmountFilter = minimumAmount !== "" || maximumAmount !== "";
  const hasDateFilter = dateFrom !== "" || dateTo !== "";
  const hasFilters = filter !== "all" || loanStatusFilter !== "all" || tagFilter !== "all" || categoryFilter !== "all"
    || monthFilter !== "all" || accountFilter !== "all" || hasAmountFilter || hasDateFilter
    || sortOrder !== "newest" || searchTerm.trim().length > 0;
  const activeFilterCount = [
    filter !== "all",
    filter === "loan" && loanStatusFilter !== "all",
    tagFilter !== "all",
    categoryFilter !== "all",
    monthFilter !== "all",
    accountFilter !== "all",
    hasAmountFilter,
    hasDateFilter,
    sortOrder !== "newest",
    searchTerm.trim().length > 0,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSearchInput("");
    setSearchTerm("");
    setFilter("all");
    setLoanStatusFilter("all");
    setTagFilter("all");
    setMonthFilter("all");
    setCategoryFilter("all");
    setAccountFilter("all");
    setMinimumAmount("");
    setMaximumAmount("");
    setDateFrom("");
    setDateTo("");
    setSortOrder("newest");
  };

  const activeChips: { key: string; label: string; remove: () => void }[] = [];
  if (filter !== "all") activeChips.push({ key: "type", label: filterTabs.find((tab) => tab.id === filter)?.label ?? filter, remove: () => { setFilter("all"); setLoanStatusFilter("all"); } });
  if (filter === "loan" && loanStatusFilter !== "all") activeChips.push({ key: "status", label: `Loan: ${loanStatusFilter}`, remove: () => setLoanStatusFilter("all") });
  if (tagFilter !== "all") activeChips.push({ key: "tag", label: `#${tagFilter}`, remove: () => setTagFilter("all") });
  if (categoryFilter !== "all") activeChips.push({ key: "category", label: categoryName(categoryFilter), remove: () => setCategoryFilter("all") });
  if (monthFilter !== "all") activeChips.push({ key: "month", label: `Month ${monthFilter}`, remove: () => setMonthFilter("all") });
  if (accountFilter !== "all") activeChips.push({ key: "account", label: accountById.get(Number(accountFilter)) ?? "Account", remove: () => setAccountFilter("all") });
  if (hasAmountFilter) activeChips.push({ key: "amount", label: `Amount ${minimumAmount || "0"}–${maximumAmount || "any"}`, remove: () => { setMinimumAmount(""); setMaximumAmount(""); } });
  if (hasDateFilter) activeChips.push({ key: "date", label: `Date ${dateFrom || "any"}–${dateTo || "any"}`, remove: () => { setDateFrom(""); setDateTo(""); } });
  if (sortOrder !== "newest") activeChips.push({ key: "sort", label: `Sort: ${sortOrder === "oldest" ? "Oldest" : sortOrder === "amount-desc" ? "Largest amount" : "Smallest amount"}`, remove: () => setSortOrder("newest") });
  if (searchTerm.trim()) activeChips.push({ key: "search", label: `Search: ${searchTerm.trim()}`, remove: () => { setSearchInput(""); setSearchTerm(""); } });

  const emptyState = getTransactionEmptyState({
    context: "transactions",
    noAccounts,
    onAddAccount: () => setLocation("/accounts"),
    onAddTransaction: openNew,
    hasAnyTransactions,
    hasFilters,
    onClearFilters: clearFilters,
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
          <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-4", filter === "transfer" && "sm:max-w-xs")}>
            {filter === "transfer" ? (
              <div className="rounded-2xl border border-border/60 bg-card/70 p-3">
                <p className="text-xs text-muted-foreground">Transferred</p>
                <p className="mt-1 font-semibold">{currency}{formatMoney(summary.transfers)}</p>
              </div>
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
                      showFullDate={sortOrder === "amount-desc" || sortOrder === "amount-asc"}
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
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold">Transactions</h1>
          {hasFilters && (
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="shrink-0 rounded-full text-muted-foreground">
              <X className="mr-1.5 h-4 w-4" /> Clear filters
            </Button>
          )}
        </div>
        {/* Search + filters row */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search category, note, account, tag, or amount"
              className="h-11 rounded-2xl border-border/60 bg-card/70 pl-9 pr-10"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search transactions"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" className="h-11 shrink-0 gap-2 rounded-2xl border-border/60 bg-card/70 px-3 sm:px-4">
                <SlidersHorizontal className="h-4 w-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">{activeFilterCount}</span>}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto overscroll-contain rounded-t-3xl pb-[calc(1rem+env(safe-area-inset-bottom))]">
              <SheetHeader className="text-left">
                <SheetTitle>Filters and sorting</SheetTitle>
                <SheetDescription>Narrow the feed by account, amount, date, or transaction details.</SheetDescription>
              </SheetHeader>
              <div className="mt-5 grid grid-cols-1 gap-4 px-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="filter-tag">Tag</Label>
                  <Select value={tagFilter} onValueChange={setTagFilter}>
                    <SelectTrigger id="filter-tag" className="min-h-11 rounded-xl"><SelectValue placeholder="All tags" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All tags</SelectItem>
                      {availableTags.map((tag) => <SelectItem key={tag} value={tag}>#{tag}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-category">Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger id="filter-category" className="min-h-11 rounded-xl"><SelectValue placeholder="All categories">{categoryName(categoryFilter)}</SelectValue></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      <SelectItem value="uncategorized">Uncategorized</SelectItem>
                      {(categories || []).map((category) => <SelectItem key={category.id} value={String(category.id)}>{category.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div role="group" aria-labelledby="filter-month-label" className="space-y-2">
                    <Label id="filter-month-label">Month</Label>
                    <MonthPicker ariaLabel="Filter by month" value={monthFilter} onChange={setMonthFilter} allowAll className="min-h-11 w-full rounded-xl" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="filter-account">Account</Label>
                  <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger id="filter-account" className="min-h-11 rounded-xl"><SelectValue placeholder="All accounts" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All accounts</SelectItem>
                      {(accounts || []).map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <fieldset className="space-y-2 sm:col-span-2">
                  <legend className="text-sm font-medium">Amount range</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label htmlFor="filter-min-amount" className="text-xs text-muted-foreground">Minimum</Label><Input id="filter-min-amount" type="number" inputMode="decimal" min="0" step="0.01" value={minimumAmount} onChange={(event) => setMinimumAmount(event.target.value)} placeholder="No minimum" className="min-h-11 rounded-xl" /></div>
                    <div className="space-y-1.5"><Label htmlFor="filter-max-amount" className="text-xs text-muted-foreground">Maximum</Label><Input id="filter-max-amount" type="number" inputMode="decimal" min="0" step="0.01" value={maximumAmount} onChange={(event) => setMaximumAmount(event.target.value)} placeholder="No maximum" className="min-h-11 rounded-xl" /></div>
                  </div>
                  {invalidAmountRange && <p className="text-xs text-destructive" role="alert">Minimum amount must not exceed maximum.</p>}
                </fieldset>
                <fieldset className="space-y-2 sm:col-span-2">
                  <legend className="text-sm font-medium">Date range</legend>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label htmlFor="filter-date-from" className="text-xs text-muted-foreground">From</Label><Input id="filter-date-from" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="min-h-11 rounded-xl" /></div>
                    <div className="space-y-1.5"><Label htmlFor="filter-date-to" className="text-xs text-muted-foreground">To</Label><Input id="filter-date-to" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="min-h-11 rounded-xl" /></div>
                  </div>
                  {invalidDateRange && <p className="text-xs text-destructive" role="alert">Start date must not be after end date.</p>}
                </fieldset>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="filter-sort">Sort by</Label>
                  <Select value={sortOrder} onValueChange={(value) => setSortOrder(value as TransactionSortOrder)}>
                    <SelectTrigger id="filter-sort" className="min-h-11 rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest first</SelectItem>
                      <SelectItem value="oldest">Oldest first</SelectItem>
                      <SelectItem value="amount-desc">Largest amount</SelectItem>
                      <SelectItem value="amount-asc">Smallest amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
        {activeChips.length > 0 && (
          <div role="group" className="flex flex-wrap gap-2" aria-label="Active filters">
            {activeChips.map((chip) => (
              <button key={chip.key} type="button" onClick={chip.remove} className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-primary/10" aria-label={`Remove ${chip.label} filter`}>
                <span className="max-w-[14rem] truncate">{chip.label}</span><X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
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
