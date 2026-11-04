import { ArrowLeftRight, CreditCard, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export const TRANSACTION_TYPES = [
  { id: "expense", label: "Expenses", singularLabel: "Expense", icon: TrendingDown },
  { id: "income", label: "Income", singularLabel: "Income", icon: TrendingUp },
  { id: "loan", label: "Loan", singularLabel: "Loan", icon: CreditCard },
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number]["id"];
export const TRANSACTION_FILTER_TYPES = [
  { id: "all", label: "All" },
  ...TRANSACTION_TYPES,
  { id: "transfer", label: "Transfer", icon: ArrowLeftRight, singularLabel: "Transfer" },
] as const;
export type TransactionFilterType = (typeof TRANSACTION_FILTER_TYPES)[number]["id"];
export type TransactionEditorType = TransactionType | "transfer";

const activeStyles: Record<TransactionType, string> = {
  expense: "border-rose-500/40 bg-rose-500 text-white shadow-[0_8px_24px_-12px_rgba(239,68,68,0.7)]",
  income: "border-emerald-500/40 bg-emerald-500 text-white shadow-[0_8px_24px_-12px_rgba(34,197,94,0.7)]",
  loan: "border-indigo-500/40 bg-indigo-500 text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.7)]",
};

const transferActiveStyle = "border-primary/40 bg-primary text-primary-foreground shadow-[0_8px_24px_-12px_rgba(244,63,94,0.6)]";

type PillTabsProps = {
  value: TransactionType;
  onValueChange: (value: TransactionType) => void;
  variant?: "pills";
  lockedValue?: never;
};
type ModalTabsProps = {
  value: TransactionEditorType;
  onValueChange: (value: TransactionEditorType) => void;
  variant: "modal";
  lockedValue?: TransactionEditorType;
};

export function TransactionTypeTabs(props: PillTabsProps): JSX.Element;
export function TransactionTypeTabs(props: ModalTabsProps): JSX.Element;
export function TransactionTypeTabs({
  value,
  onValueChange,
  variant = "pills",
  lockedValue,
}: PillTabsProps | ModalTabsProps): JSX.Element {
  const selectTab = (id: TransactionEditorType) => {
    if (id === "transfer") (onValueChange as ModalTabsProps["onValueChange"])(id);
    else (onValueChange as PillTabsProps["onValueChange"])(id);
  };
  return (
    <div className={cn(variant === "modal" ? "grid grid-cols-2 gap-2 sm:grid-cols-4" : "flex gap-3")} role="group" aria-label="Transaction type">
      {[...TRANSACTION_TYPES, ...(variant === "modal" ? [{ id: "transfer" as const, label: "Transfer", singularLabel: "Transfer", icon: ArrowLeftRight }] : [])].map((tab) => {
        const Icon = tab.icon;
        const selected = value === tab.id;
        const disabled = variant === "modal" && lockedValue !== undefined && tab.id !== lockedValue;
        const selectedStyle = tab.id === "transfer" ? transferActiveStyle : activeStyles[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={selected}
            aria-disabled={disabled}
            disabled={disabled}
            onClick={() => selectTab(tab.id)}
            className={variant === "modal"
              ? cn(
                  "flex min-w-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-2.5 text-xs font-semibold transition-all sm:px-3 sm:text-sm",
                  selected ? selectedStyle : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground",
                  disabled && "pointer-events-none cursor-not-allowed opacity-45"
                )
              : cn(
                  "flex-1 rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                  selected ? "border-primary/40 bg-primary text-primary-foreground shadow-[0_12px_30px_-20px_rgba(244,63,94,0.8)]" : "border-border/60 bg-card/70 text-muted-foreground"
                )}
          >
            {variant === "modal" && <Icon className="h-3.5 w-3.5" />}
            {variant === "modal" ? tab.singularLabel : tab.label}
          </button>
        );
      })}
    </div>
  );
}
