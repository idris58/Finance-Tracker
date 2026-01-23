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
}

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
      // Migrate currentBalance from settings to a default "Cash" account
      const allSettings = await tx.table('settings').toCollection().toArray();
      for (const setting of allSettings) {
        const currentBalance = setting.currentBalance || '0';
        // Check if a default Cash account already exists
        const existingCash = await tx.table('accounts').where('name').equals('Cash').first();
        if (!existingCash && Number(currentBalance) > 0) {
          await tx.table('accounts').add({
            name: 'Cash',
            type: 'Cash',
            balance: currentBalance,
          });
        } else if (existingCash) {
          // Update existing Cash account balance
          await tx.table('accounts').update(existingCash.id!, {
            balance: (Number(existingCash.balance) + Number(currentBalance)).toString(),
          });
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
    // Ensure existing settings have the new fields
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
      { name: 'Food', color: '#39ff14', monthlyLimit: '5000', isFixed: false },
      { name: 'Transport', color: '#ffd700', monthlyLimit: '2000', isFixed: false },
      { name: 'Rent', color: '#ff6b9d', monthlyLimit: '15000', isFixed: true },
      { name: 'Utilities', color: '#c44569', monthlyLimit: '2000', isFixed: true },
      { name: 'Internet', color: '#2196f3', monthlyLimit: '1500', isFixed: true },
      { name: 'Mess Deposit', color: '#00ffff', monthlyLimit: '3000', isFixed: true },
      { name: 'Mobile Recharge', color: '#ff00ff', monthlyLimit: '500', isFixed: false },
      { name: 'Entertainment', color: '#ff4500', monthlyLimit: '1000', isFixed: false },
      { name: 'Others', color: '#cccccc', monthlyLimit: '1000', isFixed: false },
    ];

    await db.categories.bulkAdd(defaultCategories);
  }
}
