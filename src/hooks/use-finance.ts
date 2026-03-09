import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { storage } from "@/lib/storage";
import { connectCloudDrive, disconnectCloudDrive, downloadLatestBackupFromCloud, setCloudAccountHint, uploadBackupToCloud } from "@/lib/cloud-drive";
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

const CLOUD_BACKUP_STATE_KEY = "cloudBackupState";
type CloudBackupState = {
  connected: boolean;
  lastBackupAt?: string;
  email?: string | null;
};

const readCloudBackupState = (): CloudBackupState => {
  try {
    const raw = localStorage.getItem(CLOUD_BACKUP_STATE_KEY);
    if (!raw) return { connected: false };
    const parsed = JSON.parse(raw) as CloudBackupState | boolean | string | null;
    if (typeof parsed === "boolean") {
      return { connected: parsed };
    }
    if (typeof parsed === "string") {
      return { connected: parsed === "true" };
    }
    if (!parsed || typeof parsed !== "object") {
      return { connected: false };
    }
    return {
      connected: !!parsed.connected,
      lastBackupAt: parsed.lastBackupAt,
      email: parsed.email ?? null,
    };
  } catch {
    return { connected: false };
  }
};

const writeCloudBackupState = (next: CloudBackupState) => {
  localStorage.setItem(CLOUD_BACKUP_STATE_KEY, JSON.stringify(next));
};

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
    onError: (error: any) => {
      toast({
        title: "Account not deleted",
        description: error?.message || "Could not delete account.",
        variant: "destructive",
      });
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

const normalizeString = (value: unknown) => {
  if (value === undefined || value === null) return null;
  return String(value);
};

const validateImportData = (data: any) => {
  const errors: string[] = [];

  if (!data || typeof data !== 'object') {
    return { errors: ['Invalid file format.'], clean: null };
  }

  if (!data.settings || typeof data.settings !== 'object') {
    errors.push('Missing settings object.');
  }

  const settings = data.settings || {};
  if (settings.currencySymbol && typeof settings.currencySymbol !== 'string') {
    errors.push('Settings.currencySymbol must be a string.');
  }
  if (settings.isSetupComplete !== undefined && typeof settings.isSetupComplete !== 'boolean') {
    errors.push('Settings.isSetupComplete must be true/false.');
  }

  if (!Array.isArray(data.categories)) {
    errors.push('Categories must be an array.');
  }

  const categories = Array.isArray(data.categories) ? data.categories : [];
  const cleanCategories = categories.map((cat: any, index: number) => {
    if (!cat || typeof cat !== 'object') {
      errors.push(`Category #${index + 1} is invalid.`);
      return null;
    }
    if (!cat.name || typeof cat.name !== 'string') {
      errors.push(`Category #${index + 1} is missing a name.`);
    }
    const type = cat.type ?? 'expense';
    if (!['expense', 'income', 'loan'].includes(type)) {
      errors.push(`Category "${cat.name || index + 1}" has invalid type.`);
    }
    return {
      name: cat.name,
      color: typeof cat.color === 'string' ? cat.color : '#9e9e9e',
      type,
    };
  }).filter(Boolean);

  if (!Array.isArray(data.transactions)) {
    errors.push('Transactions must be an array.');
  }

  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const cleanTransactions = transactions.map((tx: any, index: number) => {
    if (!tx || typeof tx !== 'object') {
      errors.push(`Transaction #${index + 1} is invalid.`);
      return null;
    }
    if (tx.amount === undefined || tx.amount === null || isNaN(Number(tx.amount))) {
      errors.push(`Transaction #${index + 1} has invalid amount.`);
    }
    if (!tx.date || isNaN(new Date(tx.date).getTime())) {
      errors.push(`Transaction #${index + 1} has invalid date.`);
    }
    if (tx.type && !['expense', 'income', 'loan'].includes(tx.type)) {
      errors.push(`Transaction #${index + 1} has invalid type.`);
    }
    if (tx.loanType && !['borrow', 'lend'].includes(tx.loanType)) {
      errors.push(`Transaction #${index + 1} has invalid loanType.`);
    }
    if (tx.loanStatus && !['open', 'settled'].includes(tx.loanStatus)) {
      errors.push(`Transaction #${index + 1} has invalid loanStatus.`);
    }
      return {
        amount: normalizeString(tx.amount) ?? '0',
        categoryId: typeof tx.categoryId === 'number' ? tx.categoryId : null,
        categoryName: tx.categoryName ?? null,
        date: tx.date,
        paymentMethod: tx.paymentMethod ?? '',
        accountId: typeof tx.accountId === 'number' ? tx.accountId : null,
        loanSettlementAccountId: typeof tx.loanSettlementAccountId === 'number' ? tx.loanSettlementAccountId : null,
        counterparty: tx.counterparty ?? null,
        note: tx.note ?? null,
        tags: Array.isArray(tx.tags) ? tx.tags.map((tag: any) => String(tag)).filter((tag: string) => tag.trim().length > 0) : [],
        type: tx.type ?? 'expense',
        loanType: tx.loanType ?? null,
        loanStatus: tx.loanStatus ?? null,
      };
  }).filter(Boolean);

  const accounts = Array.isArray(data.accounts) ? data.accounts : null;
  const cleanAccounts = accounts ? accounts.map((acc: any, index: number) => {
    if (!acc || typeof acc !== 'object') {
      errors.push(`Account #${index + 1} is invalid.`);
      return null;
    }
    if (!acc.name || typeof acc.name !== 'string') {
      errors.push(`Account #${index + 1} is missing a name.`);
    }
    if (acc.type && !['Cash', 'Bank', 'Mobile'].includes(acc.type)) {
      errors.push(`Account "${acc.name || index + 1}" has invalid type.`);
    }
    return {
      id: typeof acc.id === 'number' ? acc.id : undefined,
      name: acc.name,
      type: acc.type ?? 'Cash',
      balance: normalizeString(acc.balance) ?? '0',
    };
  }).filter(Boolean) : undefined;

  const transfers = Array.isArray(data.transfers) ? data.transfers : [];
  const cleanTransfers = transfers.map((item: any, index: number) => {
    if (!item || typeof item !== 'object') {
      errors.push(`Transfer #${index + 1} is invalid.`);
      return null;
    }
    if (typeof item.fromAccountId !== 'number') {
      errors.push(`Transfer #${index + 1} has invalid fromAccountId.`);
    }
    if (typeof item.toAccountId !== 'number') {
      errors.push(`Transfer #${index + 1} has invalid toAccountId.`);
    }
    if (item.amount === undefined || item.amount === null || isNaN(Number(item.amount))) {
      errors.push(`Transfer #${index + 1} has invalid amount.`);
    }
    if (!item.date || isNaN(new Date(item.date).getTime())) {
      errors.push(`Transfer #${index + 1} has invalid date.`);
    }
    return {
      id: typeof item.id === 'number' ? item.id : undefined,
      fromAccountId: typeof item.fromAccountId === 'number' ? item.fromAccountId : 0,
      toAccountId: typeof item.toAccountId === 'number' ? item.toAccountId : 0,
      amount: normalizeString(item.amount) ?? '0',
      note: item.note ?? null,
      date: item.date,
    };
  }).filter(Boolean);

  const clean = {
    settings: {
      id: settings.id,
      currencySymbol: typeof settings.currencySymbol === 'string' ? settings.currencySymbol : '?',
      isSetupComplete: settings.isSetupComplete ?? true,
      updatedAt: settings.updatedAt,
    },
    categories: cleanCategories,
    transactions: cleanTransactions,
    accounts: cleanAccounts,
    transfers: cleanTransfers,
  };

  return { errors, clean };
};

export function useExportData() {
  const { toast } = useToast();
  
  return async () => {
    try {
      const settings = await storage.getSettings();
      const categories = await storage.getCategories();
      const transactions = await storage.getTransactions();
      const accounts = await storage.getAccounts();
      const transfers = await storage.getTransfers();

      const data = { settings, categories, transactions, accounts, transfers };
      
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
    mutationFn: async (data: { settings: Settings; categories: Category[]; transactions: Transaction[]; accounts?: Account[]; transfers?: Transfer[] }) => {
      const { errors, clean } = validateImportData(data as any);
      if (errors.length > 0 || !clean) {
        const message = errors.slice(0, 5).join(' ');
        throw new Error(message || 'Import file is invalid.');
      }
      await storage.resetAllData();
      await storage.importData(clean as any);
      return { success: true, count: clean.transactions?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      toast({ title: "Import successful", description: `Imported ${result.count} transactions.` });
    },
    onError: (error: any) => {
      toast({
        title: "Import failed",
        description: error?.message || "Could not import data.",
        variant: "destructive",
      });
    },
  });
}

export function useCloudBackupStatus() {
  const initial = readCloudBackupState();
  setCloudAccountHint(initial.email ?? null);
  return useQuery({
    queryKey: ["cloud-backup-status"],
    queryFn: async () => {
      const saved = readCloudBackupState();
      return {
        connected: saved.connected,
        lastBackupAt: saved.lastBackupAt ?? null,
        email: saved.email ?? null,
      };
    },
    initialData: {
      connected: initial.connected,
      lastBackupAt: initial.lastBackupAt ?? null,
      email: initial.email ?? null,
    },
    staleTime: Infinity,
  });
}

export function useCloudConnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      return await connectCloudDrive();
    },
    onSuccess: (result) => {
      const previous = readCloudBackupState();
      setCloudAccountHint(result.email ?? null);
      writeCloudBackupState({ ...previous, connected: true, email: result.email ?? null });
      queryClient.invalidateQueries({ queryKey: ["cloud-backup-status"] });
      toast({ title: "Google Drive connected", description: "Cloud backup is ready to use." });
    },
    onError: (error: any) => {
      toast({
        title: "Google sign-in failed",
        description: error?.message || "Could not connect to Google Drive.",
        variant: "destructive",
      });
    },
  });
}

