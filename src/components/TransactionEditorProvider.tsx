import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { Transaction, Transfer } from "@shared/schema";
import { useHistoryBackDismiss } from "@/hooks/use-history-back-dismiss";
import type { TransactionType } from "@/components/TransactionTypeTabs";

export type EditorType = TransactionType | "transfer";

type TransactionEditorContextValue = {
  open: boolean;
  transaction?: Transaction | null;
  transfer?: Transfer | null;
  initialType?: EditorType;
  openNew: (type?: EditorType | React.SyntheticEvent | unknown) => void;
  openEdit: (tx: Transaction) => void;
  openEditTransfer: (transfer: Transfer) => void;
  setOpen: (open: boolean) => void;
};

const TransactionEditorContext = createContext<TransactionEditorContextValue | null>(null);

export function TransactionEditorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [transfer, setTransfer] = useState<Transfer | null>(null);
  const [initialType, setInitialType] = useState<EditorType>("expense");
  useHistoryBackDismiss(open, () => setOpenState(false));

  const openNew = useCallback((type?: unknown) => {
    const resolvedType: EditorType =
      type === "expense" || type === "income" || type === "loan" || type === "transfer"
        ? type
        : "expense";
    setTransaction(null);
    setTransfer(null);
    setInitialType(resolvedType);
    setOpenState(true);
  }, []);

  const openEdit = useCallback((tx: Transaction) => {
    setTransfer(null);
    setTransaction(tx);
    setInitialType((tx.type as TransactionType) ?? "expense");
    setOpenState(true);
  }, []);

  const openEditTransfer = useCallback((item: Transfer) => {
    setTransaction(null);
    setTransfer(item);
    setInitialType("transfer");
    setOpenState(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) {
      setTransaction(null);
      setTransfer(null);
      setInitialType("expense");
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get("action");
    if (action === "expense" || action === "income" || action === "loan" || action === "transfer") {
      openNew(action as EditorType);
      const url = new URL(window.location.href);
      url.searchParams.delete("action");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : "") + url.hash);
    }
  }, [openNew]);

  const value = useMemo(
    () => ({ open, transaction, transfer, initialType, openNew, openEdit, openEditTransfer, setOpen }),
    [open, transaction, transfer, initialType, openNew, openEdit, openEditTransfer, setOpen]
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
