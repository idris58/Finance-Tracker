import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { CalendarIcon, Trash2 } from "lucide-react";
import type { Account, Transfer } from "@shared/schema";
import { useTransferBetweenAccounts, useUpdateTransfer, useDeleteTransfer } from "@/hooks/use-finance";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatMoney } from "@/lib/money";

type TransferDraft = {
  fromAccountId: number | null;
  toAccountId: number | null;
  amount: string;
  note: string;
  date: Date;
};

export function TransferEditorFields({
  transfer,
  accounts,
  currency,
  defaultFromAccountId,
  onSaved,
}: {
  transfer?: Transfer;
  accounts: Account[];
  currency: string;
  defaultFromAccountId?: number;
  onSaved: () => void;
}) {
  const createTransfer = useTransferBetweenAccounts();
  const updateTransfer = useUpdateTransfer();
  const deleteTransfer = useDeleteTransfer();
  const defaultFrom = defaultFromAccountId && accounts.some((account) => account.id === defaultFromAccountId)
    ? defaultFromAccountId
    : accounts[0]?.id ?? null;
  const [draft, setDraft] = useState<TransferDraft>(() => ({
    fromAccountId: transfer?.fromAccountId ?? defaultFrom,
    toAccountId: transfer?.toAccountId ?? accounts.find((account) => account.id !== (transfer?.fromAccountId ?? defaultFrom))?.id ?? null,
    amount: transfer?.amount ?? "",
    note: transfer?.note ?? "",
    date: transfer ? new Date(transfer.date) : new Date(),
  }));

  useEffect(() => {
    if (transfer) return;
    setDraft((current) => {
      if (current.fromAccountId !== null || accounts.length === 0) return current;
      const fromAccountId = defaultFrom;
      return {
        ...current,
        fromAccountId,
        toAccountId: accounts.find((account) => account.id !== fromAccountId)?.id ?? null,
      };
    });
  }, [accounts, defaultFrom, transfer]);

  const fromAccount = accounts.find((account) => account.id === draft.fromAccountId);
  const availableBalance = useMemo(() => {
    if (!fromAccount) return 0;
    const originalAmount = transfer && transfer.fromAccountId === fromAccount.id ? Number(transfer.amount) : 0;
    return Number(fromAccount.balance || 0) + originalAmount;
  }, [fromAccount, transfer]);
  const parsedAmount = Number(draft.amount);
  const amountValid = /^\d+(?:\.\d{1,2})?$/.test(draft.amount) && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const insufficientBalance = amountValid && parsedAmount > availableBalance;
  const sameAccount = draft.fromAccountId !== null && draft.fromAccountId === draft.toAccountId;
  const isPending = createTransfer.isPending || updateTransfer.isPending || deleteTransfer.isPending;
  const canSave = accounts.length >= 2 && !!draft.fromAccountId && !!draft.toAccountId && !sameAccount && amountValid && !insufficientBalance && !isPending;

  const updateDraft = (patch: Partial<TransferDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = () => {
    if (!canSave || !draft.fromAccountId || !draft.toAccountId) return;
    const data = {
      fromAccountId: draft.fromAccountId,
      toAccountId: draft.toAccountId,
      amount: draft.amount,
      note: draft.note.trim() || null,
      date: draft.date,
    };
    const callbacks = { onSuccess: onSaved };
    if (transfer?.id !== undefined) {
      updateTransfer.mutate({ id: transfer.id, data }, callbacks);
    } else {
      createTransfer.mutate(data, callbacks);
    }
  };

  return (
    <div className="space-y-4">
      {accounts.length < 2 && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Add a second account before making a transfer.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="transfer-from-account">From account</Label>
          <Select
            value={draft.fromAccountId?.toString() ?? ""}
            onValueChange={(value) => {
              const fromAccountId = Number(value);
              updateDraft({ fromAccountId, toAccountId: draft.toAccountId === fromAccountId ? null : draft.toAccountId });
            }}
          >
            <SelectTrigger id="transfer-from-account" className="min-h-11 rounded-xl">
              <SelectValue placeholder="Choose source" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="transfer-to-account">To account</Label>
          <Select value={draft.toAccountId?.toString() ?? ""} onValueChange={(value) => updateDraft({ toAccountId: Number(value) })}>
            <SelectTrigger id="transfer-to-account" className="min-h-11 rounded-xl">
              <SelectValue placeholder="Choose destination" />
            </SelectTrigger>
            <SelectContent>
              {accounts.filter((account) => account.id !== draft.fromAccountId).map((account) => (
                <SelectItem key={account.id} value={String(account.id)}>{account.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="transfer-amount">Amount</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{currency}</span>
          <Input
            id="transfer-amount"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0.01"
            value={draft.amount}
            onChange={(event) => {
              const value = event.target.value;
              if (/^\d*(?:\.\d{0,2})?$/.test(value)) updateDraft({ amount: value });
            }}
            placeholder="0.00"
            className="min-h-12 rounded-xl pl-10 text-lg font-semibold"
          />
        </div>
        {insufficientBalance && (
          <p className="text-xs text-destructive" role="alert">
            Not enough balance in {fromAccount?.name ?? "the source account"}. Available {currency}{formatMoney(availableBalance)}.
          </p>
        )}
        {sameAccount && <p className="text-xs text-destructive" role="alert">Choose two different accounts.</p>}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button type="button" variant="outline" className="min-h-11 w-full justify-between rounded-xl font-normal">
                {format(draft.date, "PPP")}
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={draft.date}
                onSelect={(date) => date && updateDraft({ date })}
                disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label htmlFor="transfer-note">Note <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input
            id="transfer-note"
            value={draft.note}
            onChange={(event) => updateDraft({ note: event.target.value })}
            placeholder="Add a note"
            className="min-h-11 rounded-xl"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
        {transfer?.id !== undefined && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="min-h-11 rounded-xl border-destructive/40 text-destructive" disabled={isPending}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete transfer
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="max-w-[calc(100vw-2rem)] rounded-3xl sm:max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this transfer?</AlertDialogTitle>
                <AlertDialogDescription>The account balance change will be reversed and this transfer removed.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={() => deleteTransfer.mutate(transfer.id!, { onSuccess: onSaved })}
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
        <Button type="button" onClick={save} disabled={!canSave} className={`min-h-11 w-full rounded-xl ${transfer?.id !== undefined ? "sm:col-start-2" : "sm:col-span-2"}`}>
          {createTransfer.isPending || updateTransfer.isPending ? "Saving…" : transfer?.id !== undefined ? "Save changes" : "Transfer"}
        </Button>
      </div>
    </div>
  );
}
