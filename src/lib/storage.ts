import { db, initializeDatabase, type Settings, type Category, type Transaction, type Account } from './db';

export interface IStorage {
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<Omit<Settings, 'id' | 'updatedAt'>>): Promise<Settings>;

  // Categories
  getCategories(): Promise<Category[]>;
  getCategory(id: number): Promise<Category | undefined>;

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
  transferBetweenAccounts(params: { fromAccountId: number; toAccountId: number; amount: string; note?: string | null; date?: Date }): Promise<void>;
  getTransfers(limit?: number): Promise<{ id?: number; fromAccountId: number; toAccountId: number; amount: string; note?: string | null; date: Date }[]>;

  // Bulk (for Import)
  importData(data: { settings: Settings; categories: Category[]; transactions: Transaction[]; accounts?: Account[] }): Promise<void>;

  // Reset all data
  resetAllData(): Promise<void>;
}

export class LocalStorage implements IStorage {
  private getBalanceDelta(tx: Transaction): number {
    const amount = Number(tx.amount);
    if ((tx.type || 'expense') === 'income') return amount;
    if ((tx.type || 'expense') === 'expense') return -amount;
    if (tx.type === 'loan') {
      return tx.loanType === 'borrow' ? amount : -amount;
    }
    return -amount;
  }

  private getSettlementDelta(tx: Transaction): number {
    if (tx.type !== 'loan' || tx.loanStatus !== 'settled') return 0;
    const amount = Number(tx.amount);
    return tx.loanType === 'borrow' ? -amount : amount;
  }

