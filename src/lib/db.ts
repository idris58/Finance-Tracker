import Dexie, { type Table } from 'dexie';

// Types matching the original schema
export interface Settings {
  id?: number;
  currencySymbol: string;
  isSetupComplete: boolean;
  updatedAt?: Date;
}

export interface Category {
  id?: number;
  name: string;
  color: string;
  type: "expense" | "income" | "loan";
}

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
  tags?: string[];
  type: "expense" | "income" | "loan";
  loanType?: "borrow" | "lend" | null;
  loanStatus?: "open" | "settled" | null;
}

export interface Account {
  id?: number;
  name: string;
  type: 'Cash' | 'Bank' | 'Mobile';
  balance: string;
}

export interface Transfer {
  id?: number;
  fromAccountId: number;
  toAccountId: number;
  amount: string;
  note?: string | null;
  date: Date;
}

class FinanceDatabase extends Dexie {
  settings!: Table<Settings, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  accounts!: Table<Account, number>;
  transfers!: Table<Transfer, number>;

  constructor() {
    super('FinanceTracker');

    this.version(1).stores({
      settings: '++id',
      categories: '++id, name',
      transactions: '++id, date, categoryId',
    });

    // Migration: Ensure isSetupComplete exists on settings
    this.version(2).stores({
      settings: '++id',
      categories: '++id, name',
      transactions: '++id, date, categoryId',
    }).upgrade(async (tx) => {
      const allSettings = await tx.table('settings').toCollection().toArray();
      for (const setting of allSettings) {
        if (!('isSetupComplete' in setting)) {
          await tx.table('settings').update(setting.id, {
            isSetupComplete: false,
          });
        }
      }
    });

    // Migration: Add accounts table and ensure a default Cash account exists
    this.version(3).stores({
      settings: '++id',
      categories: '++id, name',
      transactions: '++id, date, categoryId',
      accounts: '++id, name',
    }).upgrade(async (tx) => {
      const existingCash = await tx.table('accounts').where('name').equals('Cash').first();
      if (!existingCash) {
        await tx.table('accounts').add({
          name: 'Cash',
          type: 'Cash',
          balance: '0',
        });
      }
    });

    // Migration: Add transaction/category types and loan metadata
    this.version(4).stores({
      settings: '++id',
      categories: '++id, name, type',
      transactions: '++id, date, categoryId, type',
      accounts: '++id, name',
    }).upgrade(async (tx) => {
      const categories = await tx.table('categories').toCollection().toArray();
      for (const category of categories) {
        if (!('type' in category)) {
          await tx.table('categories').update(category.id, { type: 'expense' });
        }
      }

      const transactions = await tx.table('transactions').toCollection().toArray();
      for (const txRow of transactions) {
        const updates: Partial<Transaction> = {};
        if (!('type' in txRow)) updates.type = 'expense';
        if (!('loanType' in txRow)) updates.loanType = null;
        if (!('accountId' in txRow)) updates.accountId = null;
        if (!('counterparty' in txRow)) updates.counterparty = null;
        if (Object.keys(updates).length > 0) {
          await tx.table('transactions').update(txRow.id, updates);
        }
      }
    });

    // Migration: Add loanStatus field
    this.version(5).stores({
      settings: '++id',
      categories: '++id, name, type',
      transactions: '++id, date, categoryId, type',
      accounts: '++id, name',
    }).upgrade(async (tx) => {
      const transactions = await tx.table('transactions').toCollection().toArray();
      for (const txRow of transactions) {
        if (!('loanStatus' in txRow)) {
          const status = txRow.type === 'loan' ? 'open' : null;
          await tx.table('transactions').update(txRow.id, { loanStatus: status });
        }
      }
    });

    // Migration: Add loanSettlementAccountId field
    this.version(6).stores({
      settings: '++id',
      categories: '++id, name, type',
      transactions: '++id, date, categoryId, type',
      accounts: '++id, name',
    }).upgrade(async (tx) => {
      const transactions = await tx.table('transactions').toCollection().toArray();
      for (const txRow of transactions) {
        if (!('loanSettlementAccountId' in txRow)) {
          const settlementAccountId = txRow.type === 'loan' && txRow.loanStatus === 'settled'
            ? (txRow.accountId ?? null)
            : null;
          await tx.table('transactions').update(txRow.id, { loanSettlementAccountId: settlementAccountId });
        }
      }
    });

    // Migration: Add transfers table
    this.version(7).stores({
      settings: '++id',
      categories: '++id, name, type',
      transactions: '++id, date, categoryId, type',
      accounts: '++id, name',
      transfers: '++id, date, fromAccountId, toAccountId',
    });
  }
}

