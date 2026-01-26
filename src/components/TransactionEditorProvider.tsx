import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { Transaction } from "@shared/schema";

type TransactionEditorContextValue = {
  open: boolean;
  transaction?: Transaction | null;
  openNew: () => void;
  openEdit: (tx: Transaction) => void;
  setOpen: (open: boolean) => void;
};

const TransactionEditorContext = createContext<TransactionEditorContextValue | null>(null);

export function TransactionEditorProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpenState] = useState(false);
  const [transaction, setTransaction] = useState<Transaction | null>(null);

  const openNew = useCallback(() => {
    setTransaction(null);
    setOpenState(true);
  }, []);

  const openEdit = useCallback((tx: Transaction) => {
    setTransaction(tx);
    setOpenState(true);
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    if (!next) {
      setTransaction(null);
    }
  }, []);

  const value = useMemo(
    () => ({ open, transaction, openNew, openEdit, setOpen }),
    [open, transaction, openNew, openEdit, setOpen]
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
