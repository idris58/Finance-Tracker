import Dexie, { type Table } from 'dexie';

// Types matching the original schema
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

export interface Category {
  id?: number;
  name: string;
  monthlyLimit: string;
  color: string;
  isFixed: boolean;
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
  isRecurring: boolean;
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

class FinanceDatabase extends Dexie {
  settings!: Table<Settings, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  accounts!: Table<Account, number>;

  constructor() {
    super('FinanceTracker');

    this.version(1).stores({
      settings: '++id',
      categories: '++id, name',
      transactions: '++id, date, categoryId',
    });

    // Migration: Add currentBalance and isSetupComplete to existing settings
    this.version(2).stores({
      settings: '++id',
      categories: '++id, name',
      transactions: '++id, date, categoryId',
    }).upgrade(async (tx) => {
      const allSettings = await tx.table('settings').toCollection().toArray();
      for (const setting of allSettings) {
        if (!('currentBalance' in setting) || !('isSetupComplete' in setting)) {
          await tx.table('settings').update(setting.id, {
            currentBalance: '0',
            isSetupComplete: false,
          });
        }
      }
    });

    // Migration: Add accounts table and migrate currentBalance to default Cash account
    this.version(3).stores({
      settings: '++id',
      categories: '++id, name',
      transactions: '++id, date, categoryId',
      accounts: '++id, name',
    }).upgrade(async (tx) => {
      const allSettings = await tx.table('settings').toCollection().toArray();
      for (const setting of allSettings) {
        const currentBalance = setting.currentBalance || '0';
        const existingCash = await tx.table('accounts').where('name').equals('Cash').first();
        if (!existingCash && Number(currentBalance) > 0) {
          await tx.table('accounts').add({
            name: 'Cash',
            type: 'Cash',
            balance: currentBalance,
          });
        } else if (existingCash) {
          await tx.table('accounts').update(existingCash.id!, {
            balance: (Number(existingCash.balance) + Number(currentBalance)).toString(),
          });
        }
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
  }
}

export const db = new FinanceDatabase();

// Initialize default settings if none exist
export async function initializeDatabase() {
  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      monthlyIncome: '0',
      savingsGoal: '0',
      fixedBillsTotal: '0',
      currencySymbol: '৳',
      currentBalance: '0',
      isSetupComplete: false,
      updatedAt: new Date(),
    });
  } else {
    const existing = await db.settings.orderBy('id').first();
    if (existing && (!('currentBalance' in existing) || !('isSetupComplete' in existing))) {
      await db.settings.update(existing.id!, {
        currentBalance: existing.currentBalance || '0',
        isSetupComplete: existing.isSetupComplete !== undefined ? existing.isSetupComplete : false,
      });
    }
  }

  const categoriesCount = await db.categories.count();
  if (categoriesCount === 0) {
    const defaultCategories: Omit<Category, 'id'>[] = [
      { name: 'Food', color: '#ff8a65', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Transport', color: '#64b5f6', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Shopping', color: '#ba68c8', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Bills', color: '#90a4ae', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Health', color: '#ef5350', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Grocery', color: '#81c784', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Education', color: '#5c6bc0', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Rentals', color: '#ffb74d', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Medical', color: '#ef5350', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Other', color: '#9e9e9e', monthlyLimit: '0', isFixed: false, type: 'expense' },
      { name: 'Salary', color: '#4db6ac', monthlyLimit: '0', isFixed: false, type: 'income' },
      { name: 'Business', color: '#9575cd', monthlyLimit: '0', isFixed: false, type: 'income' },
      { name: 'Investment', color: '#7986cb', monthlyLimit: '0', isFixed: false, type: 'income' },
      { name: 'Interest', color: '#ffd54f', monthlyLimit: '0', isFixed: false, type: 'income' },
      { name: 'Extra', color: '#4fc3f7', monthlyLimit: '0', isFixed: false, type: 'income' },
      { name: 'Other Income', color: '#90a4ae', monthlyLimit: '0', isFixed: false, type: 'income' },
      { name: 'Borrow', color: '#f06292', monthlyLimit: '0', isFixed: false, type: 'loan' },
      { name: 'Lend', color: '#4db6ac', monthlyLimit: '0', isFixed: false, type: 'loan' },
    ];

    await db.categories.bulkAdd(defaultCategories);
  } else {
    const required = [
      { name: 'Food', color: '#ff8a65', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Transport', color: '#64b5f6', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Shopping', color: '#ba68c8', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Bills', color: '#90a4ae', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Health', color: '#ef5350', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Grocery', color: '#81c784', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Education', color: '#5c6bc0', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Rentals', color: '#ffb74d', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Medical', color: '#ef5350', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Other', color: '#9e9e9e', monthlyLimit: '0', isFixed: false, type: 'expense' as const },
      { name: 'Salary', color: '#4db6ac', monthlyLimit: '0', isFixed: false, type: 'income' as const },
      { name: 'Business', color: '#9575cd', monthlyLimit: '0', isFixed: false, type: 'income' as const },
      { name: 'Investment', color: '#7986cb', monthlyLimit: '0', isFixed: false, type: 'income' as const },
      { name: 'Interest', color: '#ffd54f', monthlyLimit: '0', isFixed: false, type: 'income' as const },
      { name: 'Extra', color: '#4fc3f7', monthlyLimit: '0', isFixed: false, type: 'income' as const },
      { name: 'Other Income', color: '#90a4ae', monthlyLimit: '0', isFixed: false, type: 'income' as const },
      { name: 'Borrow', color: '#f06292', monthlyLimit: '0', isFixed: false, type: 'loan' as const },
      { name: 'Lend', color: '#4db6ac', monthlyLimit: '0', isFixed: false, type: 'loan' as const },
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