export const db = new FinanceDatabase();

// Initialize default settings if none exist
export async function initializeDatabase() {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      currencySymbol: '৳',
      isSetupComplete: false,
      updatedAt: new Date(),
    });
  } else {
    const existing = await db.settings.orderBy('id').first();
    if (existing && !('isSetupComplete' in existing)) {
      await db.settings.update(existing.id!, {
        isSetupComplete: existing.isSetupComplete !== undefined ? existing.isSetupComplete : false,
      });
    }
  }

  const categoriesCount = await db.categories.count();
  if (categoriesCount === 0) {
    const defaultCategories: Omit<Category, 'id'>[] = [
      { name: 'Food', color: '#ff8a65', type: 'expense' },
      { name: 'Transport', color: '#64b5f6', type: 'expense' },
      { name: 'Shopping', color: '#ba68c8', type: 'expense' },
      { name: 'Bills', color: '#90a4ae', type: 'expense' },
      { name: 'Health', color: '#ef5350', type: 'expense' },
      { name: 'Grocery', color: '#81c784', type: 'expense' },
      { name: 'Education', color: '#5c6bc0', type: 'expense' },
      { name: 'Rentals', color: '#ffb74d', type: 'expense' },
      { name: 'Medical', color: '#ef5350', type: 'expense' },
      { name: 'Other', color: '#9e9e9e', type: 'expense' },
      { name: 'Salary', color: '#4db6ac', type: 'income' },
      { name: 'Business', color: '#9575cd', type: 'income' },
      { name: 'Investment', color: '#7986cb', type: 'income' },
      { name: 'Interest', color: '#ffd54f', type: 'income' },
      { name: 'Extra', color: '#4fc3f7', type: 'income' },
      { name: 'Other Income', color: '#90a4ae', type: 'income' },
      { name: 'Borrow', color: '#f06292', type: 'loan' },
      { name: 'Lend', color: '#4db6ac', type: 'loan' },
    ];

    await db.categories.bulkAdd(defaultCategories);
  } else {
    const required = [
      { name: 'Food', color: '#ff8a65', type: 'expense' as const },
      { name: 'Transport', color: '#64b5f6', type: 'expense' as const },
      { name: 'Shopping', color: '#ba68c8', type: 'expense' as const },
      { name: 'Bills', color: '#90a4ae', type: 'expense' as const },
      { name: 'Health', color: '#ef5350', type: 'expense' as const },
      { name: 'Grocery', color: '#81c784', type: 'expense' as const },
      { name: 'Education', color: '#5c6bc0', type: 'expense' as const },
      { name: 'Rentals', color: '#ffb74d', type: 'expense' as const },
      { name: 'Medical', color: '#ef5350', type: 'expense' as const },
      { name: 'Other', color: '#9e9e9e', type: 'expense' as const },
      { name: 'Salary', color: '#4db6ac', type: 'income' as const },
      { name: 'Business', color: '#9575cd', type: 'income' as const },
      { name: 'Investment', color: '#7986cb', type: 'income' as const },
      { name: 'Interest', color: '#ffd54f', type: 'income' as const },
      { name: 'Extra', color: '#4fc3f7', type: 'income' as const },
      { name: 'Other Income', color: '#90a4ae', type: 'income' as const },
      { name: 'Borrow', color: '#f06292', type: 'loan' as const },
      { name: 'Lend', color: '#4db6ac', type: 'loan' as const },
    ];

    for (const cat of required) {
      const existing = await db.categories.where('name').equals(cat.name).first();
      if (!existing) {
        await db.categories.add(cat);
      } else if (!('type' in existing)) {
        await db.categories.update(existing.id!, { type: cat.type });
      }
    }

    const oldLoan = await db.categories.where('name').equals('Loan').first();
    if (oldLoan) {
      await db.categories.update(oldLoan.id!, { name: 'Lend', type: 'loan' });
    }
  }

  const accountsCount = await db.accounts.count();
  if (accountsCount === 0) {
    await db.accounts.add({ name: 'Cash', type: 'Cash', balance: '0' });
  }
}

