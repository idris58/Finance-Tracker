import { useCallback, useEffect, useState } from "react";
import { createElement } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ToastAction, type ToastActionElement } from "@/components/ui/toast";
import { storage } from "@/lib/storage";
import { connectCloudDrive, disconnectCloudDrive, downloadLatestBackupFromCloud, downloadBackupById, ensureCloudDriveToken, listAllCloudBackups, preloadCloudDriveAuth, setCloudAccountHint, uploadBackupToCloud, type CloudBackupFileMeta } from "@/lib/cloud-drive";
import { 
  CURRENT_SCHEMA_VERSION,
  backupFileSchema,
  type BackupData,
  type InsertTransaction, 
  type InsertAccount,
  type UpdateSettingsRequest,
  type Category,
  type Transaction,
  type Settings,
  type Account,
  type Transfer,
  type LoanSettlement,
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

const applyCloudConnectSuccess = ({
  result,
  queryClient,
  toast,
}: {
  result: { connected: boolean; email: string | null };
  queryClient: ReturnType<typeof useQueryClient>;
  toast: ReturnType<typeof useToast>["toast"];
}) => {
  const previous = readCloudBackupState();
  setCloudAccountHint(result.email ?? null);
  writeCloudBackupState({ ...previous, connected: true, email: result.email ?? null });
  queryClient.invalidateQueries({ queryKey: ["cloud-backup-status"] });
  toast({ title: "Google Drive connected", description: "Cloud backup is ready to use." });
};

const applyCloudConnectError = ({
  error,
  toast,
}: {
  error: any;
  toast: ReturnType<typeof useToast>["toast"];
}) => {
  toast({
    title: "Google sign-in failed",
    description: error?.message || "Could not connect to Google Drive.",
    variant: "destructive",
  });
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
    onSuccess: (transaction) => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      const description = transaction.type === 'income'
        ? "Your income has been recorded."
        : transaction.type === 'loan'
          ? "Your loan has been recorded."
          : "Your expense has been logged.";
      toast({ title: "Transaction recorded", description });
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
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Transaction deleted", description: "Record removed successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Delete failed",
        description: error?.message || "Could not delete transaction.",
        variant: "destructive",
      });
    },
  });
}

export function useAddLoanSettlement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ transactionId, settlement }: { transactionId: number; settlement: LoanSettlement }) => {
      return await storage.addLoanSettlement(transactionId, settlement);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Settlement recorded", description: "Loan payment has been applied." });
    },
    onError: (error: any) => {
      toast({
        title: "Settlement failed",
        description: error?.message || "Could not record settlement.",
        variant: "destructive",
      });
    },
  });
}

export function useDeleteLoanSettlement() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ transactionId, settlementId }: { transactionId: number; settlementId: string }) => {
      return await storage.deleteLoanSettlement(transactionId, settlementId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({ title: "Settlement removed", description: "Payment entry has been reversed." });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Could not remove settlement.",
        variant: "destructive",
      });
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
      toast({ title: "Account added", description: "New account created successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Account creation failed",
        description: error?.message || "Could not create account.",
        variant: "destructive",
      });
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
      toast({ title: "Account updated", description: "Account updated successfully." });
    },
    onError: (error: any) => {
      toast({
        title: "Account update failed",
        description: error?.message || "Could not update account.",
        variant: "destructive",
      });
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
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast({ title: "Transfer complete", description: "Balances updated successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Transfer failed", description: error?.message || "Could not complete transfer.", variant: "destructive" });
    },
  });
}

export function useUpdateTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { fromAccountId: number; toAccountId: number; amount: string; note?: string | null; date: Date } }) => {
      await storage.updateTransfer(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast({ title: 'Transfer updated', description: 'Transfer details and balances were updated.' });
    },
    onError: (error: any) => toast({ title: 'Transfer update failed', description: error?.message || 'Could not update transfer.', variant: 'destructive' }),
  });
}

