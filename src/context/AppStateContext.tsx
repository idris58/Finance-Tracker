import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type TransactionFilter = "all" | "expense" | "income" | "loan";
export type LoanStatusFilter = "all" | "open" | "partial" | "settled";

type StoredState = {
  month?: string;
  searchTerm?: string;
  filter?: TransactionFilter;
  loanStatusFilter?: LoanStatusFilter;
  tagFilter?: string;
  monthFilter?: string;
  categoryFilter?: string;
};

type AppStateValue = {
  monthDate: Date;
  setMonthDate: (date: Date) => void;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filter: TransactionFilter;
  setFilter: (value: TransactionFilter) => void;
  loanStatusFilter: LoanStatusFilter;
  setLoanStatusFilter: (value: LoanStatusFilter) => void;
  tagFilter: string;
  setTagFilter: (value: string) => void;
  monthFilter: string;
  setMonthFilter: (value: string) => void;
  categoryFilter: string;
  setCategoryFilter: (value: string) => void;
  hideBalance: boolean;
  setHideBalance: (value: boolean) => void;
  toggleHideBalance: () => void;
};

const AppStateContext = createContext<AppStateValue | null>(null);
const VIEW_STATE_KEY = "financeTrackerViewState";
const PRIVACY_KEY = "hideBalance";
const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

function readState(): StoredState {
  try {
    if (typeof window === "undefined") return {};
    return JSON.parse(localStorage.getItem(VIEW_STATE_KEY) || "{}");
  } catch {
    return {};
  }
}

function validMonth(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [stored] = useState(readState);
  const [month, setMonth] = useState(validMonth(stored.month) ? stored.month : currentMonth());
  const [searchTerm, setSearchTerm] = useState(stored.searchTerm ?? "");
  const [filter, setFilter] = useState<TransactionFilter>(stored.filter ?? "all");
  const [loanStatusFilter, setLoanStatusFilter] = useState<LoanStatusFilter>(stored.loanStatusFilter ?? "all");
  const [tagFilter, setTagFilter] = useState(stored.tagFilter ?? "all");
  const [monthFilter, setMonthFilter] = useState(stored.monthFilter ?? "all");
  const [categoryFilter, setCategoryFilter] = useState(stored.categoryFilter ?? "all");
  const [hideBalance, setHideBalance] = useState(() => {
    try { return typeof window !== "undefined" && localStorage.getItem(PRIVACY_KEY) === "true"; }
    catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem(VIEW_STATE_KEY, JSON.stringify({ month, searchTerm, filter, loanStatusFilter, tagFilter, monthFilter, categoryFilter })); }
    catch { /* Storage may be unavailable; state remains usable for this session. */ }
  }, [month, searchTerm, filter, loanStatusFilter, tagFilter, monthFilter, categoryFilter]);
  useEffect(() => {
    try { localStorage.setItem(PRIVACY_KEY, String(hideBalance)); }
    catch { /* Storage may be unavailable; state remains usable for this session. */ }
  }, [hideBalance]);

  const monthDate = useMemo(() => new Date(`${month}-01T12:00:00`), [month]);
  const setMonthDate = (date: Date) => setMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  const toggleHideBalance = () => setHideBalance((value) => !value);
  const value = useMemo(() => ({ monthDate, setMonthDate, searchTerm, setSearchTerm, filter, setFilter,
    loanStatusFilter, setLoanStatusFilter, tagFilter, setTagFilter, monthFilter, setMonthFilter, categoryFilter, setCategoryFilter,
    hideBalance, setHideBalance, toggleHideBalance }),
  [monthDate, searchTerm, filter, loanStatusFilter, tagFilter, monthFilter, categoryFilter, hideBalance]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const state = useContext(AppStateContext);
  if (!state) throw new Error("useAppState must be used within AppStateProvider");
  return state;
}

export function SensitiveValue({ children }: { children: ReactNode }) {
  const { hideBalance } = useAppState();
  return <span aria-label={hideBalance ? "Hidden amount" : undefined}>{hideBalance ? "••••••" : children}</span>;
}
