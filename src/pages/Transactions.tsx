import { useState } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings, useTransactions } from "@/hooks/use-finance";
import { cn } from "@/lib/utils";
import { getCategoryIcon } from "@/lib/category-icons";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";

const filterTabs = [
  { id: "all", label: "All" },
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "loan", label: "Loan" },
] as const;

type FilterType = (typeof filterTabs)[number]["id"];

export default function TransactionsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const { data: transactions, isLoading } = useTransactions();
  const { data: settings } = useSettings();
  const { openEdit } = useTransactionEditor();

  const currency = settings?.currencySymbol || "$";

  const availableTags = Array.from(new Set((transactions || []).flatMap((tx) => Array.isArray(tx.tags) ? tx.tags : []))).sort();

  const filteredTx = (transactions || []).filter((tx) => {
    const matchesSearch =
      tx.categoryName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.note?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (Array.isArray(tx.tags) && tx.tags.some((tag) => tag.toLowerCase().includes(searchTerm.toLowerCase())));

    const type = tx.type || "expense";
    const matchesFilter = filter === "all" || type === filter;
    const matchesTag = tagFilter === "all" || (Array.isArray(tx.tags) && tx.tags.includes(tagFilter));

    return matchesSearch && matchesFilter && matchesTag;
  });

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search transactions..."
              className="pl-9 rounded-2xl border-border/60 bg-card/70"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="sm:w-56">
            <Select value={tagFilter} onValueChange={setTagFilter}>
              <SelectTrigger className="rounded-2xl border-border/60 bg-card/70">
                <SelectValue placeholder="Filter by tag" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {availableTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-xs font-semibold",
              filter === tab.id
                ? "border-primary/40 bg-primary text-primary-foreground"
                : "border-border/60 bg-card/70 text-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!isLoading && filteredTx.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center text-sm text-muted-foreground">
            No transactions found.
          </div>
        )}
        {filteredTx.map((tx) => {
          const entry = getCategoryIcon(tx.categoryName);
          const Icon = entry.icon;
          return (
            <button
              key={tx.id}
              onClick={() => tx.id && openEdit(tx)}
              className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4 text-left transition hover:border-primary/30 hover:bg-card"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-background">
                  <Icon className={cn("h-5 w-5", entry.className)} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{tx.categoryName || "Uncategorized"}</p>
                    {tx.type === "loan" && tx.loanStatus && (
                      <span
                        className={cn(
                          "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                          tx.loanStatus === "settled"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-rose-100 text-rose-700"
                        )}
                      >
                        {tx.loanStatus}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(tx.date), "MMM d, yyyy")} - {tx.paymentMethod}
                  </p>
                  {tx.counterparty && <p className="text-xs text-muted-foreground/80">{tx.counterparty}</p>}
                  {tx.note && <p className="text-xs text-muted-foreground/80">{tx.note}</p>}
                  {Array.isArray(tx.tags) && tx.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {tx.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-secondary/70 px-2 py-0.5 text-[10px] text-muted-foreground">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">
                  {tx.type === "income" || (tx.type === "loan" && tx.loanType === "borrow") ? "+" : "-"}
                  {currency}{Number(tx.amount).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">{format(new Date(tx.date), "p")}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