export function useCloudDisconnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      disconnectCloudDrive();
    },
    onSuccess: () => {
      const previous = readCloudBackupState();
      setCloudAccountHint(null);
      writeCloudBackupState({ ...previous, connected: false, email: null });
      queryClient.invalidateQueries({ queryKey: ["cloud-backup-status"] });
      toast({ title: "Disconnected", description: "Google Drive cloud backup has been disconnected." });
    },
  });
}

export function useCloudBackupNow() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const settings = await storage.getSettings();
      const categories = await storage.getCategories();
      const transactions = await storage.getTransactions();
      const accounts = await storage.getAccounts();
      const transfers = await storage.getTransfers();
      const payload = { settings, categories, transactions, accounts, transfers };
      const result = await uploadBackupToCloud(payload);
      return result.createdTime;
    },
    onSuccess: (createdTime) => {
      const previous = readCloudBackupState();
      setCloudAccountHint(previous.email ?? null);
      writeCloudBackupState({
        connected: true,
        lastBackupAt: createdTime,
        email: previous.email ?? null,
      });
      queryClient.invalidateQueries({ queryKey: ["cloud-backup-status"] });
      toast({ title: "Cloud backup complete", description: "Backup saved to Google Drive." });
    },
    onError: (error: any) => {
      toast({
        title: "Cloud backup failed",
        description: error?.message || "Could not upload backup to Google Drive.",
        variant: "destructive",
      });
    },
  });
}

export function useCloudRestoreLatest() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const result = await downloadLatestBackupFromCloud();
      const { errors, clean } = validateImportData(result.data as any);
      if (errors.length > 0 || !clean) {
        throw new Error(errors.slice(0, 5).join(" ") || "Cloud backup file is invalid.");
      }
      await storage.resetAllData();
      await storage.importData(clean as any);
      return {
        count: clean.transactions?.length || 0,
        restoredAt: result.file.createdTime,
      };
    },
    onSuccess: (result) => {
      const previous = readCloudBackupState();
      setCloudAccountHint(previous.email ?? null);
      writeCloudBackupState({
        connected: true,
        lastBackupAt: previous.lastBackupAt ?? result.restoredAt,
        email: previous.email ?? null,
      });
      queryClient.invalidateQueries();
      toast({
        title: "Cloud restore complete",
        description: `Imported ${result.count} transactions from latest backup.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Cloud restore failed",
        description: error?.message || "Could not restore from Google Drive.",
        variant: "destructive",
      });
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
