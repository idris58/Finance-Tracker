import { z } from "zod";

// === ZOD SCHEMAS ===

export const insertSettingsSchema = z.object({
  currencySymbol: z.string().default("৳"),
});

export const transactionTypeSchema = z.enum(["expense", "income", "loan"]);
export const loanTypeSchema = z.enum(["borrow", "lend"]);
export const loanStatusSchema = z.enum(["open", "partial", "settled"]);

export const insertCategorySchema = z.object({
  name: z.string().min(1),
  color: z.string().default("#39ff14"),
  type: transactionTypeSchema.default("expense"),
});

export const insertTransactionSchema = z.object({
  amount: z.string().min(1),
  categoryId: z.number().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  date: z.date().or(z.string()).transform((val) => val instanceof Date ? val : new Date(val)),
  settlementDate: z.date().or(z.string()).transform((val) => val instanceof Date ? val : new Date(val)).optional().nullable(),
  paymentMethod: z.string().min(1),
  accountId: z.number().optional().nullable(),
  loanSettlementAccountId: z.number().optional().nullable(),
  counterparty: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  type: transactionTypeSchema.default("expense"),
  loanType: loanTypeSchema.optional().nullable(),
  loanStatus: loanStatusSchema.optional().nullable(),
});

export const insertAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Cash', 'Bank', 'Mobile']),
  balance: z.string().default("0"),
});

// === TYPES ===

export interface Settings {
  id?: number;
  currencySymbol: string;
  updatedAt?: Date;
}

export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export interface Category {
  id?: number;
  name: string;
  color: string;
  type: "expense" | "income" | "loan";
}

export type InsertCategory = z.infer<typeof insertCategorySchema>;

export interface LoanSettlement {
  id: string;
  amount: string;
  accountId: number;
  date: Date;
  note?: string | null;
}

export interface Transaction {
  id?: number;
  amount: string;
  categoryId?: number | null;
  categoryName?: string | null;
  date: Date;
  settlementDate?: Date | null;
  paymentMethod: string;
  accountId?: number | null;
  loanSettlementAccountId?: number | null;
  counterparty?: string | null;
  note?: string | null;
  tags?: string[];
  type: "expense" | "income" | "loan";
  loanType?: "borrow" | "lend" | null;
  loanStatus?: "open" | "partial" | "settled" | null;
  settlements?: LoanSettlement[];
}

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export interface Account {
  id?: number;
  name: string;
  type: 'Cash' | 'Bank' | 'Mobile';
  balance: string;
}

export type InsertAccount = z.infer<typeof insertAccountSchema>;

export interface Transfer {
  id?: number;
  fromAccountId: number;
  toAccountId: number;
  amount: string;
  note?: string | null;
  date: Date;
}

// === API REQUEST TYPES ===
export type UpdateSettingsRequest = Partial<InsertSettings>;
export type CreateTransactionRequest = InsertTransaction;
export type CreateCategoryRequest = InsertCategory;
export type UpdateCategoryRequest = Partial<InsertCategory>;
export type CreateAccountRequest = InsertAccount;
export type UpdateAccountRequest = Partial<InsertAccount>;

// === API RESPONSE TYPES ===
export type DashboardStatsResponse = {
  totalBalance: number;
  totalIncome: number;
  totalExpense: number;
  totalBorrow: number;
  totalLend: number;
};

// === BACKUP & EXPORT SCHEMA ===
export const CURRENT_SCHEMA_VERSION = 1;

export const loanSettlementBackupSchema = z.object({
  id: z.string().optional(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  accountId: z.number().nullable().optional(),
  date: z.union([z.date(), z.string()]),
  note: z.string().nullable().optional(),
});

export const settingsBackupSchema = z.object({
  id: z.number().optional(),
  currencySymbol: z.string().default("৳"),
  updatedAt: z.union([z.date(), z.string()]).optional(),
});

export const categoryBackupSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Category name is required"),
  color: z.string().default("#9e9e9e"),
  type: transactionTypeSchema.default("expense"),
});

export const transactionBackupSchema = z.object({
  id: z.number().optional(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  categoryId: z.number().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  date: z.union([z.date(), z.string()]),
  settlementDate: z.union([z.date(), z.string()]).nullable().optional(),
  paymentMethod: z.string().optional().default("Cash"),
  accountId: z.number().nullable().optional(),
  loanSettlementAccountId: z.number().nullable().optional(),
  counterparty: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  type: transactionTypeSchema.default("expense"),
  loanType: loanTypeSchema.nullable().optional(),
  loanStatus: loanStatusSchema.nullable().optional(),
  settlements: z.array(loanSettlementBackupSchema).optional(),
});

export const accountBackupSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1, "Account name is required"),
  type: z.enum(["Cash", "Bank", "Mobile"]).default("Cash"),
  balance: z.union([z.string(), z.number()]).transform((v) => String(v)).default("0"),
});

export const transferBackupSchema = z.object({
  id: z.number().optional(),
  fromAccountId: z.number(),
  toAccountId: z.number(),
  amount: z.union([z.string(), z.number()]).transform((v) => String(v)),
  note: z.string().nullable().optional(),
  date: z.union([z.date(), z.string()]),
});

export const backupFileSchema = z.object({
  schemaVersion: z.number().optional().default(CURRENT_SCHEMA_VERSION),
  exportedAt: z.string().optional(),
  settings: settingsBackupSchema.optional().default({ currencySymbol: "৳" }),
  categories: z.array(categoryBackupSchema).default([]),
  transactions: z.array(transactionBackupSchema).default([]),
  accounts: z.array(accountBackupSchema).optional(),
  transfers: z.array(transferBackupSchema).optional().default([]),
});

export type BackupData = z.infer<typeof backupFileSchema>;
