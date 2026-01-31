import { useMemo, useState } from "react";
import { CalendarIcon, CreditCard, Landmark, Plus, Repeat, Wallet, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { useAccounts, useCreateAccount, useSettings, useTransferBetweenAccounts, useTransfers, useUpdateAccount } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const accountTypes = [
  { value: "Cash", label: "Cash", icon: Wallet },
  { value: "Bank", label: "Bank", icon: Landmark },
  { value: "Mobile", label: "Mobile Wallet", icon: Smartphone },
] as const;

type AccountForm = {
  id?: number;
  name: string;
  type: "Cash" | "Bank" | "Mobile";
  balance: string;
};

type TransferForm = {
  fromAccountId: number | null;
  toAccountId: number | null;
  amount: string;
  note: string;
  date: Date;
};

export default function AccountsPage() {
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const { mutate: createAccount, isPending: isCreating } = useCreateAccount();
  const { mutate: updateAccount, isPending: isUpdating } = useUpdateAccount();
  const { mutate: transferBetweenAccounts, isPending: isTransferring } = useTransferBetweenAccounts();
  const { data: transfers } = useTransfers();

  const [open, setOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [form, setForm] = useState<AccountForm>({ name: "", type: "Cash", balance: "0" });
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferForm, setTransferForm] = useState<TransferForm>({
    fromAccountId: null,
    toAccountId: null,
    amount: "",
    note: "",
    date: new Date(),
  });

  const totalBalance = useMemo(
    () => accounts?.reduce((sum, acc) => sum + Number(acc.balance || 0), 0) || 0,
    [accounts]
  );
  const currency = settings?.currencySymbol || "$";

  const fromAccount = useMemo(() => (accounts || []).find((acc) => acc.id === transferForm.fromAccountId) || null, [accounts, transferForm.fromAccountId]);
  const fromBalance = fromAccount ? Number(fromAccount.balance || 0) : 0;
  const transferAmount = Number(transferForm.amount || 0);
  const insufficientBalance = !!fromAccount && transferAmount > fromBalance;

  const accountNameMap = useMemo(() => {
    const map = new Map<number, string>();
    (accounts || []).forEach((acc) => {
      if (acc.id !== undefined) {
        map.set(acc.id, acc.name);
      }
    });
    return map;
  }, [accounts]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setForm({ name: "", type: "Cash", balance: "0" });
    }
  };

  const handleSubmit = () => {
    if (!form.name.trim()) return;
    if (form.id) {
      updateAccount({ id: form.id, data: { name: form.name, type: form.type, balance: form.balance } });
    } else {
      createAccount({ name: form.name, type: form.type, balance: form.balance });
    }
    handleOpenChange(false);
  };

  const resetTransferForm = () => {
    setTransferForm({
      fromAccountId: null,
      toAccountId: null,
      amount: "",
      note: "",
      date: new Date(),
    });
  };

  const handleTransfer = () => {
    if (!transferForm.fromAccountId || !transferForm.toAccountId) return;
    if (!transferForm.amount || Number(transferForm.amount) <= 0) return;
    transferBetweenAccounts({
      fromAccountId: transferForm.fromAccountId,
      toAccountId: transferForm.toAccountId,
      amount: transferForm.amount,
      note: transferForm.note || null,
      date: transferForm.date,
    }, {
      onSuccess: () => {
        setTransferOpen(false);
        resetTransferForm();
      }
    });
  };

  const handleEdit = (account: AccountForm) => {
    setForm(account);
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-border/60 bg-gradient-to-br from-primary/15 via-card/60 to-card/90 p-6">
        <p className="text-sm text-muted-foreground">Total balance</p>
        <h2 className="mt-2 text-3xl font-semibold">{currency}{totalBalance.toLocaleString()}</h2>
        <p className="mt-2 text-xs text-muted-foreground">Total from all accounts</p>
      </div>

      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold">Accounts</h3>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
          <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full whitespace-nowrap" disabled={(accounts || []).length < 2}>
                <Repeat className="mr-2 h-4 w-4" /> Transfer
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>Transfer between accounts</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>From account</Label>
                  <Select
                    value={transferForm.fromAccountId?.toString() || ""}
                    onValueChange={(value) => setTransferForm((prev) => ({ ...prev, fromAccountId: Number(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts || []).map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To account</Label>
                  <Select
                    value={transferForm.toAccountId?.toString() || ""}
                    onValueChange={(value) => setTransferForm((prev) => ({ ...prev, toAccountId: Number(value) }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {(accounts || []).map((account) => (
                        <SelectItem key={account.id} value={String(account.id)}>
                          {account.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    value={transferForm.amount}
                    onChange={(event) => setTransferForm((prev) => ({ ...prev, amount: event.target.value }))}
                  />
                  {insufficientBalance && (
                    <p className="text-xs text-rose-500">
                      Not enough balance in {fromAccount?.name || "selected account"}. Available {currency}{fromBalance.toLocaleString()}.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {format(transferForm.date, "PPP")}
                        <CalendarIcon className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={transferForm.date}
                        onSelect={(date) => date && setTransferForm((prev) => ({ ...prev, date }))}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Input
                    value={transferForm.note}
                    onChange={(event) => setTransferForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Optional note"
                  />
                </div>
                <Button
                  onClick={handleTransfer}
                  disabled={
                    isTransferring ||
                    !transferForm.fromAccountId ||
                    !transferForm.toAccountId ||
                    transferForm.fromAccountId === transferForm.toAccountId ||
                    !transferForm.amount ||
                    Number(transferForm.amount) <= 0 ||
                    insufficientBalance
                  }
                  className="w-full"
                >
                  Transfer
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-full whitespace-nowrap">
                Logs
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>Transfer logs</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                {(transfers || []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">No transfers yet.</p>
                ) : (
                  (transfers || []).map((item) => (
                    <div key={item.id} className="rounded-2xl border border-border/60 bg-card/80 p-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">
                          {(accountNameMap.get(item.fromAccountId) || "Unknown")} {" -> "} {(accountNameMap.get(item.toAccountId) || "Unknown")}
                        </span>
                        <span className="font-semibold">{currency}{Number(item.amount).toLocaleString()}</span>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {format(new Date(item.date), "MMM d, yyyy p")}
                      </div>
                      {item.note && (
                        <div className="mt-2 text-xs text-muted-foreground">{item.note}</div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
              <Button className="w-full rounded-full whitespace-nowrap sm:w-auto">
                <Plus className="mr-2 h-4 w-4" /> Add account
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-3xl">
              <DialogHeader>
                <DialogTitle>{form.id ? "Edit account" : "Add account"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Account name</Label>
                  <Input
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="e.g. Cash, Bank"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as AccountForm["type"] }))}>
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
                <div className="space-y-2">
                  <Label>Balance</Label>
                  <Input
                    type="number"
                    value={form.balance}
                    onChange={(event) => setForm((prev) => ({ ...prev, balance: event.target.value }))}
                  />
                </div>
                <Button onClick={handleSubmit} disabled={isCreating || isUpdating} className="w-full">
                  {form.id ? "Save changes" : "Create account"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-3">
        {(accounts || []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-card/60 p-6 text-center">
            <p className="text-sm text-muted-foreground">No accounts yet.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Add Cash, Bank, or Mobile Wallet to track balances.
            </p>
            <Button onClick={() => setOpen(true)} className="mt-4 rounded-full px-6">
              Add account
            </Button>
          </div>
        ) : (
          (accounts || []).map((account) => {
            const TypeIcon = accountTypes.find((type) => type.value === account.type)?.icon || CreditCard;
            return (
              <button
                key={account.id}
                onClick={() => handleEdit({ id: account.id, name: account.name, type: account.type, balance: account.balance })}
                className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-card/80 p-4 text-left"
              >
                <div className="flex items-center gap-3">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary")}>
                    <TypeIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">{account.name}</p>
                    <p className="text-xs text-muted-foreground">{account.type}</p>
                  </div>
                </div>
                <span className="font-semibold">{currency}{Number(account.balance || 0).toLocaleString()}</span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

