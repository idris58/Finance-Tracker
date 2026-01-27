import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
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

const typeTabs: { id: TxType; label: string }[] = [
  { id: "expense", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "loan", label: "Loan" },
];


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

  const currency = settings?.currencySymbol || "$";
  const cashAccount = accounts?.find((acc) => acc.name === "Cash");

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      categoryId: 0,
      paymentMethod: "Cash",
      accountId: cashAccount?.id ?? null,
      loanSettlementAccountId: null,
      counterparty: "",
      note: "",
      isRecurring: false,
      date: new Date(),
      type: "expense",
      loanType: null,
      loanStatus: "open",
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
        counterparty: transaction.counterparty ?? "",
        note: transaction.note ?? "",
        isRecurring: transaction.isRecurring ?? false,
        date: transaction.date ? new Date(transaction.date) : new Date(),
        type: transaction.type ?? "expense",
        loanType: transaction.loanType ?? null,
        loanStatus: transaction.loanStatus ?? (transaction.type === "loan" ? "open" : null),
      });
      return;
    }

    setActiveType("expense");
    form.reset({
      amount: "",
      categoryId: 0,
      paymentMethod: "Cash",
      accountId: cashAccount?.id ?? null,
      loanSettlementAccountId: null,
      counterparty: "",
      note: "",
      isRecurring: false,
      date: new Date(),
      type: "expense",
      loanType: null,
      loanStatus: "open",
    });
  }, [open, cashAccount?.id, form, transaction]);

  const onSubmit = (values: FormValues) => {
    if (transaction?.id) {
      updateTransaction(
        { id: transaction.id, data: { ...values, amount: values.amount.toString() } },
        { onSuccess: () => onOpenChange(false) }
      );
      return;
    }

    createTransaction(
      { ...values, amount: values.amount.toString() },
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
    } else {
      form.setValue("loanStatus", "open");
    }
    form.setValue("categoryId", 0);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="flex h-[90dvh] flex-col rounded-t-3xl border border-border/60 bg-background">
        <DrawerHeader className="text-left">
          <DrawerTitle className="text-lg">
            {transaction?.id ? "Edit transaction" : "New transaction"}
          </DrawerTitle>
        </DrawerHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex-1 space-y-4 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+7rem)]"
          >
            <div className="flex gap-3">
              {typeTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTypeChange(tab.id)}
                  className={cn(
                    "flex-1 rounded-full border px-4 py-2 text-sm font-semibold",
                    activeType === tab.id
                      ? "border-primary/40 bg-primary text-primary-foreground"
                      : "border-border/60 bg-card/70 text-muted-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount</FormLabel>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                      {currency}
                    </span>
                    <Input
                      {...field}
                      type="number"
                      placeholder="0.00"
                      className="pl-8 text-lg font-semibold"
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <div className="grid grid-cols-4 gap-3">
                    {filteredCategories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          field.onChange(cat.id);
                          if (activeType === "loan") {
                            form.setValue("loanType", cat.name.toLowerCase().includes("borrow") ? "borrow" : "lend");
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-2xl border px-2 py-2 text-xs font-medium",
                          field.value === cat.id
                            ? "border-primary/50 bg-primary/10 text-primary"
                            : "border-border/60 bg-card/70 text-muted-foreground"
                        )}
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-background">
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

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="accountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{activeType === "loan" ? "Source account" : "Account"}</FormLabel>
                    <Select value={field.value?.toString() || ""} onValueChange={(value) => field.onChange(Number(value))}>
                      <FormControl>
                        <SelectTrigger>
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
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <Popover onOpenChange={(value) => setIsDateOpen(value)} open={isDateOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-between">
                            {field.value ? format(field.value, "PPP") : "Pick a date"}
                            <CalendarIcon className="h-4 w-4" />
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

            {activeType === "loan" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="counterparty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{form.watch("loanType") === "borrow" ? "Lender" : "Borrower"}</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value || ""} placeholder="Add a description" />
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
                          } else {
                            form.setValue("loanSettlementAccountId", null);
                          }
                        }}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="open">Open</SelectItem>
                          <SelectItem value="settled">Settled</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                {form.watch("loanStatus") === "settled" && (
                  <FormField
                    control={form.control}
                    name="loanSettlementAccountId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Settlement account</FormLabel>
                        <Select value={field.value?.toString() || ""} onValueChange={(value) => field.onChange(Number(value))}>
                          <FormControl>
                            <SelectTrigger>
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
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Note</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} placeholder="Add a description" />
                  </FormControl>
                </FormItem>
              )}
            />

            {transaction?.id ? (
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
                        This action cannot be undone. The transaction will be permanently removed.
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
                  disabled={isUpdating || !form.watch("amount") || parseFloat(form.watch("amount") || "0") <= 0 || !form.watch("categoryId")}
                >
                  {isUpdating ? "Saving..." : "Update"}
                </Button>
              </div>
            ) : (
              <Button
                type="submit"
                className="w-full rounded-2xl"
                disabled={isCreating || !form.watch("amount") || parseFloat(form.watch("amount") || "0") <= 0 || !form.watch("categoryId")}
              >
                {isCreating ? "Saving..." : "Save"}
              </Button>
            )}
          </form>
        </Form>
      </DrawerContent>
    </Drawer>
  );
}