  async getSettings(): Promise<Settings> {
    const existing = await db.settings.orderBy('id').first();
    if (!existing) {
      const defaultSettings: Omit<Settings, 'id'> = {
        currencySymbol: '৳',
        isSetupComplete: false,
        updatedAt: new Date(),
      };
      const id = await db.settings.add(defaultSettings);
      return { ...defaultSettings, id } as Settings;
    }
    return {
      id: existing.id,
      currencySymbol: existing.currencySymbol ?? '৳',
      isSetupComplete: existing.isSetupComplete ?? false,
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
    if (!Array.isArray(transaction.tags)) {
      transaction.tags = [];
    }

    if (transaction.type === 'loan' && !transaction.loanType) {
      transaction.loanType = transaction.categoryName?.toLowerCase().includes('borrow') ? 'borrow' : 'lend';
    }

    if (transaction.type === 'loan' && !transaction.loanStatus) {
      transaction.loanStatus = 'open';
    }
    if (transaction.type === 'loan' && transaction.loanStatus === 'settled' && !transaction.loanSettlementAccountId) {
      transaction.loanSettlementAccountId = transaction.accountId ?? null;
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
        const delta = this.getBalanceDelta(transaction as Transaction);
        const newBalance = Number(account.balance || 0) + delta;
        await this.updateAccount(account.id!, { balance: newBalance.toString() });
      }
    }

    if (transaction.loanSettlementAccountId) {
      const account = await this.getAccount(transaction.loanSettlementAccountId);
      if (account) {
        const delta = this.getSettlementDelta(transaction as Transaction);
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
    if (!Array.isArray(merged.tags)) {
      merged.tags = [];
    }

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
    if (merged.type === 'loan' && merged.loanStatus === 'settled' && !merged.loanSettlementAccountId) {
      merged.loanSettlementAccountId = merged.accountId ?? null;
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

    const oldDelta = this.getBalanceDelta(existing);
    const newDelta = this.getBalanceDelta(merged);
    const oldSettlementDelta = this.getSettlementDelta(existing);
    const newSettlementDelta = this.getSettlementDelta(merged);

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

    if (existing.loanSettlementAccountId && existing.loanSettlementAccountId === merged.loanSettlementAccountId) {
      const account = await this.getAccount(existing.loanSettlementAccountId);
      if (account) {
        const delta = newSettlementDelta - oldSettlementDelta;
        const next = Number(account.balance || 0) + delta;
        await this.updateAccount(account.id!, { balance: next.toString() });
      }
    } else {
      if (existing.loanSettlementAccountId) {
        const oldAccount = await this.getAccount(existing.loanSettlementAccountId);
        if (oldAccount) {
          const next = Number(oldAccount.balance || 0) - oldSettlementDelta;
          await this.updateAccount(oldAccount.id!, { balance: next.toString() });
        }
      }
      if (merged.loanSettlementAccountId) {
        const newAccount = await this.getAccount(merged.loanSettlementAccountId);
        if (newAccount) {
          const next = Number(newAccount.balance || 0) + newSettlementDelta;
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
        const delta = -this.getBalanceDelta(existing);
        const newBalance = Number(account.balance || 0) + delta;
        await this.updateAccount(account.id!, { balance: newBalance.toString() });
      }
    }

    if (existing?.loanSettlementAccountId) {
      const account = await this.getAccount(existing.loanSettlementAccountId);
      if (account) {
        const delta = -this.getSettlementDelta(existing);
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

  async transferBetweenAccounts(params: { fromAccountId: number; toAccountId: number; amount: string; note?: string | null; date?: Date }): Promise<void> {
    const { fromAccountId, toAccountId, amount, note, date } = params;
    if (fromAccountId === toAccountId) {
      throw new Error('Transfer accounts must be different');
    }
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      throw new Error('Transfer amount must be greater than 0');
    }

    const from = await this.getAccount(fromAccountId);
    const to = await this.getAccount(toAccountId);
    if (!from || !to) {
      throw new Error('Account not found');
    }

    if (Number(from.balance || 0) < parsedAmount) {
      throw new Error('Insufficient balance in the selected account.');
    }

    const fromBalance = Number(from.balance || 0) - parsedAmount;
    const toBalance = Number(to.balance || 0) + parsedAmount;

    await this.updateAccount(fromAccountId, { balance: fromBalance.toString() });
    await this.updateAccount(toAccountId, { balance: toBalance.toString() });

    await db.transfers.add({
      fromAccountId,
      toAccountId,
      amount: parsedAmount.toString(),
      note: note ?? null,
      date: date ?? new Date(),
    });
  }

  async getTransfers(limit?: number): Promise<{ id?: number; fromAccountId: number; toAccountId: number; amount: string; note?: string | null; date: Date }[]> {
    const items = await db.transfers.orderBy('date').reverse().toArray();
    const mapped = items.map((item) => ({
      ...item,
      date: item.date instanceof Date ? item.date : new Date(item.date),
    }));
    if (limit) return mapped.slice(0, limit);
    return mapped;
  }

  async importData(data: { settings: Settings; categories: Category[]; transactions: Transaction[]; accounts?: Account[] }): Promise<void> {
    const hasAccounts = Array.isArray(data.accounts) && data.accounts.length > 0;
    const oldAccountIdToName = new Map<number, string>();
    const nameToAccountId = new Map<string, number>();

    if (data.settings) {
      await this.updateSettings({
        currencySymbol: data.settings.currencySymbol,
        isSetupComplete: data.settings.isSetupComplete !== undefined ? data.settings.isSetupComplete : true,
      });
    }

    if (data.categories && data.categories.length > 0) {
      for (const cat of data.categories) {
        const existing = await db.categories.where('name').equals(cat.name).first();
        if (existing) {
          await db.categories.update(existing.id!, {
            color: cat.color,
            type: cat.type ?? 'expense',
          });
        } else {
          await db.categories.add({
            name: cat.name,
            color: cat.color,
            type: cat.type ?? 'expense',
          } as Category);
        }
      }
    }

    if (data.accounts && data.accounts.length > 0) {
      for (const acc of data.accounts) {
        if (acc.id !== undefined) {
          oldAccountIdToName.set(acc.id, acc.name);
        }
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
      if (!hasAccounts) {
        const inferredAccounts = new Set<string>();
        for (const tx of data.transactions) {
          if (tx.paymentMethod) inferredAccounts.add(tx.paymentMethod);
        }
        if (inferredAccounts.size === 0) {
          inferredAccounts.add('Cash');
        }
        for (const name of inferredAccounts) {
          const existing = await db.accounts.where('name').equals(name).first();
          if (!existing) {
            await this.createAccount({ name, type: name === 'Cash' ? 'Cash' : 'Bank', balance: '0' });
          }
        }
      }

      const accounts = await db.accounts.toArray();
      for (const account of accounts) {
        if (account.id !== undefined) {
          nameToAccountId.set(account.name, account.id);
        }
      }

      for (const tx of data.transactions) {
        let catId = tx.categoryId;
        if (tx.categoryName) {
          const cat = await db.categories.where('name').equals(tx.categoryName).first();
          if (cat) catId = cat.id!;
        }

        let accountId = tx.accountId ?? null;
        if (accountId && oldAccountIdToName.has(accountId)) {
          const name = oldAccountIdToName.get(accountId)!;
          accountId = nameToAccountId.get(name) ?? null;
        }
        if (!accountId && tx.paymentMethod) {
          accountId = nameToAccountId.get(tx.paymentMethod) ?? null;
        }

        let settlementAccountId = tx.loanSettlementAccountId ?? null;
        if (settlementAccountId && oldAccountIdToName.has(settlementAccountId)) {
          const name = oldAccountIdToName.get(settlementAccountId)!;
          settlementAccountId = nameToAccountId.get(name) ?? null;
        }
        if (!settlementAccountId && tx.loanStatus === 'settled') {
          settlementAccountId = accountId ?? null;
        }

        await db.transactions.add({
          amount: tx.amount,
          categoryId: catId ?? null,
          categoryName: tx.categoryName ?? null,
          date: new Date(tx.date),
          paymentMethod: tx.paymentMethod || 'Cash',
          accountId,
          loanSettlementAccountId: settlementAccountId,
          counterparty: tx.counterparty ?? null,
          note: tx.note ?? null,
          tags: Array.isArray(tx.tags) ? tx.tags : [],
          type: tx.type ?? 'expense',
          loanType: tx.loanType ?? (tx.type === 'loan' ? (tx.categoryName?.toLowerCase().includes('borrow') ? 'borrow' : 'lend') : null),
          loanStatus: tx.loanStatus ?? (tx.type === 'loan' ? 'open' : null),
        } as Transaction);
      }
    }

    if (!hasAccounts && data.transactions && data.transactions.length > 0) {
      const transactions = await db.transactions.toArray();
      const accounts = await db.accounts.toArray();
      const balanceMap = new Map<number, number>();
      for (const account of accounts) {
        if (account.id !== undefined) {
          balanceMap.set(account.id, Number(account.balance || 0));
        }
      }
      for (const tx of transactions) {
        if (!tx.accountId) continue;
        const current = balanceMap.get(tx.accountId) ?? 0;
        balanceMap.set(tx.accountId, current + this.getBalanceDelta(tx));
        if (tx.loanSettlementAccountId) {
          const settleCurrent = balanceMap.get(tx.loanSettlementAccountId) ?? 0;
          balanceMap.set(tx.loanSettlementAccountId, settleCurrent + this.getSettlementDelta(tx));
        }
      }
      for (const [id, balance] of balanceMap.entries()) {
        await this.updateAccount(id, { balance: balance.toString() });
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

