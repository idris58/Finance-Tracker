import { z } from "zod";

// === ZOD SCHEMAS ===

export const insertSettingsSchema = z.object({
  currencySymbol: z.string().default("\u09f3"),
  isSetupComplete: z.boolean().default(false),
});

export const transactionTypeSchema = z.enum(["expense", "income", "loan"]);
export const loanTypeSchema = z.enum(["borrow", "lend"]);
export const loanStatusSchema = z.enum(["open", "settled"]);

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
  paymentMethod: z.string().min(1),
  accountId: z.number().optional().nullable(),
  loanSettlementAccountId: z.number().optional().nullable(),
  counterparty: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
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
  isSetupComplete: boolean;
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

export interface Transaction {
  id?: number;
  amount: string;
  categoryId?: number | null;
  categoryName?: string | null;
  date: Date;
  paymentMethod: string;
  accountId?: number | null;
  loanSettlementAccountId?: number | null;
  counterparty?: string | null;
  note?: string | null;
  type: "expense" | "income" | "loan";
  loanType?: "borrow" | "lend" | null;
  loanStatus?: "open" | "settled" | null;
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
