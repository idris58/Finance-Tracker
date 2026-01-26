import { useMemo, useState } from "react";
import { ArrowRight, Wallet } from "lucide-react";
import { useAccounts, useCreateAccount, useSettings, useUpdateAccount, useUpdateSettings } from "@/hooks/use-finance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const currencies = [
  { symbol: "$", label: "USD ($)" },
  { symbol: "€", label: "EUR (€)" },
  { symbol: "£", label: "GBP (£)" },
  { symbol: "৳", label: "BDT (৳)" },
  { symbol: "₹", label: "INR (₹)" },
];

export default function WelcomePage() {
  const { data: settings } = useSettings();
  const { data: accounts } = useAccounts();
  const updateSettings = useUpdateSettings();
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();

  const [step, setStep] = useState(1);
  const [currency, setCurrency] = useState(settings?.currencySymbol || "$" );
  const [balance, setBalance] = useState("0");

  const cashAccount = useMemo(() => accounts?.find((acc) => acc.name === "Cash"), [accounts]);

  const handleFinish = () => {
    if (cashAccount) {
      updateAccount.mutate({ id: cashAccount.id!, data: { balance: balance || "0" } });
    } else {
      createAccount.mutate({ name: "Cash", type: "Cash", balance: balance || "0" });
    }

    updateSettings.mutate({
      currencySymbol: currency,
      isSetupComplete: true,
    });
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-10 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Wallet className="h-6 w-6" />
      </div>
      <h1 className="mt-6 text-2xl font-semibold">Welcome to Finance Tracker</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Let's set up your account so you can start tracking in seconds.
      </p>

      {step === 1 && (
        <div className="mt-8 space-y-4 text-left">
          <div className="space-y-2">
            <label className="text-sm font-medium">Choose your currency</label>
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="rounded-2xl border-border/60 bg-card/70">
                <SelectValue placeholder="Select currency" />
              </SelectTrigger>
              <SelectContent>
                {currencies.map((item) => (
                  <SelectItem key={item.symbol} value={item.symbol}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button onClick={() => setStep(2)} className="w-full rounded-2xl">
            Continue <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="mt-8 space-y-4 text-left">
          <div className="space-y-2">
            <label className="text-sm font-medium">Starting balance</label>
            <Input
              type="number"
              value={balance}
              onChange={(event) => setBalance(event.target.value)}
              className="rounded-2xl border-border/60 bg-card/70"
              placeholder="0"
            />
            <p className="text-xs text-muted-foreground">
              You can edit this or add more accounts later in the Accounts tab.
            </p>
          </div>

          <Button onClick={handleFinish} className="w-full rounded-2xl">
            Finish setup
          </Button>
        </div>
      )}
    </div>
  );
}


