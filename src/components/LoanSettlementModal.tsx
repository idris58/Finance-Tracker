import { useState, useMemo } from "react";
import { format } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import {
  CalendarIcon,
  CheckCircle2,
  ChevronRight,
  Clock,
  Trash2,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import type { Transaction, LoanSettlement } from "@shared/schema";
import { useAccounts, useAddLoanSettlement, useDeleteLoanSettlement, useSettings } from "@/hooks/use-finance";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { formatMoney, roundMoney } from "@/lib/money";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction;
}

type QuickAmount = "remaining" | "half" | "quarter" | "custom";

function ProgressBar({ percent, status }: { percent: number; status: string }) {
  const color =
    status === "settled"
      ? "bg-emerald-500"
      : status === "partial"
        ? "bg-amber-400"
        : "bg-muted";

  return (
    <div
      className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${Math.round(percent)}% settled`}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-700 ease-out", color)}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export function LoanSettlementModal({ open, onOpenChange, transaction }: Props) {
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const { mutate: addSettlement, isPending: isAdding } = useAddLoanSettlement();
  const { mutate: deleteSettlement, isPending: isDeleting } = useDeleteLoanSettlement();

  const currency = settings?.currencySymbol || "৳";
  const totalAmount = Number(transaction.amount);
  const settlements = useMemo(
    () =>
      (transaction.settlements ?? [])
        .slice()
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transaction.settlements]
  );
  const totalSettled = useMemo(
    () => roundMoney(settlements.reduce((sum, s) => sum + Number(s.amount), 0)),
    [settlements]
  );
  const remaining = useMemo(() => roundMoney(Math.max(0, totalAmount - totalSettled)), [totalAmount, totalSettled]);
  const percent = totalAmount > 0 ? (totalSettled / totalAmount) * 100 : 0;

  const defaultAccountId = accounts?.[0]?.id ?? null;
  const [quickMode, setQuickMode] = useState<QuickAmount>("remaining");
  const [customAmount, setCustomAmount] = useState("");
  const [accountId, setAccountId] = useState<number | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [note, setNote] = useState("");
  const [isDateOpen, setIsDateOpen] = useState(false);

  const resolvedAccountId = accountId ?? defaultAccountId;

  const settlementAmount = useMemo(() => {
    if (quickMode === "remaining") return remaining;
    if (quickMode === "half") return roundMoney(totalAmount / 2);
    if (quickMode === "quarter") return roundMoney(totalAmount / 4);
    return Number(customAmount) || 0;
  }, [quickMode, remaining, totalAmount, customAmount]);

  const selectedAccount = accounts?.find((a) => a.id === resolvedAccountId);
  const accountBalance = selectedAccount ? Number(selectedAccount.balance || 0) : 0;

  const canSubmit =
    !isAdding &&
    settlementAmount > 0 &&
    settlementAmount <= remaining + 0.001 &&
    resolvedAccountId !== null;

  const handleSubmit = () => {
    if (!canSubmit || resolvedAccountId === null) return;
    const settlement: LoanSettlement = {
      id: uuidv4(),
      amount: String(settlementAmount),
      accountId: resolvedAccountId,
      date,
      note: note.trim() || null,
    };
    addSettlement(
      { transactionId: transaction.id!, settlement },
      {
        onSuccess: () => {
          setCustomAmount("");
          setNote("");
          setDate(new Date());
          setQuickMode("remaining");
        },
      }
    );
  };

  const loanTypeLabel = transaction.loanType === "borrow" ? "Borrowed" : "Lent";
  const counterpartyLabel =
    transaction.loanType === "borrow" ? "Lender" : "Borrower";

  const statusColor =
    transaction.loanStatus === "settled"
      ? "text-emerald-500"
      : transaction.loanStatus === "partial"
        ? "text-amber-500"
        : "text-rose-500";

  const statusBg =
    transaction.loanStatus === "settled"
      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600"
      : transaction.loanStatus === "partial"
        ? "bg-amber-400/10 border-amber-400/20 text-amber-600"
        : "bg-rose-500/10 border-rose-500/20 text-rose-600";

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[92dvh] flex-col rounded-t-3xl border border-border/60 bg-background">
        <DrawerHeader className="border-b border-border/40 px-5 pb-4 text-left">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-2xl",
                transaction.loanType === "borrow"
                  ? "bg-rose-500/10 text-rose-500"
                  : "bg-indigo-500/10 text-indigo-500"
              )}
            >
              {transaction.loanType === "borrow" ? (
                <TrendingDown className="h-5 w-5" />
              ) : (
                <TrendingUp className="h-5 w-5" />
              )}
            </div>
            <div>
              <DrawerTitle className="text-base font-semibold">
                Loan Settlement
              </DrawerTitle>
              <p className="text-xs text-muted-foreground">
                {loanTypeLabel}
                {transaction.counterparty ? ` · ${transaction.counterparty}` : ""}
              </p>
            </div>
          </div>
        </DrawerHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
          {/* Summary card */}
          <div className="rounded-2xl border border-border/60 bg-card/80 p-4">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Total</p>
                <p className="mt-1 text-base font-semibold">
                  {currency}{formatMoney(totalAmount)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Settled</p>
                <p className={cn("mt-1 text-base font-semibold", totalSettled > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                  {currency}{formatMoney(totalSettled)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Remaining</p>
                <p className={cn("mt-1 text-base font-semibold", remaining > 0 ? statusColor : "text-emerald-500")}>
                  {currency}{formatMoney(remaining)}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <ProgressBar percent={percent} status={transaction.loanStatus ?? "open"} />
              <div className="mt-1.5 flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{Math.round(percent)}% paid</p>
                <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase", statusBg)}>
                  {transaction.loanStatus ?? "open"}
                </span>
              </div>
            </div>
          </div>

          {transaction.loanStatus !== "settled" && remaining > 0 && (
            <>
              {/* Quick Amount Presets */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Record a Payment
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {(
                    [
                      { key: "remaining", label: "Full", sub: `${currency}${formatMoney(remaining)}` },
                      { key: "half", label: "50%", sub: `${currency}${formatMoney(roundMoney(totalAmount / 2))}` },
                      { key: "quarter", label: "25%", sub: `${currency}${formatMoney(roundMoney(totalAmount / 4))}` },
                      { key: "custom", label: "Custom", sub: "Enter" },
                    ] as { key: QuickAmount; label: string; sub: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.key}
                      type="button"
                      onClick={() => setQuickMode(opt.key)}
                      className={cn(
                        "flex flex-col items-center gap-0.5 rounded-2xl border px-2 py-2.5 text-xs font-semibold transition-all",
                        quickMode === opt.key
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border/60 bg-card/70 text-muted-foreground hover:border-primary/30"
                      )}
                    >
                      <span>{opt.label}</span>
                      <span className="text-[9px] font-normal opacity-70">{opt.sub}</span>
                    </button>
                  ))}
                </div>

                {quickMode === "custom" && (
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      type="number"
                      placeholder="0.00"
                      className="pl-8 text-lg font-semibold"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      min={0}
                      max={remaining}
                    />
                  </div>
                )}

                {quickMode !== "custom" && (
                  <div className="flex items-center gap-2 rounded-xl bg-primary/5 px-3 py-2">
                    <Wallet className="h-4 w-4 text-primary" />
                    <p className="text-sm font-semibold text-primary">
                      {currency}{formatMoney(settlementAmount)} will be applied
                    </p>
                  </div>
                )}
              </div>

              {/* Account + Date */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="settlement-account" className="text-xs">
                    Account to receive/deduct
                  </Label>
                  <Select
                    value={resolvedAccountId?.toString() ?? ""}
                    onValueChange={(v) => setAccountId(Number(v))}
                  >
                    <SelectTrigger id="settlement-account" className="rounded-xl">
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts ?? []).map((acc) => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          <span className="font-medium">{acc.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {currency}{formatMoney(Number(acc.balance || 0))}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Settlement Date</Label>
                  <Popover open={isDateOpen} onOpenChange={setIsDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between rounded-xl">
                        {format(date, "MMM d, yyyy")}
                        <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => {
                          if (d) setDate(d);
                          setIsDateOpen(false);
                        }}
                        disabled={(d) => d > new Date() || d < new Date("1900-01-01")}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <Label htmlFor="settlement-note" className="text-xs">Note (optional)</Label>
                <Input
                  id="settlement-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Cash handover, UPI, Bank transfer…"
                  className="rounded-xl"
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full rounded-2xl py-5 text-base font-semibold shadow-[0_8px_24px_-12px_rgba(244,63,94,0.5)]"
              >
                {isAdding
                  ? "Recording…"
                  : `Record ${currency}${formatMoney(settlementAmount)} Payment`}
              </Button>
            </>
          )}

          {transaction.loanStatus === "settled" && (
            <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
              <div>
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">Fully settled!</p>
                <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70">
                  This loan has been completely paid off.
                </p>
              </div>
            </div>
          )}

          {/* Settlement History */}
          {settlements.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Payment History ({settlements.length})
                </p>
                <p className="text-xs text-muted-foreground">
                  Total: {currency}{formatMoney(totalSettled)}
                </p>
              </div>
              <div className="space-y-2">
                {settlements.map((s) => {
                  const acc = accounts?.find((a) => a.id === s.accountId);
                  return (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-2xl border border-border/60 bg-card/80 px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                            {currency}{formatMoney(Number(s.amount))}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(s.date), "MMM d, yyyy")}
                            {acc && (
                              <>
                                <ChevronRight className="h-3 w-3 opacity-50" />
                                {acc.name}
                              </>
                            )}
                          </div>
                          {s.note && (
                            <p className="mt-0.5 text-xs text-muted-foreground/80">{s.note}</p>
                          )}
                        </div>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            type="button"
                            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                            aria-label="Delete payment"
                            disabled={isDeleting}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove this payment?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The {currency}{formatMoney(Number(s.amount))} payment will be reversed and account balances will be recalculated.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() =>
                                deleteSettlement({
                                  transactionId: transaction.id!,
                                  settlementId: s.id,
                                })
                              }
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
