import { db, initializeDatabase, type Settings, type Category, type Transaction, type Account } from './db';

export interface IStorage {
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<Omit<Settings, 'id' | 'updatedAt'>>): Promise<Settings>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;
  createCategory(category: Omit<Category, 'id'>): Promise<Category>;
  updateCategory(id: number, updates: Partial<Omit<Category, 'id'>>): Promise<Category>;
  deleteCategory(id: number): Promise<void>;

  // Transactions
  getTransactions(month?: string, categoryId?: number, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction>;
  updateTransaction(id: number, updates: Partial<Omit<Transaction, 'id'>>): Promise<Transaction>;
  deleteTransaction(id: number): Promise<void>;

  // Accounts
  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: Omit<Account, 'id'>): Promise<Account>;
  updateAccount(id: number, updates: Partial<Omit<Account, 'id'>>): Promise<Account>;
  deleteAccount(id: number): Promise<void>;

  // Bulk (for Import)
  importData(data: { settings: Settings; categories: Category[]; transactions: Transaction[]; accounts?: Account[] }): Promise<void>;

  // Reset all data
  resetAllData(): Promise<void>;
}

export class LocalStorage implements IStorage {
  async getSettings(): Promise<Settings> {
    const existing = await db.settings.orderBy('id').first();
    if (!existing) {
      const defaultSettings: Omit<Settings, 'id'> = {
        monthlyIncome: '0',
        savingsGoal: '0',
        fixedBillsTotal: '0',
        currencySymbol: '৳',
        currentBalance: '0',
        isSetupComplete: false,
        updatedAt: new Date(),
      };
      const id = await db.settings.add(defaultSettings);
      return { ...defaultSettings, id } as Settings;
    }
    return {
      ...existing,
      updatedAt: existing.updatedAt instanceof Date ? existing.updatedAt : (existing.updatedAt ? new Date(existing.updatedAt as any) : undefined),
    };
  }

  async updateSettings(updates: Partial<Omit<Settings, 'id' | 'updatedAt'>>): Promise<Settings> {
    const existing = await this.getSettings();
    if (!existing.id) {
      throw new Error('Settings not found');
    }

    const updated: Partial<Settings> = {
      ...updates,
      updatedAt: new Date(),
    };

    await db.settings.update(existing.id, updated);
    const result = await db.settings.get(existing.id);
    if (!result) {
      throw new Error('Failed to update settings');
    }
    return result;
  }

  async getCategories(): Promise<Category[]> {
    return await db.categories.orderBy('id').toArray();
  }

  async getCategory(id: number): Promise<Category | undefined> {
    return await db.categories.get(id);
  }

  async createCategory(category: Omit<Category, 'id'>): Promise<Category> {
    const id = await db.categories.add(category as Category);
    const created = await db.categories.get(id);
    if (!created) {
      throw new Error('Failed to create category');
    }
    return created;
  }

  async updateCategory(id: number, updates: Partial<Omit<Category, 'id'>>): Promise<Category> {
    await db.categories.update(id, updates);
    const updated = await db.categories.get(id);
    if (!updated) {
      throw new Error('Category not found');
    }
    return updated;
  }

  async deleteCategory(id: number): Promise<void> {
    await db.categories.delete(id);
  }

