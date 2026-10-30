import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Transaction } from "@shared/schema";
import { useHistoryBackDismiss } from "@/hooks/use-history-back-dismiss";

type TxType = "expense" | "income" | "loan";

type TransactionEditorContextValue = {
  open: boolean;
  transaction?: Transaction | null;
  initialType?: TxType;
  openNew: (type?: TxType | React.SyntheticEvent | unknown) => void;
  openEdit: (tx: Transaction) => void;
  setOpen: (open: boolean) => void;
};

const TransactionEditorContext = createContext<TransactionEditorContextValue | null>(null);

export function TransactionEditorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [initialType, setInitialType] = useState<TxType>("expense");
  useHistoryBackDismiss(open, () => setOpenState(false));

  const openNew = useCallback((type?: unknown) => {
    const resolvedType: TxType =
      type === "expense" || type === "income" || type === "loan"
        ? type
        : "expense";
    setTransaction(null);
    setInitialType(resolvedType);
    setOpenState(true);
  }, []);

  const openEdit = useCallback((tx: Transaction) => {
    setTransaction(tx);
    setInitialType((tx.type as TxType) ?? "expense");
    setOpenState(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) {
      setTransaction(null);
      setInitialType("expense");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "expense" || action === "income") {
      openNew(action as TxType);
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }
  }, [openNew]);

  const value = useMemo(
    () => ({ open, transaction, initialType, openNew, openEdit, setOpen }),
    [open, transaction, initialType, openNew, openEdit, setOpen]
  );

  return (
    <TransactionEditorContext.Provider value={value}>
      {children}
    </TransactionEditorContext.Provider>
  );
}

export function useTransactionEditor() {
  const context = useContext(TransactionEditorContext);
  if (!context) {
    throw new Error("useTransactionEditor must be used within TransactionEditorProvider");
  }
  return context;
}
