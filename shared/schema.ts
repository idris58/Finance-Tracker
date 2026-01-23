import { z } from "zod";

// === ZOD SCHEMAS ===

export const insertSettingsSchema = z.object({
  monthlyIncome: z.string().default("0"),
  savingsGoal: z.string().default("0"),
  fixedBillsTotal: z.string().default("0"),
  currencySymbol: z.string().default("৳"),
  currentBalance: z.string().default("0"),
  isSetupComplete: z.boolean().default(false),
});

export const insertCategorySchema = z.object({
  name: z.string().min(1),
  monthlyLimit: z.string().default("0"),
  color: z.string().default("#39ff14"),
  isFixed: z.boolean().default(false),
});

export const insertTransactionSchema = z.object({
  amount: z.string().min(1),
  categoryId: z.number().optional().nullable(),
  categoryName: z.string().optional().nullable(),
  date: z.date().or(z.string()).transform((val) => val instanceof Date ? val : new Date(val)),
  paymentMethod: z.string().min(1),
  note: z.string().optional().nullable(),
  isRecurring: z.boolean().default(false),
});

export const insertAccountSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Cash', 'Bank', 'Mobile']),
  balance: z.string().default("0"),
});

// === TYPES ===

export interface Settings {
  id?: number;
  monthlyIncome: string;
  savingsGoal: string;
  fixedBillsTotal: string;
  currencySymbol: string;
  currentBalance: string;
  isSetupComplete: boolean;
  updatedAt?: Date;
}

export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export interface Category {
  id?: number;
  name: string;
  monthlyLimit: string;
  color: string;
  isFixed: boolean;
}

export type InsertCategory = z.infer<typeof insertCategorySchema>;

export interface Transaction {
  id?: number;
  amount: string;
  categoryId?: number | null;
  categoryName?: string | null;
  date: Date;
  paymentMethod: string;
  note?: string | null;
  isRecurring: boolean;
}

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export interface Account {
  id?: number;
  name: string;
  type: 'Cash' | 'Bank' | 'Mobile';
  balance: string;
}

export type InsertAccount = z.infer<typeof insertAccountSchema>;

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
  safeToSpendDaily: number;
  daysRemaining: number;
  monthlySpent: number;
  monthlyIncome: number;
  fixedBills: number;
  savingsGoal: number;
};
