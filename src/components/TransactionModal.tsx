import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, CreditCard, Plus, Trash2, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { insertTransactionSchema, type Transaction } from "@shared/schema";
import { useAccounts, useCategories, useCreateTransaction, useDeleteTransaction, useSettings, useUpdateTransaction } from "@/hooks/use-finance";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { getCategoryIcon } from "@/lib/category-icons";
import { formatMoney } from "@/lib/money";

const formSchema = insertTransactionSchema.extend({
  amount: z.string()
    .min(1, "Please enter an amount")
    .transform((val) => val === "" ? "0" : val)
    .refine((val) => {
      const num = parseFloat(val);
      return num > 0;
    }, "Amount must be greater than 0"),
  categoryId: z.number().min(1, "Please select a category"),
});

type FormValues = z.infer<typeof formSchema>;

type TxType = "expense" | "income" | "loan";

const typeTabs: { id: TxType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "expense", label: "Expense", icon: TrendingDown },
  { id: "income", label: "Income", icon: TrendingUp },
  { id: "loan", label: "Loan", icon: CreditCard },
];

const typeStyles: Record<TxType, { active: string; icon: string }> = {
  expense: {
    active: "border-rose-500/40 bg-rose-500 text-white shadow-[0_8px_24px_-12px_rgba(239,68,68,0.7)]",
    icon: "text-rose-500",
  },
  income: {
    active: "border-emerald-500/40 bg-emerald-500 text-white shadow-[0_8px_24px_-12px_rgba(34,197,94,0.7)]",
    icon: "text-emerald-500",
  },
  loan: {
    active: "border-indigo-500/40 bg-indigo-500 text-white shadow-[0_8px_24px_-12px_rgba(99,102,241,0.7)]",
    icon: "text-indigo-500",
  },
};

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

