import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useUpdateSettings } from "@/hooks/use-finance";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, TrendingUp, Target, Loader2 } from "lucide-react";
import { motion } from "framer-motion";

const welcomeSchema = z.object({
  currentBalance: z.string().min(1, "Please enter your current balance"),
  monthlyIncome: z.string().min(1, "Please enter your monthly income"),
  savingsGoal: z.string().default("0"),
  fixedBillsTotal: z.string().default("0"),
  currencySymbol: z.string().default("৳"),
});

type WelcomeFormValues = z.infer<typeof welcomeSchema>;

export default function WelcomePage() {
  const { mutate: updateSettings, isPending } = useUpdateSettings();
  const [step, setStep] = useState(1);

  const form = useForm<WelcomeFormValues>({
    resolver: zodResolver(welcomeSchema),
    defaultValues: {
      currentBalance: "",
      monthlyIncome: "",
      savingsGoal: "0",
      fixedBillsTotal: "0",
      currencySymbol: "৳",
    },
  });

  const onSubmit = (values: WelcomeFormValues) => {
    updateSettings(
      {
        ...values,
        isSetupComplete: true,
      },
      {
        onSuccess: () => {
          // Redirect will happen automatically via App.tsx checking isSetupComplete
          window.location.href = "/";
        },
      }
    );
  };

  const handleSkip = () => {
    // Skip setup but keep it marked as incomplete so user can access import
    window.location.href = "/settings";
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-background/50">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <Card className="glass-card border-white/10 shadow-2xl">
          <CardHeader className="text-center space-y-4 pb-8">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mx-auto w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center"
            >
              <Wallet className="w-10 h-10 text-primary" />
            </motion.div>
            <div>
              <CardTitle className="text-3xl font-bold font-display">
                Welcome to Finance Tracker
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                Let's set up your financial profile to get started with tracking your expenses
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {step === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Wallet className="w-5 h-5 text-primary" />
                        Current Balance
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Enter your current total cash (Bank + Cash in hand)
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="currentBalance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Balance</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {form.watch("currencySymbol")}
                              </span>
                              <Input
                                {...field}
                                type="number"
                                placeholder="0"
                                className="pl-8 bg-background/50 border-white/10 text-lg"
                                autoFocus
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            This is your starting balance for tracking
                          </FormDescription>
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
                            <Input
                              {...field}
                              placeholder="৳"
                              className="bg-background/50 border-white/10"
                              maxLength={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-3 justify-end pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleSkip}
                        className="border-white/10 hover:bg-white/5"
                      >
                        Skip
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          if (form.getValues("currentBalance")) {
                            setStep(2);
                          } else {
                            form.trigger("currentBalance");
                          }
                        }}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        Next: Income & Goals
                      </Button>
                    </div>
                  </motion.div>
                )}

                {step === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="space-y-2">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-secondary" />
                        Monthly Income & Goals
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Set your monthly income and financial goals
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="monthlyIncome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Income</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {form.watch("currencySymbol")}
                              </span>
                              <Input
                                {...field}
                                type="number"
                                placeholder="0"
                                className="pl-8 bg-background/50 border-white/10 text-lg"
                                autoFocus
                              />
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
                          <FormLabel className="flex items-center gap-2">
                            <Target className="w-4 h-4 text-secondary" />
                            Monthly Savings Goal
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {form.watch("currencySymbol")}
                              </span>
                              <Input
                                {...field}
                                type="number"
                                placeholder="0"
                                className="pl-8 bg-background/50 border-white/10"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            How much do you want to save this month?
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="fixedBillsTotal"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fixed Bills (Rent, Utilities, etc.)</FormLabel>
                          <FormControl>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                {form.watch("currencySymbol")}
                              </span>
                              <Input
                                {...field}
                                type="number"
                                placeholder="0"
                                className="pl-8 bg-background/50 border-white/10"
                              />
                            </div>
                          </FormControl>
                          <FormDescription>
                            Total of all fixed monthly expenses
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex gap-4 pt-4">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setStep(1)}
                        className="flex-1 border-white/10"
                      >
                        Back
                      </Button>
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Complete Setup
                      </Button>
                    </div>
                  </motion.div>
                )}
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
