import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import { useCreateTransaction, useCategories } from "@/hooks/use-finance";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Check, Utensils, Bus, ShoppingBag, Zap, Wallet, CreditCard, Smartphone, Plus, CalendarIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CategoryManagementModal } from "./CategoryManagementModal";

// Add safe parsing for the form
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

export function TransactionModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateTransaction();
  const { data: categories } = useCategories();
  const [showCategoryModal, setShowCategoryModal] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      categoryId: 0,
      paymentMethod: "Cash",
      note: "",
      isRecurring: false,
      date: new Date(),
    },
  });

  // Reset form when modal opens
  useEffect(() => {
    if (open) {
      form.reset({
        amount: "",
        categoryId: 0,
        paymentMethod: "Cash",
        note: "",
        isRecurring: false,
        date: new Date(),
      });
    }
  }, [open, form]);

  const onSubmit = (values: FormValues) => {
    mutate({
      ...values,
      amount: values.amount.toString(), // Ensure string for schema
    }, {
      onSuccess: () => onOpenChange(false),
    });
  };

  const paymentMethods = [
    { id: "Cash", icon: Wallet },
    { id: "Bank", icon: CreditCard },
    { id: "Bkash", icon: Smartphone },
    { id: "Nagad", icon: Smartphone },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 sm:max-w-md w-[95vw] max-w-[95vw] sm:w-full max-h-[85vh] flex flex-col rounded-2xl p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-lg sm:text-xl">Add Transaction</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 mt-2 overflow-y-auto flex-1">
            {/* Big Amount Input */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="text-center">
                  <div className="relative inline-block w-full">
                    <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg sm:text-xl font-light">৳</span>
                    <Input 
                      {...field}
                      type="number" 
                      placeholder="0.00"
                      className="text-xl sm:text-3xl font-bold text-center h-14 sm:h-16 bg-background/50 border-2 border-primary/20 focus-visible:border-primary focus-visible:ring-0 rounded-xl placeholder:text-muted-foreground/30 font-display pl-8 sm:pl-12 text-sm"
                      autoFocus
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Category Grid */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground ml-1 text-xs sm:text-sm">Category</FormLabel>
                  <div className="grid grid-cols-4 gap-1.5">
                    {categories?.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => field.onChange(cat.id)}
                        className={cn(
                          "flex flex-col items-center gap-0.5 p-1 rounded-lg transition-all border border-transparent hover:bg-white/5",
                          field.value === cat.id ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(57,255,20,0.15)]" : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-background flex items-center justify-center">
                          {/* Generic fallback icon logic - ideally categories would store icon name */}
                          {cat.name.includes("Food") ? <Utensils className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> :
                           cat.name.includes("Transport") ? <Bus className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> :
                           cat.name.includes("Shop") ? <ShoppingBag className="w-2.5 h-2.5 sm:w-3 sm:h-3" /> :
                           <Zap className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                        </div>
                        <span className="text-[8px] sm:text-[9px] font-medium truncate w-full text-center">{cat.name}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="flex flex-col items-center justify-center gap-0.5 p-1 rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-white/5 hover:border-muted-foreground transition-colors"
                      onClick={() => setShowCategoryModal(true)}
                    >
                       <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                       <span className="text-[8px] sm:text-[9px]">New</span>
                    </button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Date Picker */}
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel className="text-muted-foreground ml-1 text-xs sm:text-sm">Date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal bg-background/50 border-white/10 text-xs sm:text-sm h-9",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-3.5 w-3.5 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-card border-white/10 sm:translate-x-0" align="start" side="bottom" sideOffset={4}>
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) =>
                          date > new Date() || date < new Date("1900-01-01")
                        }
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Payment Method */}
            <FormField
              control={form.control}
              name="paymentMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-muted-foreground ml-1 text-xs sm:text-sm">Payment Method</FormLabel>
                  <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => field.onChange(method.id)}
                        className={cn(
                          "flex items-center gap-1 px-2.5 sm:px-3 py-1 rounded-full border transition-all text-[11px] sm:text-xs font-medium whitespace-nowrap",
                          field.value === method.id 
                            ? "bg-secondary/10 border-secondary text-secondary shadow-[0_0_10px_rgba(255,215,0,0.2)]" 
                            : "bg-muted/30 border-white/5 text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <method.icon className="w-3 h-3" />
                        {method.id}
                        {field.value === method.id && <Check className="w-2.5 h-2.5 ml-0.5" />}
                      </button>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                    <FormItem>
                        <FormControl>
                            <Input {...field} value={field.value || ""} placeholder="Add a note (optional)" className="bg-muted/30 border-white/5" />
                        </FormControl>
                    </FormItem>
                )}
            />

            <Button 
              type="submit" 
              className="w-full h-11 sm:h-12 text-base sm:text-lg font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all neon-glow"
              disabled={isPending || !form.watch("amount") || parseFloat(form.watch("amount") || "0") <= 0 || !form.watch("categoryId")}
            >
              {isPending ? "Saving..." : "Save Transaction"}
            </Button>
          </form>
        </Form>
      </DialogContent>

      <CategoryManagementModal 
        open={showCategoryModal} 
        onOpenChange={setShowCategoryModal}
      />
    </Dialog>
  );
}
