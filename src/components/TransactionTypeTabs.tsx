import { CreditCard, TrendingDown, TrendingUp } from "lucide-react";
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
] as const;

const activeStyles: Record<TransactionType, string> = {
  expense: "border-rose-500/40 bg-rose-500 text-white shadow-[0_8px_24px_-12px_rgba(239,68,68,0.7)]",
  income: "border-emerald-500/40 bg-emerald-500 text-white shadow-[0_8px_24px_-12px_rgba(34,197,94,0.7)]",
  loan: "border-indigo-500/40 bg-indigo-500 text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.7)]",
};

export function TransactionTypeTabs({
  value,
  onValueChange,
  variant = "pills",
}: {
  value: TransactionType;
  onValueChange: (value: TransactionType) => void;
  variant?: "pills" | "modal";
}) {
  return (
    <div className={cn("flex gap-3", variant === "modal" && "gap-2")} role="group" aria-label="Transaction type">
      {TRANSACTION_TYPES.map((tab) => {
        const Icon = tab.icon;
        const selected = value === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            aria-pressed={selected}
            onClick={() => onValueChange(tab.id)}
            className={variant === "modal"
              ? cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-sm font-semibold transition-all",
                  selected ? activeStyles[tab.id] : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
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
