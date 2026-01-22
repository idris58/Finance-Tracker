import { pgTable, text, serial, integer, boolean, timestamp, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Settings for the "Safe-to-Spend" logic
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  monthlyIncome: numeric("monthly_income").notNull().default("0"),
  savingsGoal: numeric("savings_goal").notNull().default("0"),
  fixedBillsTotal: numeric("fixed_bills_total").notNull().default("0"), // Rent, Internet, etc.
  currencySymbol: text("currency_symbol").default("৳"), // Defaulting to BDT based on context (Bkash/Nagad)
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(), // e.g., Food, Transport, Mess, Mobile Recharge
  monthlyLimit: numeric("monthly_limit").default("0"),
  color: text("color").default("#39ff14"), // Hex code for UI
  isFixed: boolean("is_fixed").default(false), // If true, counts towards fixedBillsTotal automatically? Or just a flag.
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  amount: numeric("amount").notNull(),
  categoryId: integer("category_id").references(() => categories.id),
  categoryName: text("category_name"), // Fallback or denormalized for easier display if needed
  date: timestamp("date").notNull().defaultNow(),
  paymentMethod: text("payment_method").notNull(), // Cash, Bank, Bkash, Nagad
  note: text("note"),
  isRecurring: boolean("is_recurring").default(false),
});

// === BASE SCHEMAS ===
export const insertSettingsSchema = createInsertSchema(settings).omit({ id: true, updatedAt: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertTransactionSchema = createInsertSchema(transactions).omit({ id: true });

// === TYPES ===
export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

// === API REQUEST TYPES ===
export type UpdateSettingsRequest = Partial<InsertSettings>;
export type CreateTransactionRequest = InsertTransaction;
export type CreateCategoryRequest = InsertCategory;
export type UpdateCategoryRequest = Partial<InsertCategory>;

// === API RESPONSE TYPES ===
export type DashboardStatsResponse = {
  totalBalance: number;
  safeToSpendDaily: number;
  daysRemaining: number;
  monthlySpent: number;
  totalBudget: number;
};
