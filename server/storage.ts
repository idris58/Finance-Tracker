import { db } from "./db";
import {
  settings, categories, transactions,
  type InsertSettings, type InsertCategory, type InsertTransaction,
  type Settings, type Category, type Transaction
} from "@shared/schema";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

export interface IStorage {
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<InsertSettings>): Promise<Settings>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Transactions
  getTransactions(month?: string, categoryId?: number, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;
  
  // Bulk (for Import)
  importData(data: { settings: Settings, categories: Category[], transactions: Transaction[] }): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getSettings(): Promise<Settings> {
    const [existing] = await db.select().from(settings).limit(1);
    if (!existing) {
      // Create default settings if none exist
      const [created] = await db.insert(settings).values({}).returning();
      return created;
    }
    return existing;
  }

  async updateSettings(updates: Partial<InsertSettings>): Promise<Settings> {
    const [existing] = await db.select().from(settings).limit(1);
    if (existing) {
      const [updated] = await db.update(settings)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(settings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(settings).values(updates as InsertSettings).returning();
      return created;
    }
  }

  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories).orderBy(categories.id);
  }

  async getCategory(id: number): Promise<Category | undefined> {
    const [cat] = await db.select().from(categories).where(eq(categories.id, id));
    return cat;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [created] = await db.insert(categories).values(category).returning();
    return created;
  }

  async updateCategory(id: number, updates: Partial<InsertCategory>): Promise<Category> {
    const [updated] = await db.update(categories)
      .set(updates)
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  async getTransactions(month?: string, categoryId?: number, limit?: number): Promise<Transaction[]> {
    let query = db.select().from(transactions).orderBy(desc(transactions.date));
    
    const conditions = [];
    if (month) {
      // month format: YYYY-MM
      const startOfMonth = new Date(`${month}-01`);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
      conditions.push(and(gte(transactions.date, startOfMonth), lte(transactions.date, endOfMonth)));
    }
    if (categoryId) {
      conditions.push(eq(transactions.categoryId, categoryId));
    }

    if (conditions.length > 0) {
      // @ts-ignore - complex query building
      query = query.where(and(...conditions));
    }

    if (limit) {
      query = query.limit(limit);
    }

    return await query;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const [created] = await db.insert(transactions).values(transaction).returning();
    return created;
  }

  async deleteTransaction(id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  }

  async importData(data: { settings: Settings, categories: Category[], transactions: Transaction[] }): Promise<void> {
    // Clear existing data? Or merge? 
    // For simplicity, we'll clear and insert, but keeping IDs might be tricky with serials.
    // Let's just insert new records and ignore IDs for now to be safe, or update settings.
    
    // 1. Update Settings
    if (data.settings) {
       await this.updateSettings({
         monthlyIncome: data.settings.monthlyIncome,
         savingsGoal: data.settings.savingsGoal,
         fixedBillsTotal: data.settings.fixedBillsTotal,
         currencySymbol: data.settings.currencySymbol
       });
    }

    // 2. Categories
    if (data.categories && data.categories.length > 0) {
      // Upsert based on name to avoid duplicates
      for (const cat of data.categories) {
        await db.insert(categories)
          .values({ 
            name: cat.name, 
            monthlyLimit: cat.monthlyLimit, 
            color: cat.color, 
            isFixed: cat.isFixed 
          })
          .onConflictDoUpdate({ 
            target: categories.name, 
            set: { monthlyLimit: cat.monthlyLimit, color: cat.color, isFixed: cat.isFixed } 
          });
      }
    }

    // 3. Transactions
    if (data.transactions && data.transactions.length > 0) {
      // Need to map category names to new IDs if we dropped/recreated, 
      // but here we just insert. Ideally we match by category name.
      for (const tx of data.transactions) {
        // Find category ID by name if possible
        let catId = tx.categoryId;
        if (tx.categoryName) {
           const [cat] = await db.select().from(categories).where(eq(categories.name, tx.categoryName));
           if (cat) catId = cat.id;
        }

        await db.insert(transactions).values({
           amount: tx.amount,
           categoryId: catId,
           categoryName: tx.categoryName,
           date: new Date(tx.date), // Ensure date object
           paymentMethod: tx.paymentMethod,
           note: tx.note,
           isRecurring: tx.isRecurring
        });
      }
    }
  }
}

export const storage = new DatabaseStorage();
