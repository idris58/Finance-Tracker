import { useMemo, useState } from "react";
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
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import {
  useAccounts,
  useCategories,
  useDeleteAccount,
  useTransactions,
  useTransfers,
  useUpdateAccount,
} from "@/hooks/use-finance";
import { useCurrency } from "@/hooks/use-currency";
import { useBalancePrivacy } from "@/hooks/use-balance-privacy";
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
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const accountTypes = [
  { value: "Cash", label: "Cash", icon: Wallet },
  { value: "Bank", label: "Bank", icon: Landmark },
  { value: "Mobile", label: "Mobile Wallet", icon: Smartphone },
] as const;

type EditForm = {
  name: string;
  type: "Cash" | "Bank" | "Mobile";
};

export default function AccountDetailPage() {
  const [, params] = useRoute("/accounts/:id");
  const [, navigate] = useLocation();
  const accountId = params?.id ? Number(params.id) : null;

  const { data: accounts } = useAccounts();
  const { data: allTransactions } = useTransactions();
  const { data: allTransfers } = useTransfers();
  const { data: categories } = useCategories();
  const { mutate: updateAccount, isPending: isUpdating } = useUpdateAccount();
  const { mutate: deleteAccount, isPending: isDeleting } = useDeleteAccount();
  const { hideBalance } = useBalancePrivacy();
  const currency = useCurrency();

  const [activeTab, setActiveTab] = useState<"transactions" | "transfers">(
    "transactions"
  );
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

  // Transactions for this account
  const accountTransactions = useMemo(
    () =>
      (allTransactions || []).filter((tx) => tx.accountId === accountId),
    [allTransactions, accountId]
  );

  // Transfers involving this account
  const accountTransfers = useMemo(
    () =>
      (allTransfers || []).filter(
        (t) => t.fromAccountId === accountId || t.toAccountId === accountId
      ),
    [allTransfers, accountId]
  );

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: { label: string; items: typeof accountTransactions }[] = [];
    const map = new Map<string, typeof accountTransactions>();

    for (const tx of accountTransactions) {
      const d = new Date(tx.date);
      let label: string;
      if (isToday(d)) label = "Today";
      else if (isYesterday(d)) label = "Yesterday";
      else label = format(d, "MMM d, yyyy");

      if (!map.has(label)) map.set(label, []);
      map.get(label)!.push(tx);
    }

    for (const [label, items] of map) {
      groups.push({ label, items });
    }
    return groups;
  }, [accountTransactions]);

  // Balance history for chart
  const balanceHistory = useMemo(() => {
    if (!account) return [];

    // Combine transactions and transfers into a single timeline
    type TimelineEntry = { date: Date; delta: number };
    const entries: TimelineEntry[] = [];

    for (const tx of accountTransactions) {
      const amount = Number(tx.amount);
      let delta = 0;
      if (tx.type === "income") delta = amount;
      else if (tx.type === "expense") delta = -amount;
      else if (tx.type === "loan") {
        delta = tx.loanType === "borrow" ? amount : -amount;
      }
      entries.push({ date: new Date(tx.date), delta: roundMoney(delta) });
    }

    for (const tr of accountTransfers) {
      const amount = Number(tr.amount);
      if (tr.toAccountId === accountId) {
        entries.push({ date: new Date(tr.date), delta: roundMoney(amount) });
      }
      if (tr.fromAccountId === accountId) {
        entries.push({ date: new Date(tr.date), delta: roundMoney(-amount) });
      }
    }

    // Sort oldest first
    entries.sort((a, b) => a.date.getTime() - b.date.getTime());

    if (entries.length === 0) {
      return [{ date: format(new Date(), "MMM d"), balance: Number(account.balance || 0) }];
    }

    // Work backwards from the current balance to find starting balance
    const currentBalance = Number(account.balance || 0);
    const totalDelta = entries.reduce((sum, e) => sum + e.delta, 0);
    let runningBalance = roundMoney(currentBalance - totalDelta);

    const points: { date: string; balance: number }[] = [];
    for (const entry of entries) {
      runningBalance = roundMoney(runningBalance + entry.delta);
      points.push({
        date: format(entry.date, "MMM d"),
        balance: runningBalance,
      });
    }

    // Deduplicate to last 30 points
    const last = points.length > 30 ? points.slice(-30) : points;
    return last;
  }, [account, accountTransactions, accountTransfers, accountId]);

  const currentBalance = Number(account?.balance || 0);
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

      {/* Balance History Chart */}
      {balanceHistory.length > 1 && (
        <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
          <p className="text-sm font-medium mb-3">Balance history</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={balanceHistory}>
              <defs>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip
                formatter={(value: number) => [
                  `${currency}${formatMoney(value)}`,
                  "Balance",
                ]}
                contentStyle={{
                  borderRadius: "12px",
                  fontSize: "12px",
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--card))",
                }}
              />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#balanceGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "transactions" ? "default" : "outline"}
          className="rounded-full flex-1"
          onClick={() => setActiveTab("transactions")}
        >
          Transactions ({accountTransactions.length})
        </Button>
        <Button
          variant={activeTab === "transfers" ? "default" : "outline"}
          className="rounded-full flex-1"
          onClick={() => setActiveTab("transfers")}
        >
          Transfers ({accountTransfers.length})
        </Button>
      </div>

      {/* Transactions Tab */}
      {activeTab === "transactions" && (
        <div className="space-y-4">
          {groupedTransactions.length === 0 ? (
            <EmptyState
              title="No transactions"
              hint="Transactions linked to this account will appear here."
            />
          ) : (
            groupedTransactions.map((group) => (
              <div key={group.label} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground px-1">
                  {group.label}
                </p>
                {group.items.map((tx) => {
                  const cat = tx.categoryId
                    ? categoryMap.get(tx.categoryId)
                    : null;
                  const amount = Number(tx.amount);
                  const isIncome = tx.type === "income";
                  const isLoanBorrow =
                    tx.type === "loan" && tx.loanType === "borrow";
                  const positive = isIncome || isLoanBorrow;

                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {cat && (
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {cat?.name || tx.categoryName || "Uncategorized"}
                          </p>
                          {tx.note && (
                            <p className="text-xs text-muted-foreground truncate">
                              {tx.note}
                            </p>
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-sm font-semibold shrink-0 ml-2",
                          positive
                            ? "text-emerald-600"
                            : "text-rose-600"
                        )}
                      >
                        <SensitiveValue>
                          {positive ? "+" : "-"}
                          {currency}
                          {formatMoney(amount)}
                        </SensitiveValue>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}

      {/* Transfers Tab */}
      {activeTab === "transfers" && (
        <div className="space-y-2">
          {accountTransfers.length === 0 ? (
            <EmptyState
              title="No transfers"
              hint="Transfers involving this account will appear here."
            />
          ) : (
            accountTransfers.map((tr) => {
              const incoming = tr.toAccountId === accountId;
              const otherName = incoming
                ? accountNameMap.get(tr.fromAccountId) || "Unknown"
                : accountNameMap.get(tr.toAccountId) || "Unknown";
              const amount = Number(tr.amount);

              return (
                <div
                  key={tr.id}
                  className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl shrink-0",
                        incoming
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-rose-500/10 text-rose-600"
                      )}
                    >
                      {incoming ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {incoming ? "From" : "To"} {otherName}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(tr.date), "MMM d, yyyy")}
                      </p>
                      {tr.note && (
                        <p className="text-xs text-muted-foreground truncate">
                          {tr.note}
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "text-sm font-semibold shrink-0 ml-2",
                      incoming ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    <SensitiveValue>
                      {incoming ? "+" : "-"}
                      {currency}
                      {formatMoney(amount)}
                    </SensitiveValue>
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

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

