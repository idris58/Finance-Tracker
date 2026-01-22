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
import { Check, Utensils, Bus, ShoppingBag, Zap, Wallet, CreditCard, Smartphone } from "lucide-react";
import { useEffect } from "react";

// Add safe parsing for the form
const formSchema = insertTransactionSchema.extend({
  amount: z.string().transform((val) => val === "" ? "0" : val), // Handle empty string as 0 temporarily
  categoryId: z.number().min(1, "Please select a category"),
});

type FormValues = z.infer<typeof formSchema>;

export function TransactionModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { mutate, isPending } = useCreateTransaction();
  const { data: categories } = useCategories();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: "",
      categoryId: 0,
      paymentMethod: "Cash",
      note: "",
      isRecurring: false,
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
      <DialogContent className="bg-card border-white/10 sm:max-w-md w-[95vw] rounded-2xl p-6">
        <DialogHeader>
          <DialogTitle className="text-center font-display text-2xl">Add Transaction</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
            {/* Big Amount Input */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className="text-center">
                  <div className="relative inline-block w-full">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-2xl font-light">৳</span>
                    <Input 
                      {...field}
                      type="number" 
                      placeholder="0.00"
                      className="text-4xl font-bold text-center h-20 bg-background/50 border-2 border-primary/20 focus-visible:border-primary focus-visible:ring-0 rounded-2xl placeholder:text-muted-foreground/30 font-display"
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
                  <FormLabel className="text-muted-foreground ml-1">Category</FormLabel>
                  <div className="grid grid-cols-4 gap-2">
                    {categories?.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => field.onChange(cat.id)}
                        className={cn(
                          "flex flex-col items-center gap-2 p-2 rounded-xl transition-all border border-transparent hover:bg-white/5",
                          field.value === cat.id ? "bg-primary/10 border-primary text-primary shadow-[0_0_15px_rgba(57,255,20,0.15)]" : "bg-muted/50 text-muted-foreground"
                        )}
                      >
                        <div className="w-8 h-8 rounded-full bg-background flex items-center justify-center">
                          {/* Generic fallback icon logic - ideally categories would store icon name */}
                          {cat.name.includes("Food") ? <Utensils className="w-4 h-4" /> :
                           cat.name.includes("Transport") ? <Bus className="w-4 h-4" /> :
                           cat.name.includes("Shop") ? <ShoppingBag className="w-4 h-4" /> :
                           <Zap className="w-4 h-4" />}
                        </div>
                        <span className="text-[10px] font-medium truncate w-full text-center">{cat.name}</span>
                      </button>
                    ))}
                    <button
                      type="button"
                      className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl border border-dashed border-muted-foreground/30 text-muted-foreground hover:bg-white/5 hover:border-muted-foreground transition-colors"
                      onClick={() => {/* Open category manager logic could go here */}}
                    >
                       <Plus className="w-5 h-5" />
                       <span className="text-[10px]">New</span>
                    </button>
                  </div>
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
                  <FormLabel className="text-muted-foreground ml-1">Payment Method</FormLabel>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        type="button"
                        onClick={() => field.onChange(method.id)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-2 rounded-full border transition-all text-sm font-medium whitespace-nowrap",
                          field.value === method.id 
                            ? "bg-secondary/10 border-secondary text-secondary shadow-[0_0_10px_rgba(255,215,0,0.2)]" 
                            : "bg-muted/30 border-white/5 text-muted-foreground hover:bg-muted/50"
                        )}
                      >
                        <method.icon className="w-4 h-4" />
                        {method.id}
                        {field.value === method.id && <Check className="w-3 h-3 ml-1" />}
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
                            <Input {...field} placeholder="Add a note (optional)" className="bg-muted/30 border-white/5" />
                        </FormControl>
                    </FormItem>
                )}
            />

            <Button 
              type="submit" 
              className="w-full h-12 text-lg font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-[1.02] active:scale-[0.98] transition-all neon-glow"
              disabled={isPending}
            >
              {isPending ? "Saving..." : "Save Transaction"}
            </Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
