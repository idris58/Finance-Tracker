import { useSettings, useUpdateSettings, useExportData } from "@/hooks/use-finance";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSettingsSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Download, Upload, Wallet, PiggyBank, Receipt } from "lucide-react";
import { useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

// Schema that handles string input for numeric fields
const formSchema = insertSettingsSchema.extend({
  monthlyIncome: z.string().or(z.number()).transform(val => val.toString()),
  savingsGoal: z.string().or(z.number()).transform(val => val.toString()),
  fixedBillsTotal: z.string().or(z.number()).transform(val => val.toString()),
});

type FormValues = z.infer<typeof formSchema>;

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  const exportData = useExportData();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      monthlyIncome: "0",
      savingsGoal: "0",
      fixedBillsTotal: "0",
      currencySymbol: "৳",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        monthlyIncome: settings.monthlyIncome?.toString() || "0",
        savingsGoal: settings.savingsGoal?.toString() || "0",
        fixedBillsTotal: settings.fixedBillsTotal?.toString() || "0",
        currencySymbol: settings.currencySymbol || "৳",
      });
    }
  }, [settings, form]);

  const onSubmit = (values: FormValues) => {
    mutate(values);
  };

  if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <h1 className="text-3xl font-bold font-display">Settings</h1>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          
          <Card className="glass-card border-white/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-primary" /> Financial Profile</CardTitle>
              <CardDescription>
                Update your income and budget goals to calculate your daily Safe-to-Spend limit.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="monthlyIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Income</FormLabel>
                      <FormControl>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">৳</span>
                            <Input {...field} className="pl-8 bg-background/50 border-white/10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="savingsGoal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><PiggyBank className="w-4 h-4 text-secondary" /> Savings Goal</FormLabel>
                      <FormControl>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">৳</span>
                            <Input {...field} className="pl-8 bg-background/50 border-white/10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fixedBillsTotal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2"><Receipt className="w-4 h-4 text-destructive" /> Fixed Bills (Rent, Utilities)</FormLabel>
                      <FormControl>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">৳</span>
                            <Input {...field} className="pl-8 bg-background/50 border-white/10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                 <FormField
                  control={form.control}
                  name="currencySymbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Currency Symbol</FormLabel>
                      <FormControl>
                         <Input {...field} className="bg-background/50 border-white/10" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end pt-4">
                <Button type="submit" disabled={isPending} className="bg-primary text-primary-foreground hover:bg-primary/90 neon-glow">
                  {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" /> Save Changes
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5">
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>
                Backup your financial data or restore from a previous backup.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <Button type="button" variant="outline" onClick={exportData} className="flex-1 border-white/10 hover:bg-white/5">
                  <Download className="mr-2 h-4 w-4" /> Export Data (JSON)
                </Button>
                <Button type="button" variant="outline" className="flex-1 border-white/10 hover:bg-white/5">
                  <Upload className="mr-2 h-4 w-4" /> Import Data
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
}
