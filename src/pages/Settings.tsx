import { useSettings, useUpdateSettings, useExportData, useImportData, useAccounts, useCreateAccount, useUpdateAccount, useDeleteAccount, useResetAllData } from "@/hooks/use-finance";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertSettingsSchema, insertAccountSchema } from "@shared/schema";
import { z } from "zod";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Save, Download, Upload, Wallet, PiggyBank, Receipt, CreditCard, Smartphone, Plus, Edit, Trash2, Landmark, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

// Schema that handles string input for numeric fields
const formSchema = insertSettingsSchema.extend({
  monthlyIncome: z.string().or(z.number()).transform(val => val.toString()),
  savingsGoal: z.string().or(z.number()).transform(val => val.toString()),
  fixedBillsTotal: z.string().or(z.number()).transform(val => val.toString()),
  currentBalance: z.string().or(z.number()).transform(val => val.toString()).optional(),
  isSetupComplete: z.boolean().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const accountFormSchema = insertAccountSchema.extend({
  name: z.string().min(1, "Account name is required"),
  balance: z.string().or(z.number()).transform(val => val.toString()),
});

type AccountFormValues = z.infer<typeof accountFormSchema>;

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const { mutate, isPending } = useUpdateSettings();
  const exportData = useExportData();
  const { mutate: importData, isPending: isImporting } = useImportData();
  const { mutate: resetAllData, isPending: isResetting } = useResetAllData();
  const { data: accounts, isLoading: accountsLoading } = useAccounts();
  const { mutate: createAccount, isPending: isCreatingAccount } = useCreateAccount();
  const { mutate: updateAccount, isPending: isUpdatingAccount } = useUpdateAccount();
  const { mutate: deleteAccount } = useDeleteAccount();
  
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<{ id: number; name: string; type: 'Cash' | 'Bank' | 'Mobile'; balance: string } | null>(null);
  const [deleteAccountId, setDeleteAccountId] = useState<number | null>(null);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      monthlyIncome: "0",
      savingsGoal: "0",
      fixedBillsTotal: "0",
      currencySymbol: "৳",
      currentBalance: "0",
      isSetupComplete: false,
    },
  });

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      type: "Cash",
      balance: "0",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        monthlyIncome: settings.monthlyIncome?.toString() || "0",
        savingsGoal: settings.savingsGoal?.toString() || "0",
        fixedBillsTotal: settings.fixedBillsTotal?.toString() || "0",
        currencySymbol: settings.currencySymbol || "৳",
        currentBalance: settings.currentBalance?.toString() || "0",
        isSetupComplete: settings.isSetupComplete ?? false,
      });
    }
  }, [settings, form]);

  useEffect(() => {
    if (accountDialogOpen && editingAccount) {
      accountForm.reset({
        name: editingAccount.name,
        type: editingAccount.type,
        balance: editingAccount.balance,
      });
    } else if (accountDialogOpen && !editingAccount) {
      accountForm.reset({
        name: "",
        type: "Cash",
        balance: "0",
      });
    }
  }, [accountDialogOpen, editingAccount, accountForm]);

  const handleAccountSubmit = (values: AccountFormValues) => {
    if (editingAccount) {
      updateAccount({ id: editingAccount.id, data: values }, {
        onSuccess: () => {
          setAccountDialogOpen(false);
          setEditingAccount(null);
        }
      });
    } else {
      createAccount(values, {
        onSuccess: () => {
          setAccountDialogOpen(false);
        }
      });
    }
  };

  const handleEditAccount = (account: { id: number; name: string; type: 'Cash' | 'Bank' | 'Mobile'; balance: string }) => {
    setEditingAccount(account);
    setAccountDialogOpen(true);
  };

  const handleDeleteAccount = (id: number) => {
    deleteAccount(id);
    setDeleteAccountId(null);
  };

  const getAccountIcon = (type: 'Cash' | 'Bank' | 'Mobile') => {
    switch (type) {
      case 'Cash':
        return Wallet;
      case 'Bank':
        return Landmark;
      case 'Mobile':
        return Smartphone;
    }
  };

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
                  name="currentBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Balance</FormLabel>
                      <FormControl>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{form.watch("currencySymbol")}</span>
                            <Input {...field} type="number" className="pl-8 bg-background/50 border-white/10" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="monthlyIncome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monthly Income</FormLabel>
                      <FormControl>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{form.watch("currencySymbol")}</span>
                            <Input {...field} type="number" className="pl-8 bg-background/50 border-white/10" />
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
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{form.watch("currencySymbol")}</span>
                            <Input {...field} type="number" className="pl-8 bg-background/50 border-white/10" />
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
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{form.watch("currencySymbol")}</span>
                            <Input {...field} type="number" className="pl-8 bg-background/50 border-white/10" />
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
              <CardTitle className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" /> Accounts</CardTitle>
              <CardDescription>
                Manage your accounts (Cash, Bank, Mobile). Total balance is calculated from all accounts.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {accountsLoading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="animate-spin text-primary" />
                </div>
              ) : accounts && accounts.length > 0 ? (
                <div className="space-y-3">
                  {accounts.map((account) => {
                    const Icon = getAccountIcon(account.type);
                    return (
                      <div
                        key={account.id}
                        className="flex items-center justify-between p-4 rounded-xl bg-background/50 border border-white/5 hover:border-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Icon className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{account.name}</div>
                            <div className="text-sm text-muted-foreground">{account.type}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className="font-mono font-bold">{settings?.currencySymbol || '৳'}{Number(account.balance || 0).toLocaleString()}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditAccount(account)}
                              className="h-8 w-8 p-0"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeleteAccountId(account.id!)}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No accounts yet. Add your first account to get started.</p>
                </div>
              )}
              <Button
                type="button"
                onClick={() => {
                  setEditingAccount(null);
                  setAccountDialogOpen(true);
                }}
                className="w-full border-white/10 hover:bg-white/5"
                variant="outline"
              >
                <Plus className="mr-2 h-4 w-4" /> Add Account
              </Button>
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
                <label className="flex-1">
                  <input
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          try {
                            const data = JSON.parse(event.target?.result as string);
                            importData(data);
                          } catch (error) {
                            console.error("Failed to parse JSON:", error);
                          }
                        };
                        reader.readAsText(file);
                      }
                      e.target.value = ""; // Reset input
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full border-white/10 hover:bg-white/5"
                    disabled={isImporting}
                    onClick={() => {
                      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
                      input?.click();
                    }}
                  >
                    {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Upload className="mr-2 h-4 w-4" /> Import Data
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card border-white/5 border-destructive/30 bg-destructive/5">
            <CardHeader>
              <CardTitle className="text-destructive">Reset All Data</CardTitle>
              <CardDescription>
                Clear all financial data and start fresh. This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                type="button" 
                variant="destructive" 
                onClick={() => setResetConfirmOpen(true)}
                disabled={isResetting}
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" /> Reset All Data
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Reset Confirmation Dialog */}
      <AlertDialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <AlertDialogContent className="bg-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Reset All Data?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all your financial data including:
              <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                <li>All transactions</li>
                <li>All categories</li>
                <li>All accounts</li>
                <li>Settings (will be reset to defaults)</li>
              </ul>
              <p className="mt-4 font-semibold text-foreground">This action cannot be undone!</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-white/10">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resetAllData()}
              disabled={isResetting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Yes, Reset Everything
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Account Dialog */}
      <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <DialogContent className="bg-card border-white/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'Add Account'}</DialogTitle>
          </DialogHeader>
          <Form {...accountForm}>
            <form onSubmit={accountForm.handleSubmit(handleAccountSubmit)} className="space-y-4">
              <FormField
                control={accountForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Main Wallet" className="bg-background/50 border-white/10" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={accountForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-background/50 border-white/10">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Cash">Cash</SelectItem>
                        <SelectItem value="Bank">Bank</SelectItem>
                        <SelectItem value="Mobile">Mobile</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={accountForm.control}
                name="balance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Balance</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">{settings?.currencySymbol || '৳'}</span>
                        <Input {...field} type="number" className="pl-8 bg-background/50 border-white/10" />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setAccountDialogOpen(false);
                    setEditingAccount(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isCreatingAccount || isUpdatingAccount}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {(isCreatingAccount || isUpdatingAccount) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAccount ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteAccountId !== null} onOpenChange={(open) => !open && setDeleteAccountId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this account? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAccountId !== null && handleDeleteAccount(deleteAccountId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