  async getTransactions(month?: string, categoryId?: number, limit?: number): Promise<Transaction[]> {
    let query = db.transactions.orderBy('date').reverse();

    if (month) {
      const startOfMonth = new Date(`${month}-01`);
      const endOfMonth = new Date(startOfMonth.getFullYear(), startOfMonth.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      query = query.filter((tx) => {
        const txDate = new Date(tx.date);
        const matchesMonth = txDate >= startOfMonth && txDate <= endOfMonth;
        const matchesCategory = categoryId === undefined || tx.categoryId === categoryId;
        return matchesMonth && matchesCategory;
      });
    } else if (categoryId !== undefined) {
      query = query.filter((tx) => tx.categoryId === categoryId);
    }

    const transactions = await query.toArray();

    const transactionsWithDates = transactions.map((tx) => ({
      ...tx,
      date: tx.date instanceof Date ? tx.date : new Date(tx.date),
    }));

    if (limit) {
      return transactionsWithDates.slice(0, limit);
    }

    return transactionsWithDates;
  }

  async createTransaction(transaction: Omit<Transaction, 'id'>): Promise<Transaction> {
    if (transaction.categoryId && !transaction.categoryName) {
      const cat = await this.getCategory(transaction.categoryId);
      if (cat) {
        transaction.categoryName = cat.name;
        if (!transaction.type) {
          transaction.type = cat.type;
        }
      }
    }

    if (!transaction.type) {
      transaction.type = 'expense';
    }

    if (transaction.type === 'loan' && !transaction.loanType) {
      transaction.loanType = transaction.categoryName?.toLowerCase().includes('borrow') ? 'borrow' : 'lend';
    }

    if (transaction.type === 'loan' && !transaction.loanStatus) {
      transaction.loanStatus = 'open';
    }

    if (transaction.accountId) {
      const account = await this.getAccount(transaction.accountId);
      if (account) {
        transaction.paymentMethod = account.name;
      }
    }

    if (!transaction.accountId && transaction.paymentMethod) {
      const account = await db.accounts.where('name').equals(transaction.paymentMethod).first();
      if (account) {
        transaction.accountId = account.id!;
      }
    }

    const id = await db.transactions.add({
      ...transaction,
      date: transaction.date instanceof Date ? transaction.date : new Date(transaction.date),
    } as Transaction);

    const created = await db.transactions.get(id);
    if (!created) {
      throw new Error('Failed to create transaction');
    }

    if (transaction.accountId) {
      const account = await this.getAccount(transaction.accountId);
      if (account) {
        const amount = Number(transaction.amount);
        let delta = 0;
        if (transaction.type === 'income') delta = amount;
        if (transaction.type === 'expense') delta = -amount;
        if (transaction.type === 'loan') {
          delta = transaction.loanType === 'borrow' ? amount : -amount;
        }
        const newBalance = Number(account.balance || 0) + delta;
        await this.updateAccount(account.id!, { balance: newBalance.toString() });
      }
    }

    return created;
  }

  async updateTransaction(id: number, updates: Partial<Omit<Transaction, 'id'>>): Promise<Transaction> {
    const existing = await db.transactions.get(id);
    if (!existing) {
      throw new Error('Transaction not found');
    }

    const merged: Transaction = {
      ...existing,
      ...updates,
      date: updates.date ? (updates.date instanceof Date ? updates.date : new Date(updates.date)) : existing.date,
    };

    if (merged.categoryId && merged.categoryId !== existing.categoryId) {
      const cat = await this.getCategory(merged.categoryId);
      if (cat) {
        merged.categoryName = cat.name;
        merged.type = cat.type;
      }
    }

    if (merged.type === 'loan' && !merged.loanType) {
      merged.loanType = merged.categoryName?.toLowerCase().includes('borrow') ? 'borrow' : 'lend';
    }
    if (merged.type === 'loan' && !merged.loanStatus) {
      merged.loanStatus = 'open';
    }

    if (merged.accountId) {
      const account = await this.getAccount(merged.accountId);
      if (account) {
        merged.paymentMethod = account.name;
      }
    }

    if (!merged.accountId && merged.paymentMethod) {
      const account = await db.accounts.where('name').equals(merged.paymentMethod).first();
      if (account) {
        merged.accountId = account.id!;
      }
    }

    const computeDelta = (tx: Transaction) => {
      const amount = Number(tx.amount);
      if (tx.type === 'income') return amount;
      if (tx.type === 'loan') return tx.loanType === 'borrow' ? amount : -amount;
      return -amount;
    };

    const oldDelta = computeDelta(existing);
    const newDelta = computeDelta(merged);

    if (existing.accountId && existing.accountId === merged.accountId) {
      const account = await this.getAccount(existing.accountId);
      if (account) {
        const delta = newDelta - oldDelta;
        const next = Number(account.balance || 0) + delta;
        await this.updateAccount(account.id!, { balance: next.toString() });
      }
    } else {
      if (existing.accountId) {
        const oldAccount = await this.getAccount(existing.accountId);
        if (oldAccount) {
          const next = Number(oldAccount.balance || 0) - oldDelta;
          await this.updateAccount(oldAccount.id!, { balance: next.toString() });
        }
      }
      if (merged.accountId) {
        const newAccount = await this.getAccount(merged.accountId);
        if (newAccount) {
          const next = Number(newAccount.balance || 0) + newDelta;
          await this.updateAccount(newAccount.id!, { balance: next.toString() });
        }
      }
    }

    await db.transactions.update(id, merged);
    const updated = await db.transactions.get(id);
    if (!updated) {
      throw new Error('Failed to update transaction');
    }
    return updated;
  }

  async deleteTransaction(id: number): Promise<void> {
    const existing = await db.transactions.get(id);
    if (existing?.accountId) {
      const account = await this.getAccount(existing.accountId);
      if (account) {
        const amount = Number(existing.amount);
        let delta = 0;
        if ((existing.type || 'expense') === 'income') delta = -amount;
        if ((existing.type || 'expense') === 'expense') delta = amount;
        if (existing.type === 'loan') {
          delta = existing.loanType === 'borrow' ? -amount : amount;
        }
        const newBalance = Number(account.balance || 0) + delta;
        await this.updateAccount(account.id!, { balance: newBalance.toString() });
      }
    }

    await db.transactions.delete(id);
  }

  async getAccounts(): Promise<Account[]> {
    return await db.accounts.orderBy('id').toArray();
  }

  async getAccount(id: number): Promise<Account | undefined> {
    return await db.accounts.get(id);
  }

  async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const id = await db.accounts.add(account as Account);
    const created = await db.accounts.get(id);
    if (!created) {
      throw new Error('Failed to create account');
    }
    return created;
  }

