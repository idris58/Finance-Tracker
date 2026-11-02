import { useMemo, useState, useLayoutEffect, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import {
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
  Pencil,
  Smartphone,
  Trash2,
  Wallet,
  Scale,
  ArrowLeftRight,
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import {
  useAccounts,
  useCategories,
  useDeleteAccount,
  useTransactions,
  useTransactionsByAccount,
  useTransfers,
  useUpdateAccount,
} from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatMoney, roundMoney } from "@/lib/money";
import { SensitiveValue } from "@/context/AppStateContext";
import { EmptyState } from "@/components/EmptyState";
import { TransactionRow } from "@/components/TransactionRow";
import { useTransactionEditor } from "@/components/TransactionEditorProvider";
import type { LoanSettlement, Transaction, Transfer } from "@shared/schema";

const accountTypes = [
  { value: "Cash", label: "Cash", icon: Wallet },
  { value: "Bank", label: "Bank", icon: Landmark },
  { value: "Mobile", label: "Mobile Wallet", icon: Smartphone },
] as const;

type EditForm = {
  name: string;
  type: "Cash" | "Bank" | "Mobile";
};

type AccountActivity =
  | { kind: "transaction"; key: string; date: Date; delta: number; runningBalance: number; transaction: Transaction }
  | { kind: "settlement"; key: string; date: Date; delta: number; runningBalance: number; transaction: Transaction; settlement: LoanSettlement }
  | { kind: "transfer"; key: string; date: Date; delta: number; runningBalance: number; transfer: Transfer; incoming: boolean };
type AccountActivityDraft =
  | Omit<Extract<AccountActivity, { kind: "transaction" }>, "runningBalance">
  | Omit<Extract<AccountActivity, { kind: "settlement" }>, "runningBalance">
  | Omit<Extract<AccountActivity, { kind: "transfer" }>, "runningBalance">;

type AccountFeedItem = { kind: "day"; dayKey: string } | { kind: "activity"; dayKey: string; activity: AccountActivity };

export default function AccountDetailPage() {
  const [, params] = useRoute("/accounts/:id");
  const [, navigate] = useLocation();
  const accountId = params?.id ? Number(params.id) : null;

  const { data: accounts } = useAccounts();
  const { data: accountTransactions = [], isLoading: isLoadingTransactions } = useTransactionsByAccount(accountId);
  const { data: allTransactions = [], isLoading: isLoadingSettlements } = useTransactions();
  const { data: allTransfers, isLoading: isLoadingTransfers } = useTransfers();
  const { data: categories } = useCategories();
  const { mutate: updateAccount, isPending: isUpdating } = useUpdateAccount();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();
  const currency = useCurrency();
  const { openEdit: openEditTransaction, openEditTransfer } = useTransactionEditor();

  const feedContainerRef = useRef<HTMLDivElement>(null);
  const [feedScrollMargin, setFeedScrollMargin] = useState(0);
  const [editOpen, setEditOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    type: "Cash",
  });
  const [newBalance, setNewBalance] = useState("");

  const account = useMemo(
    () => (accounts || []).find((a) => a.id === accountId) || null,
    [accounts, accountId]
  );

  const accountNameMap = useMemo(() => {
    const map = new Map<number, string>();
    (accounts || []).forEach((acc) => {
      if (acc.id !== undefined) map.set(acc.id, acc.name);
    });
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map<number, { name: string; color: string }>();
    (categories || []).forEach((cat) => {
      if (cat.id !== undefined) map.set(cat.id, { name: cat.name, color: cat.color });
    });
    return map;
  }, [categories]);

  // Transfers involving this account
  const accountTransfers = useMemo(
    () =>
      (allTransfers || []).filter(
        (t) => t.fromAccountId === accountId || t.toAccountId === accountId
      ),
    [allTransfers, accountId]
  );

  const currentBalance = Number(account?.balance || 0);
  const accountActivity = useMemo(() => {
    const entries: AccountActivityDraft[] = [];
    for (const transaction of accountTransactions) {
      const amount = Number(transaction.amount) || 0;
      const delta = transaction.type === "income" ? amount
        : transaction.type === "loan" && transaction.loanType === "borrow" ? amount
        : -amount;
      entries.push({
        kind: "transaction",
        key: `transaction-${transaction.id}`,
        date: new Date(transaction.date),
        delta: roundMoney(delta),
        transaction,
      });

    }
    for (const transaction of allTransactions) {
      for (const settlement of transaction.settlements ?? []) {
        if (settlement.accountId !== accountId) continue;
        const settlementAmount = Number(settlement.amount) || 0;
        const settlementDelta = transaction.loanType === "borrow" ? -settlementAmount : settlementAmount;
        entries.push({
          kind: "settlement",
          key: `settlement-${transaction.id}-${settlement.id}`,
          date: new Date(settlement.date),
          delta: roundMoney(settlementDelta),
          transaction,
          settlement,
        });
      }
    }
    for (const transfer of accountTransfers) {
      const incoming = transfer.toAccountId === accountId;
      entries.push({
        kind: "transfer",
        key: `transfer-${transfer.id}`,
        date: new Date(transfer.date),
        delta: roundMoney((incoming ? 1 : -1) * (Number(transfer.amount) || 0)),
        transfer,
        incoming,
      });
    }

    entries.sort((a, b) => a.date.getTime() - b.date.getTime() || a.key.localeCompare(b.key));
    let runningBalance = roundMoney(currentBalance - entries.reduce((sum, entry) => sum + entry.delta, 0));
    return entries.map((entry) => {
      runningBalance = roundMoney(runningBalance + entry.delta);
      return { ...entry, runningBalance } as AccountActivity;
    }).reverse();
  }, [accountTransactions, allTransactions, accountTransfers, accountId, currentBalance]);
  const feedItems = useMemo(() => {
    const items: AccountFeedItem[] = [];
    let previousDay = "";
    for (const activity of accountActivity) {
      const dayKey = format(activity.date, "yyyy-MM-dd");
      if (dayKey !== previousDay) {
        items.push({ kind: "day", dayKey });
        previousDay = dayKey;
      }
      items.push({ kind: "activity", dayKey, activity });
    }
    return items;
  }, [accountActivity]);
  useLayoutEffect(() => {
    const updateScrollMargin = () => {
      const element = feedContainerRef.current;
      if (element) setFeedScrollMargin(element.getBoundingClientRect().top + window.scrollY);
    };
    updateScrollMargin();
    window.addEventListener("resize", updateScrollMargin);
    return () => window.removeEventListener("resize", updateScrollMargin);
  }, [accountId, feedItems.length]);
  const feedVirtualizer = useWindowVirtualizer({
    count: feedItems.length,
    estimateSize: (index) => feedItems[index]?.kind === "day" ? 38 : 104,
    getItemKey: (index) => feedItems[index]?.kind === "day" ? `day-${feedItems[index].dayKey}` : feedItems[index]?.kind === "activity" ? feedItems[index].activity.key : index,
    overscan: 8,
    scrollMargin: feedScrollMargin,
  });
  const adjustDiff = newBalance !== "" ? roundMoney(Number(newBalance) - currentBalance) : 0;

  const openEdit = () => {
    if (!account) return;
    setEditForm({ name: account.name, type: account.type });
    setEditOpen(true);
  };

  const saveEdit = () => {
    if (!account?.id || !editForm.name.trim()) return;
    updateAccount(
      { id: account.id, data: { name: editForm.name, type: editForm.type } },
      { onSuccess: () => setEditOpen(false) }
    );
  };

  const openAdjust = () => {
    setNewBalance(String(currentBalance));
    setAdjustOpen(true);
  };

  const saveAdjust = () => {
    if (!account?.id || newBalance === "") return;
    updateAccount(
      { id: account.id, data: { balance: newBalance } },
      { onSuccess: () => setAdjustOpen(false) }
    );
  };

  const confirmDelete = () => {
    if (!account?.id) return;
    deleteAccount(account.id, {
      onSuccess: () => {
        setDeleteConfirmOpen(false);
        navigate("/accounts");
      },
      onError: () => setDeleteConfirmOpen(false),
    });
  };

  if (!account) {
    return (
      <div className="space-y-6">
        <button
          onClick={() => navigate("/accounts")}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to accounts
        </button>
        <EmptyState
          title="Account not found"
          hint="This account may have been deleted."
          primaryActionLabel="Go to accounts"
          onPrimaryAction={() => navigate("/accounts")}
        />
      </div>
    );
  }

  const TypeIcon =
    accountTypes.find((t) => t.value === account.type)?.icon || CreditCard;
  const typeLabel =
    accountTypes.find((t) => t.value === account.type)?.label || account.type;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/accounts")}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-background/60 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold truncate">{account.name}</h2>
          <p className="text-xs text-muted-foreground">{typeLabel}</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full"
          onClick={openEdit}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full text-destructive"
          onClick={() => setDeleteConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Balance Hero Card */}
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/60 to-card/90 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <TypeIcon className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Current balance</p>
            <h2 className="text-3xl font-semibold">
              <SensitiveValue>
                {currency}
                {formatMoney(currentBalance)}
              </SensitiveValue>
            </h2>
          </div>
        </div>
        <Button
          variant="outline"
          className="rounded-full"
          onClick={openAdjust}
        >
          <Scale className="mr-2 h-4 w-4" />
          Adjust balance
        </Button>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Account activity</h3>
        {(isLoadingTransactions || isLoadingSettlements || isLoadingTransfers) && <p className="text-sm text-muted-foreground">Loading activity…</p>}
        {!isLoadingTransactions && !isLoadingSettlements && !isLoadingTransfers && accountActivity.length === 0 && (
          <EmptyState title="No account activity" hint="Transactions, loan payments, and transfers involving this account will appear here." />
        )}
        {accountActivity.length > 0 && (
          <div
            ref={feedContainerRef}
            className="relative w-full"
            style={{ height: `${Math.max(0, feedVirtualizer.getTotalSize() - feedScrollMargin)}px` }}
          >
            {feedVirtualizer.getVirtualItems().map((virtualItem) => {
              const item = feedItems[virtualItem.index];
              if (!item) return null;
              let content;
              if (item.kind === "day") {
                const date = new Date(`${item.dayKey}T12:00:00`);
                content = (
                  <h4 className="-mx-1 bg-background/95 px-1 py-2 text-xs font-medium text-muted-foreground">
                    {isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "MMM d, yyyy")}
                  </h4>
                );
              } else if (item.activity.kind === "transaction") {
                const transaction = item.activity.transaction;
                const category = transaction.categoryId ? categoryMap.get(transaction.categoryId) : null;
                content = (
                  <div className="pb-2">
                    <TransactionRow
                      transaction={transaction}
                      currency={currency}
                      variant="account"
                      categoryLabel={category?.name}
                      categoryColor={category?.color}
                      runningBalance={item.activity.runningBalance}
                      onOpen={() => openEditTransaction(transaction)}
                    />
                  </div>
                );
              } else if (item.activity.kind === "settlement") {
                const { transaction, settlement, delta, runningBalance } = item.activity;
                const incoming = delta > 0;
                const label = transaction.loanType === "borrow" ? "Loan repayment" : "Loan payment received";
                content = (
                  <div className="pb-2">
                    <button type="button" onClick={() => openEditTransaction(transaction)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 text-left transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", incoming ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                          {incoming ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{label}{transaction.counterparty ? ` · ${transaction.counterparty}` : ""}</p>
                          {settlement.note && <p className="truncate text-xs text-muted-foreground">{settlement.note}</p>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("text-sm font-semibold", incoming ? "text-emerald-600" : "text-rose-600")}>
                          <SensitiveValue>{incoming ? "+" : "-"}{currency}{formatMoney(Math.abs(delta))}</SensitiveValue>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Balance <SensitiveValue>{currency}{formatMoney(runningBalance)}</SensitiveValue></p>
                      </div>
                    </button>
                  </div>
                );
              } else {
                const { transfer, incoming, delta, runningBalance } = item.activity;
                const otherAccount = incoming ? transfer.fromAccountId : transfer.toAccountId;
                content = (
                  <div className="pb-2">
                    <button type="button" onClick={() => openEditTransfer(transfer)} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/80 p-3 text-left transition hover:border-primary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", incoming ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600")}>
                          <ArrowLeftRight className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">Transfer {incoming ? "from" : "to"} {accountNameMap.get(otherAccount) || "Unknown account"}</p>
                          {transfer.note && <p className="truncate text-xs text-muted-foreground">{transfer.note}</p>}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={cn("text-sm font-semibold", incoming ? "text-emerald-600" : "text-rose-600")}>
                          <SensitiveValue>{delta > 0 ? "+" : "-"}{currency}{formatMoney(Math.abs(delta))}</SensitiveValue>
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">Balance <SensitiveValue>{currency}{formatMoney(runningBalance)}</SensitiveValue></p>
                      </div>
                    </button>
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
      </section>

      {/* Edit Account Dialog (name & type only) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Edit account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Account name</Label>
              <Input
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="e.g. Cash, Bank"
              />
            </div>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={editForm.type}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    type: value as EditForm["type"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {accountTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={saveEdit}
              disabled={isUpdating}
              className="w-full"
            >
              Save changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Adjust Balance Dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Adjust balance</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current balance</Label>
              <p className="text-lg font-semibold">
                {currency}
                {formatMoney(currentBalance)}
              </p>
            </div>
            <div className="space-y-2">
              <Label>New balance</Label>
              <Input
                type="number"
                value={newBalance}
                onChange={(e) => setNewBalance(e.target.value)}
                placeholder="Enter new balance"
              />
              {newBalance !== "" && adjustDiff !== 0 && (
                <p
                  className={cn(
                    "text-xs font-medium",
                    adjustDiff > 0
                      ? "text-emerald-600"
                      : "text-rose-600"
                  )}
                >
                  {adjustDiff > 0 ? "+" : ""}
                  {currency}
                  {formatMoney(Math.abs(adjustDiff))} adjustment
                </p>
              )}
            </div>
            <Button
              onClick={saveAdjust}
              disabled={isUpdating || newBalance === ""}
              className="w-full"
            >
              Apply adjustment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the account. Deletion is blocked if
              any transactions use it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={isDeleting}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

