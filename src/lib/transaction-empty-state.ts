import { format } from "date-fns";

export type TransactionEmptyState = {
  title: string;
  hint: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
};

type EmptyStateOptions = {
  context: "home" | "statistics" | "transactions" | "yearly";
  noAccounts: boolean;
  onAddAccount: () => void;
  onAddTransaction: () => void;
  hasAnyTypeTransactions?: boolean;
  activeType?: "expense" | "income" | "loan";
  monthDate?: Date;
  onViewPreviousMonth?: () => void;
  hasAnyTransactions?: boolean;
  hasFilters?: boolean;
  onClearFilters?: () => void;
};

const typeNoun = (type: EmptyStateOptions["activeType"]) =>
  type === "loan" ? "loans" : type === "income" ? "income" : "expenses";

export function getTransactionEmptyState(options: EmptyStateOptions): TransactionEmptyState {
  const { context, noAccounts, onAddAccount, onAddTransaction } = options;

  if (noAccounts) {
    return {
      title: "Add an account first",
      hint: context === "transactions"
        ? "Create an account before tracking transactions."
        : context === "yearly"
          ? "Create an account to start building yearly balance history."
          : "Create an account before adding transactions.",
      primaryActionLabel: "Add account",
      onPrimaryAction: onAddAccount,
    };
  }

  if (context === "transactions") {
    if (options.hasAnyTransactions && options.hasFilters) {
      return {
        title: "No transactions match",
        hint: "Try another month or clear filters.",
        primaryActionLabel: "Clear filters",
        onPrimaryAction: options.onClearFilters,
        secondaryActionLabel: "Add transaction",
        onSecondaryAction: onAddTransaction,
      };
    }
    return {
      title: "No transactions yet",
      hint: "Add your first transaction to start tracking.",
      primaryActionLabel: "Add transaction",
      onPrimaryAction: onAddTransaction,
    };
  }

  if (context === "yearly") {
    return {
      title: "No yearly data yet",
      hint: "Your monthly balance summary will appear here after transactions are added.",
      primaryActionLabel: "Add transaction",
      onPrimaryAction: onAddTransaction,
    };
  }

  const type = options.activeType ?? "expense";
  if (options.hasAnyTypeTransactions && options.monthDate) {
    return {
      title: `No ${typeNoun(type)} in ${format(options.monthDate, "MMMM yyyy")}`,
      hint: "Try another month or add one now.",
      primaryActionLabel: "Add transaction",
      onPrimaryAction: onAddTransaction,
      secondaryActionLabel: "View last month",
      onSecondaryAction: options.onViewPreviousMonth,
    };
  }

  return {
    title: `No ${typeNoun(type)} yet`,
    hint: context === "statistics"
      ? "Add transactions to see charts and totals."
      : `Add your first ${type === "loan" ? "loan" : type} to get started.`,
    primaryActionLabel: "Add transaction",
    onPrimaryAction: onAddTransaction,
  };
}
