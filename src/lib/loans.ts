import { roundMoney } from "./money";
import type { Transaction } from "@shared/schema";

export interface LoanProgress {
  totalAmount: number;
  totalSettled: number;
  remaining: number;
  percent: number;
  isSettled: boolean;
  status: "open" | "partial" | "settled";
}

export function getLoanProgress(tx: Partial<Transaction> | undefined | null): LoanProgress {
  const totalAmount = Number(tx?.amount) || 0;
  const settlements = Array.isArray(tx?.settlements) ? tx.settlements : [];
  const totalSettled = roundMoney(settlements.reduce((sum, s) => sum + Number(s.amount || 0), 0));
  const remaining = roundMoney(Math.max(0, totalAmount - totalSettled));
  const percent = totalAmount > 0 ? Math.min(100, Math.max(0, (totalSettled / totalAmount) * 100)) : 0;

  let status: "open" | "partial" | "settled" = "open";
  if (tx?.loanStatus === "settled" || (totalAmount > 0 && totalSettled >= totalAmount - 0.001)) {
    status = "settled";
  } else if (tx?.loanStatus === "partial" || totalSettled > 0) {
    status = "partial";
  }

  const isSettled = status === "settled";

  return {
    totalAmount,
    totalSettled,
    remaining,
    percent,
    isSettled,
    status,
  };
}

export function getLoanStatusColor(status?: "open" | "partial" | "settled" | string | null): string {
  if (status === "settled") {
    return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400";
  }
  if (status === "partial") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  }
  return "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400";
}