  async updateAccount(id: number, updates: Partial<Omit<Account, 'id'>>): Promise<Account> {
    await db.accounts.update(id, updates);
    const updated = await db.accounts.get(id);
    if (!updated) {
      throw new Error('Account not found');
    }
    return updated;
  }

  async deleteAccount(id: number): Promise<void> {
    await db.accounts.delete(id);
  }

  async importData(data: { settings: Settings; categories: Category[]; transactions: Transaction[]; accounts?: Account[] }): Promise<void> {
    if (data.settings) {
      await this.updateSettings({
        monthlyIncome: data.settings.monthlyIncome,
        savingsGoal: data.settings.savingsGoal,
        fixedBillsTotal: data.settings.fixedBillsTotal,
        currencySymbol: data.settings.currencySymbol,
        currentBalance: data.settings.currentBalance || '0',
        isSetupComplete: data.settings.isSetupComplete !== undefined ? data.settings.isSetupComplete : true,
      });
    }

    if (data.categories && data.categories.length > 0) {
      for (const cat of data.categories) {
        const existing = await db.categories.where('name').equals(cat.name).first();
        if (existing) {
          await this.updateCategory(existing.id!, {
            monthlyLimit: cat.monthlyLimit,
            color: cat.color,
            isFixed: cat.isFixed,
            type: cat.type ?? 'expense',
          });
        } else {
          await this.createCategory({
            name: cat.name,
            monthlyLimit: cat.monthlyLimit,
            color: cat.color,
            isFixed: cat.isFixed,
            type: cat.type ?? 'expense',
          });
        }
      }
    }

    if (data.accounts && data.accounts.length > 0) {
      for (const acc of data.accounts) {
        const existing = await db.accounts.where('name').equals(acc.name).first();
        if (existing) {
          await this.updateAccount(existing.id!, {
            type: acc.type,
            balance: acc.balance,
          });
        } else {
          await this.createAccount({
            name: acc.name,
            type: acc.type,
            balance: acc.balance,
          });
        }
      }
    }

    if (data.transactions && data.transactions.length > 0) {
      for (const tx of data.transactions) {
        let catId = tx.categoryId;
        if (tx.categoryName) {
          const cat = await db.categories.where('name').equals(tx.categoryName).first();
          if (cat) catId = cat.id!;
        }

        let accountId = tx.accountId ?? null;
        if (!accountId && tx.paymentMethod) {
          const account = await db.accounts.where('name').equals(tx.paymentMethod).first();
          if (account) accountId = account.id!;
        }

        await this.createTransaction({
          amount: tx.amount,
          categoryId: catId ?? null,
          categoryName: tx.categoryName ?? null,
          date: new Date(tx.date),
          paymentMethod: tx.paymentMethod,
          accountId,
          counterparty: tx.counterparty ?? null,
          note: tx.note ?? null,
          isRecurring: tx.isRecurring,
          type: tx.type ?? 'expense',
          loanType: tx.loanType ?? null,
          loanStatus: tx.loanStatus ?? (tx.type === 'loan' ? 'open' : null),
        });
      }
    }
  }

  async resetAllData(): Promise<void> {
    await db.settings.clear();
    await db.categories.clear();
    await db.transactions.clear();
    await db.accounts.clear();

    await initializeDatabase();
  }
}

export const storage = new LocalStorage();

