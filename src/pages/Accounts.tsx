import { useMemo, useState } from "react";
import { CreditCard, Landmark, Plus } from "lucide-react";
import { useAccounts, useCreateAccount, useSettings, useUpdateAccount } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const accountTypes = [
  { value: "Cash", label: "Cash", icon: CreditCard },
  { value: "Bank", label: "Bank", icon: Landmark },
  { value: "Mobile", label: "Mobile Wallet", icon: CreditCard },
] as const;

type AccountForm = {
  id?: number;
  name: string;
  type: "Cash" | "Bank" | "Mobile";
  balance: string;
};

export default function AccountsPage() {
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const { mutate: createAccount, isPending: isCreating } = useCreateAccount();
  const { mutate: updateAccount, isPending: isUpdating } = useUpdateAccount();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<AccountForm>({ name: "", type: "Cash", balance: "0" });

  const totalBalance = useMemo(
    () => accounts?.reduce((sum, acc) => sum + Number(acc.balance || 0), 0) || 0,
    [accounts]
  );
  const currency = settings?.currencySymbol || "$";

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

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Accounts</h3>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button className="rounded-full">
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

      <div className="space-y-3">
        {(accounts || []).map((account) => {
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
        })}
      </div>
    </div>
  );
}

