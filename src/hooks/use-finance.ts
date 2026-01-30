import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { storage } from "@/lib/storage";
import type { 
  InsertTransaction, 
  InsertAccount,
  UpdateSettingsRequest,
  Category,
  Transaction,
  Settings,
  Account,
  Transfer,
  DashboardStatsResponse
} from "@shared/schema";

// --- Settings ---
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      return await storage.getSettings();
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: UpdateSettingsRequest) => {
      return await storage.updateSettings(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast({ title: "Settings saved", description: "Your financial preferences have been updated." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not save settings.", variant: "destructive" });
    },
  });
}

// --- Categories ---
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      return await storage.getCategories();
    },
  });
}

// --- Transactions ---
export function useTransactions(filters?: { month?: string, categoryId?: string, limit?: string }) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: async () => {
      const month = filters?.month;
      const categoryId = filters?.categoryId ? Number(filters.categoryId) : undefined;
      const limit = filters?.limit ? Number(filters.limit) : undefined;
      return await storage.getTransactions(month, categoryId, limit);
    },
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertTransaction) => {
      return await storage.createTransaction(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Transaction recorded", description: "Your expense has been logged." });
    },
    onError: (err) => {
        toast({ title: "Error", description: "Could not add transaction.", variant: "destructive" });
    }
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertTransaction> }) => {
      return await storage.updateTransaction(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Transaction updated", description: "Changes saved successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Could not update transaction.", variant: "destructive" });
    }
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      await storage.deleteTransaction(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Transaction deleted", description: "Record removed successfully." });
    },
  });
}

// --- Accounts ---
export function useAccounts() {
  return useQuery({
    queryKey: ['accounts'],
    queryFn: async () => {
      return await storage.getAccounts();
    },
  });
}

export function useTransfers(limit?: number) {
  return useQuery({
    queryKey: ['transfers', limit],
    queryFn: async (): Promise<Transfer[]> => {
      return await storage.getTransfers(limit);
    },
  });
}

export function useCreateAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: InsertAccount) => {
      return await storage.createAccount(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast({ title: "Account added", description: "New account created successfully." });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<InsertAccount> }) => {
      return await storage.updateAccount(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast({ title: "Account updated", description: "Account updated successfully." });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: number) => {
      await storage.deleteAccount(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      toast({ title: "Account deleted", description: "Account removed successfully." });
    },
  });
}

export function useTransferBetweenAccounts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { fromAccountId: number; toAccountId: number; amount: string; note?: string | null; date?: Date }) => {
      await storage.transferBetweenAccounts(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast({ title: "Transfer complete", description: "Balances updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Transfer failed", description: error?.message || "Could not complete transfer.", variant: "destructive" });
    },
  });
}

// --- Stats ---
export function useStats() {
  return useQuery({
    queryKey: ['stats'],
    queryFn: async (): Promise<DashboardStatsResponse> => {
      const now = new Date();
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const transactions = await storage.getTransactions(month);

      const accounts = await storage.getAccounts();
      const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);

      const totalExpense = transactions
        .filter((tx) => tx.type === 'expense')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const totalIncome = transactions
        .filter((tx) => tx.type === 'income')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const totalBorrow = transactions
        .filter((tx) => tx.type === 'loan' && tx.loanType === 'borrow')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);
      const totalLend = transactions
        .filter((tx) => tx.type === 'loan' && tx.loanType === 'lend')
        .reduce((sum, tx) => sum + Number(tx.amount), 0);

      return {
        totalBalance,
        totalIncome,
        totalExpense,
        totalBorrow,
        totalLend,
      };
    },
  });
}

// --- Data Management ---
export function useExportData() {
  const { toast } = useToast();
  
  return async () => {
    try {
      const settings = await storage.getSettings();
      const categories = await storage.getCategories();
      const transactions = await storage.getTransactions();
      const accounts = await storage.getAccounts();
      
      const data = { settings, categories, transactions, accounts };
      
      // Trigger download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `finance-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast({ title: "Export successful", description: "Your data has been downloaded." });
    } catch (e) {
      toast({ title: "Export failed", description: "Could not download data.", variant: "destructive" });
    }
  };
}

export function useImportData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: { settings: Settings; categories: Category[]; transactions: Transaction[]; accounts?: Account[] }) => {
      await storage.resetAllData();
      await storage.importData(data);
      return { success: true, count: data.transactions?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      toast({ title: "Import successful", description: `Imported ${result.count} transactions.` });
    },
    onError: () => {
      toast({ title: "Import failed", description: "Could not import data.", variant: "destructive" });
    },
  });
}

export function useResetAllData() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      await storage.resetAllData();
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast({ title: "Data reset successful", description: "All app data has been cleared. You're starting fresh!" });
      // Redirect to welcome page after reset
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    },
    onError: () => {
      toast({ title: "Reset failed", description: "Could not reset data.", variant: "destructive" });
    },
  });
}