export function useDeleteTransfer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => storage.deleteTransfer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transfers'] });
      toast({ title: 'Transfer deleted', description: 'The transfer was reversed and removed.' });
    },
    onError: (error: any) => toast({ title: 'Transfer deletion failed', description: error?.message || 'Could not delete transfer.', variant: 'destructive' }),
  });
}




// --- Data Management ---

const validateImportData = (raw: unknown): { errors: string[]; clean: BackupData | null } => {
  if (raw && typeof raw === 'object' && 'schemaVersion' in raw) {
    const schemaVersion = (raw as { schemaVersion?: unknown }).schemaVersion;
    if (typeof schemaVersion === 'number' && schemaVersion > CURRENT_SCHEMA_VERSION) {
      return {
        errors: [`This backup uses schema version ${schemaVersion}, newer than this app supports (${CURRENT_SCHEMA_VERSION}). Update the app before importing it.`],
        clean: null,
      };
    }
  }
  const result = backupFileSchema.safeParse(raw);
  if (!result.success) {
    const errorMessages = result.error.errors.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'root';
      return `${path}: ${issue.message}`;
    });
    return { errors: errorMessages, clean: null };
  }

  return { errors: [], clean: result.data };
};

function showUndoableImportToast(
  toast: ReturnType<typeof useToast>["toast"],
  queryClient: ReturnType<typeof useQueryClient>,
  description: string
) {
  const undoImport = async () => {
    try {
      await storage.restoreLastImportSnapshot();
      await queryClient.invalidateQueries();
      toast({ title: "Import undone", description: "Your previous data has been restored." });
    } catch (error: any) {
      toast({ title: "Undo failed", description: error?.message || "Could not restore the pre-import data.", variant: "destructive" });
    }
  };

  toast({
    title: "Import successful",
    description,
    action: createElement(ToastAction, { altText: "Undo import", onClick: () => { void undoImport(); } }, "Undo import") as unknown as ToastActionElement,
  });
}