export function TransactionModal({
  open,
  onOpenChange,
  transaction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: Transaction;
}) {
  const { mutate: createTransaction, isPending: isCreating } = useCreateTransaction();
  const { mutate: updateTransaction, isPending: isUpdating } = useUpdateTransaction();
  const { mutate: deleteTransaction, isPending: isDeleting } = useDeleteTransaction();
  const { data: categories } = useCategories();
  const { data: accounts } = useAccounts();
  const { data: settings } = useSettings();
  const [activeType, setActiveType] = useState<TxType>("expense");
  const [isDateOpen, setIsDateOpen] = useState(false);
  const [isSettlementDateOpen, setIsSettlementDateOpen] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  const parseTags = (value: string) => value
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  const currency = settings?.currencySymbol || "৳";
  const cashAccount = accounts?.find((acc) => acc.name === "Cash");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      categoryId: 0,
      paymentMethod: "Cash",
      accountId: cashAccount?.id ?? null,
      loanSettlementAccountId: null,
      settlementDate: null,
      counterparty: "",
      note: "",
      date: new Date(),
      type: "expense",
      loanType: null,
      loanStatus: "open",
      tags: [],
    },
  });

  useEffect(() => {
    if (!open) return;

    if (transaction && transaction.id) {
      setActiveType(transaction.type ?? "expense");
      form.reset({
        amount: transaction.amount?.toString() ?? "",
        categoryId: transaction.categoryId ?? 0,
        paymentMethod: transaction.paymentMethod ?? "Cash",
        accountId: transaction.accountId ?? cashAccount?.id ?? null,
        loanSettlementAccountId: transaction.loanSettlementAccountId ?? (transaction.loanStatus === "settled" ? transaction.accountId ?? null : null),
        settlementDate: transaction.settlementDate ? new Date(transaction.settlementDate) : null,
        counterparty: transaction.counterparty ?? "",
        note: transaction.note ?? "",
        date: transaction.date ? new Date(transaction.date) : new Date(),
        type: transaction.type ?? "expense",
        loanType: transaction.loanType ?? null,
        loanStatus: transaction.loanStatus ?? (transaction.type === "loan" ? "open" : null),
        tags: transaction.tags ?? [],
      });
      setTagsInput((transaction.tags || []).join(", "));
      return;
    }

    setActiveType("expense");
    form.reset({
      amount: "",
      categoryId: 0,
      paymentMethod: "Cash",
      accountId: cashAccount?.id ?? null,
      loanSettlementAccountId: null,
      settlementDate: null,
      counterparty: "",
      note: "",
      date: new Date(),
      type: "expense",
      loanType: null,
      loanStatus: "open",
      tags: [],
    });
    setTagsInput("");
  }, [open, cashAccount?.id, form, transaction]);

  const onSubmit = (values: FormValues) => {
    const tags = parseTags(tagsInput);
    if (transaction?.id) {
      updateTransaction(
        { id: transaction.id, data: { ...values, amount: values.amount.toString(), tags } },
        { onSuccess: () => onOpenChange(false) }
      );
      return;
    }

    createTransaction(
      { ...values, amount: values.amount.toString(), tags },
      { onSuccess: () => onOpenChange(false) }
    );
  };

  const filteredCategories = useMemo(() => {
    const list = categories || [];
    return list.filter((cat) => cat.type === activeType);
  }, [categories, activeType]);

  const handleTypeChange = (type: TxType) => {
    setActiveType(type);
    form.setValue("type", type);
    if (type !== "loan") {
      form.setValue("loanType", null);
      form.setValue("loanStatus", null);
      form.setValue("loanSettlementAccountId", null);
      form.setValue("settlementDate", null);
    } else {
      form.setValue("loanStatus", "open");
    }
    form.setValue("categoryId", 0);
  };

  const handleQuickAmount = (amount: number) => {
    const current = parseFloat(form.getValues("amount") || "0");
    form.setValue("amount", String(current + amount), { shouldValidate: true });
  };

  const watchAmount = form.watch("amount");
  const watchCategory = form.watch("categoryId");
  const watchLoanStatus = form.watch("loanStatus");
  const watchAccountId = form.watch("accountId");

  const selectedAccount = accounts?.find((a) => a.id === watchAccountId);
  const isEditMode = !!transaction?.id;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[92dvh] flex-col rounded-t-3xl border border-border/60 bg-background">
        <DrawerHeader className="border-b border-border/40 pb-3 text-left">
          <DrawerTitle className="text-base font-semibold">
            {isEditMode ? "Edit transaction" : "New transaction"}
          </DrawerTitle>
        </DrawerHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-3 pb-[calc(env(safe-area-inset-bottom)+1.5rem)]"
          >
            {/* Type Tabs */}
            <div className="flex gap-2" role="tablist" aria-label="Transaction type">
              {typeTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeType === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => handleTypeChange(tab.id)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full border px-3 py-2.5 text-sm font-semibold transition-all",
                      isActive
                        ? typeStyles[tab.id].active
                        : "border-border/60 bg-card/70 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Amount */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      {...field}
                      id="tx-amount"
                      type="number"
                      placeholder="0.00"
                      inputMode="decimal"
                      className="pl-8 text-xl font-bold tracking-tight"
                    />
                  </div>
                  {/* Quick amount chips */}
                  <div className="flex gap-2 pt-1">
                    {QUICK_AMOUNTS.map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleQuickAmount(amt)}
                        aria-label={`Add ${currency}${amt}`}
                        className="flex items-center gap-0.5 rounded-full border border-border/60 bg-card/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition hover:border-primary/30 hover:text-foreground"
                      >
                        <Plus className="h-2.5 w-2.5" />
                        {formatMoney(amt)}
                      </button>
                    ))}
                    {parseFloat(watchAmount || "0") > 0 && (
                      <button
                        type="button"
                        onClick={() => form.setValue("amount", "", { shouldValidate: true })}
                        className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-500 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950 dark:hover:bg-rose-900"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <div
                    className="grid grid-cols-4 gap-2"
                    role="radiogroup"
                    aria-label="Transaction category"
                  >
                    {filteredCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        role="radio"
                        aria-checked={field.value === cat.id}
                        onClick={() => {
                          field.onChange(cat.id);
                          if (activeType === "loan") {
                            form.setValue("loanType", cat.name.toLowerCase().includes("borrow") ? "borrow" : "lend");
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-2.5 text-xs font-medium transition-all",
                          field.value === cat.id
                            ? activeType === "expense"
                              ? "border-rose-500/40 bg-rose-500/10 text-rose-600 dark:text-rose-400"
                              : activeType === "income"
                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : "border-indigo-500/40 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                            : "border-border/60 bg-card/70 text-muted-foreground hover:border-primary/20 hover:text-foreground"
                        )}
                      >
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{ backgroundColor: field.value === cat.id ? `${cat.color}22` : undefined }}
                        >
                          {(() => {
                            const entry = getCategoryIcon(cat.name);
                            const Icon = entry.icon;
                            return <Icon className={cn("h-4 w-4", entry.className)} />;
                          })()}
                        </div>
                        <span className="truncate">{cat.name}</span>
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Account + Date */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{activeType === "loan" ? "Source account" : "Account"}</FormLabel>
                    <Select value={field.value?.toString() || ""} onValueChange={(value) => field.onChange(Number(value))}>
                      <FormControl>
                        <SelectTrigger className="rounded-xl">
                          <SelectValue placeholder="Select account" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(accounts || []).map((account) => (
                          <SelectItem key={account.id} value={String(account.id)}>
                            <span className="font-medium">{account.name}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              {currency}{formatMoney(Number(account.balance || 0))}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedAccount && (
                      <p className="text-xs text-muted-foreground">
                        Balance: {currency}{formatMoney(Number(selectedAccount.balance || 0))}
                      </p>
                    )}
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <Popover onOpenChange={(value) => setIsDateOpen(value)} open={isDateOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-between rounded-xl">
                            {field.value ? format(field.value, "MMM d, yyyy") : "Pick a date"}
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={(date) => {
                            field.onChange(date);
                            setIsDateOpen(false);
                          }}
                          disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </FormItem>
                )}
              />
            </div>

            {/* Loan-specific fields */}
            {activeType === "loan" && (
              <div className="space-y-3 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500">
                  <Zap className="h-3.5 w-3.5" />
                  Loan details
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="counterparty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{form.watch("loanType") === "borrow" ? "Lender" : "Borrower"}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value || ""} placeholder="Person or organization" className="rounded-xl" />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="loanStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value || "open"}
                          onValueChange={(value) => {
                            field.onChange(value);
                            if (value === "settled") {
                              const current = form.getValues("loanSettlementAccountId");
                              if (!current) {
                                form.setValue("loanSettlementAccountId", form.getValues("accountId") ?? null);
                              }
                              const currentSettlementDate = form.getValues("settlementDate");
                              if (!currentSettlementDate) {
                                form.setValue("settlementDate", new Date());
                              }
                            } else {
                              form.setValue("loanSettlementAccountId", null);
                              form.setValue("settlementDate", null);
                            }
                          }}
                        >
                          <FormControl>
                            <SelectTrigger className="rounded-xl">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="open">
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-rose-500" />
                                Open
                              </span>
                            </SelectItem>
                            <SelectItem value="settled">
                              <span className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                                Settled
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                  {watchLoanStatus === "settled" && (
                    <>
                      <FormField
                        control={form.control}
                        name="loanSettlementAccountId"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Settlement account</FormLabel>
                            <Select value={field.value?.toString() || ""} onValueChange={(value) => field.onChange(Number(value))}>
                              <FormControl>
                                <SelectTrigger className="rounded-xl">
                                  <SelectValue placeholder="Select account" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {(accounts || []).map((account) => (
                                  <SelectItem key={account.id} value={String(account.id)}>
                                    {account.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="settlementDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Settlement date</FormLabel>
                            <Popover onOpenChange={(value) => setIsSettlementDateOpen(value)} open={isSettlementDateOpen}>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button variant="outline" className="w-full justify-between rounded-xl">
                                    {field.value ? format(field.value, "MMM d, yyyy") : "Pick a date"}
                                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value ?? undefined}
                                  onSelect={(date) => {
                                    field.onChange(date ?? null);
                                    setIsSettlementDateOpen(false);
                                  }}
                                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                          </FormItem>
                        )}
                      />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Note */}
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Add a description…" className="rounded-xl" />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* Tags */}
            <FormItem>
              <FormLabel>Tags</FormLabel>
              <FormControl>
                <Input
                  id="tx-tags"
                  value={tagsInput}
                  onChange={(event) => {
                    const next = event.target.value;
                    setTagsInput(next);
                    form.setValue("tags", parseTags(next));
                  }}
                  placeholder="e.g. groceries, family, trip"
                  className="rounded-xl"
                />
              </FormControl>
              <FormMessage />
            </FormItem>

            {/* Actions */}
            {isEditMode ? (
              <div className="grid grid-cols-2 gap-3">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full rounded-2xl border-destructive/40 text-destructive"
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete transaction?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. The transaction will be permanently removed and balances will be reversed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => {
                          if (!transaction?.id) return;
                          deleteTransaction(transaction.id, {
                            onSuccess: () => onOpenChange(false),
                          });
                        }}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button
                  type="submit"
                  className="w-full rounded-2xl"
                  disabled={isUpdating || !watchAmount || parseFloat(watchAmount || "0") <= 0 || !watchCategory}
                >
                  {isUpdating ? "Saving…" : "Update"}
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                className={cn(
                  "w-full rounded-2xl py-5 text-base font-semibold",
                  activeType === "expense"
                    ? "bg-rose-500 text-white hover:bg-rose-600 shadow-[0_8px_24px_-12px_rgba(239,68,68,0.6)]"
                    : activeType === "income"
                      ? "bg-emerald-500 text-white hover:bg-emerald-600 shadow-[0_8px_24px_-12px_rgba(34,197,94,0.6)]"
                      : "bg-indigo-500 text-white hover:bg-indigo-600 shadow-[0_8px_24px_-12px_rgba(99,102,241,0.6)]"
                )}
                disabled={isCreating || !watchAmount || parseFloat(watchAmount || "0") <= 0 || !watchCategory}
              >
                {isCreating ? "Saving…" : `Save ${activeType === "expense" ? "Expense" : activeType === "income" ? "Income" : "Loan"}`}
              </Button>
            )}
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
}