export function useExportData() {
  const { toast } = useToast();
  
  return async () => {
    try {
      const settings = await storage.getSettings();
      const categories = await storage.getCategories();
      const transactions = await storage.getTransactions();
      const accounts = await storage.getAccounts();
      const transfers = await storage.getTransfers();

      const data: BackupData = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        settings,
        categories,
        transactions,
        accounts,
        transfers,
      };
      
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
    mutationFn: async (data: unknown) => {
      const { errors, clean } = validateImportData(data);
      if (errors.length > 0 || !clean) {
        const message = errors.slice(0, 5).join('; ');
        throw new Error(message || 'Import file is invalid.');
      }
      await storage.importData(clean as any);
      return { success: true, count: clean.transactions?.length || 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries();
      showUndoableImportToast(toast, queryClient, `Imported ${result.count} transactions.`);
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
  return useQuery({
    queryKey: ["cloud-backup-status"],
    queryFn: async () => {
      const saved = readCloudBackupState();
      setCloudAccountHint(saved.email ?? null);
      return {
        connected: saved.connected,
        lastBackupAt: saved.lastBackupAt ?? null,
        email: saved.email ?? null,
      };
    },
    initialData: () => {
      const saved = readCloudBackupState();
      setCloudAccountHint(saved.email ?? null);
      return {
        connected: saved.connected,
        lastBackupAt: saved.lastBackupAt ?? null,
        email: saved.email ?? null,
      };
    },
    staleTime: Infinity,
  });
}

/** Must be called directly from a click handler so Google can open its auth UI. */
export function useEnsureCloudDriveToken() {
  const { toast } = useToast();
  return useCallback(() => ensureCloudDriveToken().catch((error: any) => {
    applyCloudConnectError({ error, toast });
    return null;
  }), [toast]);
}

export function usePreloadCloudBackupAuth() {
  return useCallback(() => preloadCloudDriveAuth(), []);
}

export function useDirectCloudConnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useCallback(() => {
    // IMPORTANT: No async/await here — connectCloudDrive() must run
    // synchronously from the click event so the popup is not blocked.
    return connectCloudDrive()
      .then((result) => {
        applyCloudConnectSuccess({ result, queryClient, toast });
        return result;
      })
      .catch((error) => {
        applyCloudConnectError({ error, toast });
        throw error;
      });
  }, [queryClient, toast]);
}

export function useCloudConnect() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      return await connectCloudDrive();
    },
    onSuccess: (result) => {
      applyCloudConnectSuccess({ result, queryClient, toast });
    },
    onError: (error: any) => {
      applyCloudConnectError({ error, toast });
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
      const payload: BackupData = {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        settings,
        categories,
        transactions,
        accounts,
        transfers,
      };
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
      const { errors, clean } = validateImportData(result.data);
      if (errors.length > 0 || !clean) {
        throw new Error(errors.slice(0, 5).join("; ") || "Cloud backup file is invalid.");
      }
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
      showUndoableImportToast(toast, queryClient, `Imported ${result.count} transactions from latest backup.`);
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

export function useCloudBackupList() {
  return useQuery({
    queryKey: ["cloud-backup-list"],
    queryFn: async (): Promise<CloudBackupFileMeta[]> => {
      return listAllCloudBackups();
    },
    enabled: false, // fetched on demand
    staleTime: 30_000,
  });
}

export function useCloudRestoreByFile() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (file: CloudBackupFileMeta) => {
      const result = await downloadBackupById(file.id, file);
      const { errors, clean } = validateImportData(result.data);
      if (errors.length > 0 || !clean) {
        throw new Error(errors.slice(0, 5).join("; ") || "Cloud backup file is invalid.");
      }
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
      showUndoableImportToast(toast, queryClient, `Imported ${result.count} transactions from selected backup.`);
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

export function useStoragePersistence() {
  const [isPersisted, setIsPersisted] = useState<boolean | null>(null);
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [isRequesting, setIsRequesting] = useState<boolean>(false);
  const { toast } = useToast();

  const checkStatus = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.storage?.persisted) {
      setIsSupported(false);
      setIsPersisted(false);
      return false;
    }

    try {
      const persisted = await navigator.storage.persisted();
      setIsPersisted(persisted);
      return persisted;
    } catch {
      setIsSupported(false);
      setIsPersisted(false);
      return false;
    }
  }, []);

  const requestPersist = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.storage?.persist) {
      setIsSupported(false);
      toast({
        title: "Storage persistence not supported",
        description: "Your browser does not support persistent storage requests.",
        variant: "destructive",
      });
      return false;
    }

    setIsRequesting(true);
    try {
      const granted = await navigator.storage.persist();
      setIsPersisted(granted);
      if (granted) {
        toast({
          title: "Storage protected",
          description: "IndexedDB data is now marked persistent and protected from eviction.",
        });
      } else {
        toast({
          title: "Persistence not granted",
          description: "Browser declined persistence. PWA install or bookmarking may help grant it.",
        });
      }
      return granted;
    } catch (err: any) {
      toast({
        title: "Persistence request failed",
        description: err?.message || "Could not request storage persistence.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsRequesting(false);
    }
  }, [toast]);

  useEffect(() => {
    if (typeof window === "undefined" || !navigator.storage?.persisted) {
      setIsSupported(false);
      return;
    }

    // Auto-check and request persistence if not already granted
    navigator.storage.persisted()
      .then((persisted) => {
        setIsPersisted(persisted);
        if (!persisted && navigator.storage?.persist) {
          navigator.storage.persist().then((granted) => {
            setIsPersisted(granted);
          }).catch(() => {
            // Ignore error on automatic background request
          });
        }
      })
      .catch(() => {
        setIsSupported(false);
      });
  }, []);

  return {
    isPersisted,
    isSupported,
    isRequesting,
    requestPersist,
    checkStatus,
  };
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

