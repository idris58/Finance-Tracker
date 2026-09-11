import { db, initializeDatabase, type Settings, type Category, type Transaction, type Account, type Transfer } from './db';
import { roundMoney, toMoneyString } from './money';
import type { LoanSettlement } from '@shared/schema';

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

  // Loan Settlements
  addLoanSettlement(transactionId: number, settlement: LoanSettlement): Promise<Transaction>;
  deleteLoanSettlement(transactionId: number, settlementId: string): Promise<Transaction>;

  // Accounts
  getAccounts(): Promise<Account[]>;
  getAccount(id: number): Promise<Account | undefined>;
  createAccount(account: Omit<Account, 'id'>): Promise<Account>;
  updateAccount(id: number, updates: Partial<Omit<Account, 'id'>>): Promise<Account>;
  deleteAccount(id: number): Promise<void>;
  transferBetweenAccounts(params: { fromAccountId: number; toAccountId: number; amount: string; note?: string | null; date?: Date }): Promise<void>;
  getTransfers(limit?: number): Promise<{ id?: number; fromAccountId: number; toAccountId: number; amount: string; note?: string | null; date: Date }[]>;

  // Bulk (for Import)
  importData(data: { settings: Settings; categories: Category[]; transactions: Transaction[]; accounts?: Account[]; transfers?: Transfer[] }): Promise<void>;

  // Reset all data
  resetAllData(): Promise<void>;
}

export class LocalStorage implements IStorage {
  private getBalanceDelta(tx: Transaction): number {
    const amount = Number(tx.amount);
    if ((tx.type || 'expense') === 'income') return roundMoney(amount);
    if ((tx.type || 'expense') === 'expense') return roundMoney(-amount);
    if (tx.type === 'loan') {
      return roundMoney(tx.loanType === 'borrow' ? amount : -amount);
    }
    return roundMoney(-amount);
  }

  // Legacy single-settlement helper (still used for old-style settled status)
  private getSettlementDelta(tx: Transaction): number {
    if (tx.type !== 'loan' || tx.loanStatus !== 'settled') return 0;
    if (tx.settlements && tx.settlements.length > 0) return 0; // handled by new system
    const amount = Number(tx.amount);
    return roundMoney(tx.loanType === 'borrow' ? -amount : amount);
  }

  // Calculate net settlement impact per account from the settlements array
  private getSettlementsImpactByAccount(tx: Transaction): Map<number, number> {
    const impact = new Map<number, number>();
    if (!tx.settlements || tx.settlements.length === 0) return impact;
    for (const s of tx.settlements) {
      const existing = impact.get(s.accountId) ?? 0;
      // Borrow: repaying means money leaves the settlement account (debit)
      // Lend: getting paid back means money enters the settlement account (credit)
      const delta = roundMoney(tx.loanType === 'borrow' ? -Number(s.amount) : Number(s.amount));
      impact.set(s.accountId, roundMoney(existing + delta));
    }
    return impact;
  }

  private computeLoanStatus(tx: Transaction): "open" | "partial" | "settled" {
    if (!tx.settlements || tx.settlements.length === 0) return 'open';
    const totalSettled = tx.settlements.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalAmount = Number(tx.amount);
    if (totalSettled <= 0) return 'open';
    if (roundMoney(totalSettled) >= roundMoney(totalAmount)) return 'settled';
    return 'partial';
  }

  async getSettings(): Promise<Settings> {
    const existing = await db.settings.orderBy('id').first();
    if (!existing) {
      const defaultSettings: Omit<Settings, 'id'> = {
        currencySymbol: '৳',
        updatedAt: new Date(),
      };
      const id = await db.settings.add(defaultSettings);
      return { ...defaultSettings, id } as Settings;
    }
    return {
      id: existing.id,
      currencySymbol: existing.currencySymbol ?? '৳',
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
      const [year, monthNumber] = month.split('-').map(Number);
      const startOfMonth = new Date(year, monthNumber - 1, 1, 0, 0, 0, 0);
      const endOfMonth = new Date(year, monthNumber, 0, 23, 59, 59, 999);

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
      settlementDate: tx.settlementDate instanceof Date ? tx.settlementDate : (tx.settlementDate ? new Date(tx.settlementDate) : null),
      settlements: Array.isArray(tx.settlements)
        ? tx.settlements.map((s) => ({
            ...s,
            date: s.date instanceof Date ? s.date : new Date(s.date),
          }))
        : [],
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
    if (!Array.isArray(transaction.settlements)) {
      transaction.settlements = [];
    }

    if (transaction.type === 'loan' && !transaction.loanType) {
      transaction.loanType = transaction.categoryName?.toLowerCase().includes('borrow') ? 'borrow' : 'lend';
    }

    if (transaction.type === 'loan' && !transaction.loanStatus) {
      transaction.loanStatus = 'open';
    }
    // Legacy single-settlement support
    if (transaction.type === 'loan' && transaction.loanStatus === 'settled' && !transaction.loanSettlementAccountId) {
      transaction.loanSettlementAccountId = transaction.accountId ?? null;
    }
    if (transaction.type !== 'loan' || (transaction.loanStatus !== 'settled' && transaction.loanStatus !== 'partial')) {
      transaction.loanSettlementAccountId = null;
      transaction.settlementDate = null;
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
      settlementDate: transaction.settlementDate instanceof Date ? transaction.settlementDate : (transaction.settlementDate ? new Date(transaction.settlementDate) : null),
      settlements: transaction.settlements ?? [],
    } as Transaction);

    const created = await db.transactions.get(id);
    if (!created) {
      throw new Error('Failed to create transaction');
    }

    if (transaction.accountId) {
      const account = await this.getAccount(transaction.accountId);
      if (account) {
        const delta = this.getBalanceDelta(transaction as Transaction);
        const newBalance = roundMoney(Number(account.balance || 0) + delta);
        await this.updateAccount(account.id!, { balance: toMoneyString(newBalance) });
      }
    }

    // Legacy single settlement (for backward compat if creating with loanStatus=settled)
    if (transaction.loanSettlementAccountId && (!transaction.settlements || transaction.settlements.length === 0)) {
      const account = await this.getAccount(transaction.loanSettlementAccountId);
      if (account) {
        const delta = this.getSettlementDelta(transaction as Transaction);
        const newBalance = roundMoney(Number(account.balance || 0) + delta);
        await this.updateAccount(account.id!, { balance: toMoneyString(newBalance) });
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
      settlementDate: updates.settlementDate === undefined
        ? existing.settlementDate ?? null
        : (updates.settlementDate instanceof Date ? updates.settlementDate : (updates.settlementDate ? new Date(updates.settlementDate) : null)),
      settlements: updates.settlements !== undefined ? updates.settlements : (existing.settlements ?? []),
    };
    if (!Array.isArray(merged.tags)) {
      merged.tags = [];
    }
    if (!Array.isArray(merged.settlements)) {
      merged.settlements = [];
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
    if (merged.type !== 'loan' || (merged.loanStatus !== 'settled' && merged.loanStatus !== 'partial')) {
      if (merged.settlements && merged.settlements.length === 0) {
        merged.loanSettlementAccountId = null;
        merged.settlementDate = null;
      }
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

    // Reconcile primary account balance
    if (existing.accountId && existing.accountId === merged.accountId) {
      const account = await this.getAccount(existing.accountId);
      if (account) {
        const delta = newDelta - oldDelta;
        const next = roundMoney(Number(account.balance || 0) + delta);
        await this.updateAccount(account.id!, { balance: toMoneyString(next) });
      }
    } else {
      if (existing.accountId) {
        const oldAccount = await this.getAccount(existing.accountId);
        if (oldAccount) {
          const next = roundMoney(Number(oldAccount.balance || 0) - oldDelta);
          await this.updateAccount(oldAccount.id!, { balance: toMoneyString(next) });
        }
      }
      if (merged.accountId) {
        const newAccount = await this.getAccount(merged.accountId);
        if (newAccount) {
          const next = roundMoney(Number(newAccount.balance || 0) + newDelta);
          await this.updateAccount(newAccount.id!, { balance: toMoneyString(next) });
        }
      }
    }

    // Reconcile legacy settlement accounts
    if (existing.loanSettlementAccountId && existing.loanSettlementAccountId === merged.loanSettlementAccountId) {
      const account = await this.getAccount(existing.loanSettlementAccountId);
      if (account) {
        const delta = newSettlementDelta - oldSettlementDelta;
        const next = roundMoney(Number(account.balance || 0) + delta);
        await this.updateAccount(account.id!, { balance: toMoneyString(next) });
      }
    } else {
      if (existing.loanSettlementAccountId) {
        const oldAccount = await this.getAccount(existing.loanSettlementAccountId);
        if (oldAccount) {
          const next = roundMoney(Number(oldAccount.balance || 0) - oldSettlementDelta);
          await this.updateAccount(oldAccount.id!, { balance: toMoneyString(next) });
        }
      }
      if (merged.loanSettlementAccountId) {
        const newAccount = await this.getAccount(merged.loanSettlementAccountId);
        if (newAccount) {
          const next = roundMoney(Number(newAccount.balance || 0) + newSettlementDelta);
          await this.updateAccount(newAccount.id!, { balance: toMoneyString(next) });
        }
      }
    }

    // Reconcile new-style settlements array changes
    const oldSettlementsImpact = this.getSettlementsImpactByAccount(existing);
    const newSettlementsImpact = this.getSettlementsImpactByAccount(merged);
    const allSettlementAccountIds = new Set([...oldSettlementsImpact.keys(), ...newSettlementsImpact.keys()]);
    for (const accId of allSettlementAccountIds) {
      const oldImpact = oldSettlementsImpact.get(accId) ?? 0;
      const newImpact = newSettlementsImpact.get(accId) ?? 0;
      const diff = roundMoney(newImpact - oldImpact);
      if (diff !== 0) {
        const account = await this.getAccount(accId);
        if (account) {
          const next = roundMoney(Number(account.balance || 0) + diff);
          await this.updateAccount(account.id!, { balance: toMoneyString(next) });
        }
      }
    }

    await db.transactions.update(id, merged);
    const updated = await db.transactions.get(id);
    if (!updated) {
      throw new Error('Failed to update transaction');
    }
    return {
      ...updated,
      settlements: Array.isArray(updated.settlements) ? updated.settlements.map((s) => ({
        ...s,
        date: s.date instanceof Date ? s.date : new Date(s.date),
      })) : [],
    };
  }

  async deleteTransaction(id: number): Promise<void> {
    const existing = await db.transactions.get(id);
    if (existing?.accountId) {
      const account = await this.getAccount(existing.accountId);
      if (account) {
        const delta = -this.getBalanceDelta(existing);
        const newBalance = roundMoney(Number(account.balance || 0) + delta);
        await this.updateAccount(account.id!, { balance: toMoneyString(newBalance) });
      }
    }

    // Reverse legacy settlement
    if (existing?.loanSettlementAccountId && (!existing.settlements || existing.settlements.length === 0)) {
      const account = await this.getAccount(existing.loanSettlementAccountId);
      if (account) {
        const delta = -this.getSettlementDelta(existing);
        const newBalance = roundMoney(Number(account.balance || 0) + delta);
        await this.updateAccount(account.id!, { balance: toMoneyString(newBalance) });
      }
    }

    // Reverse new-style settlements
    if (existing && existing.settlements && existing.settlements.length > 0) {
      const impact = this.getSettlementsImpactByAccount(existing);
      for (const [accId, delta] of impact.entries()) {
        const account = await this.getAccount(accId);
        if (account) {
          const newBalance = roundMoney(Number(account.balance || 0) - delta);
          await this.updateAccount(account.id!, { balance: toMoneyString(newBalance) });
        }
      }
    }

    await db.transactions.delete(id);
  }

  async addLoanSettlement(transactionId: number, settlement: LoanSettlement): Promise<Transaction> {
    const existing = await db.transactions.get(transactionId);
    if (!existing) throw new Error('Transaction not found');
    if (existing.type !== 'loan') throw new Error('Not a loan transaction');

    const currentSettlements: LoanSettlement[] = Array.isArray(existing.settlements) ? existing.settlements : [];
    const totalAlreadySettled = currentSettlements.reduce((sum, s) => sum + Number(s.amount), 0);
    const totalLoan = Number(existing.amount);
    const remaining = roundMoney(totalLoan - totalAlreadySettled);
    const settleAmount = Number(settlement.amount);

    if (settleAmount <= 0) throw new Error('Settlement amount must be greater than 0');
    if (settleAmount > remaining + 0.001) throw new Error(`Cannot settle more than remaining amount (${remaining})`);

    const normalizedSettlement: LoanSettlement = {
      ...settlement,
      amount: toMoneyString(settleAmount),
      date: settlement.date instanceof Date ? settlement.date : new Date(settlement.date),
    };

    const newSettlements = [...currentSettlements, normalizedSettlement];
    const newStatus = this.computeLoanStatus({ ...existing, settlements: newSettlements });

    // Apply balance change for the settlement account
    const account = await this.getAccount(settlement.accountId);
    if (account) {
      // Borrow: paying back => money leaves settlement account
      // Lend: getting paid => money enters settlement account
      const delta = roundMoney(existing.loanType === 'borrow' ? -settleAmount : settleAmount);
      const newBalance = roundMoney(Number(account.balance || 0) + delta);
      await this.updateAccount(account.id!, { balance: toMoneyString(newBalance) });
    }

    await db.transactions.update(transactionId, {
      settlements: newSettlements,
      loanStatus: newStatus,
      // Update legacy fields for backward compatibility
      settlementDate: newStatus === 'settled' ? (normalizedSettlement.date) : existing.settlementDate,
      loanSettlementAccountId: newStatus === 'settled' ? settlement.accountId : existing.loanSettlementAccountId,
    });

    const updated = await db.transactions.get(transactionId);
    if (!updated) throw new Error('Failed to update transaction');
    return {
      ...updated,
      settlements: (updated.settlements ?? []).map((s) => ({
        ...s,
        date: s.date instanceof Date ? s.date : new Date(s.date),
      })),
    };
  }

  async deleteLoanSettlement(transactionId: number, settlementId: string): Promise<Transaction> {
    const existing = await db.transactions.get(transactionId);
    if (!existing) throw new Error('Transaction not found');

    const currentSettlements: LoanSettlement[] = Array.isArray(existing.settlements) ? existing.settlements : [];
    const settlementToDelete = currentSettlements.find((s) => s.id === settlementId);
    if (!settlementToDelete) throw new Error('Settlement not found');

    // Reverse the balance change
    const account = await this.getAccount(settlementToDelete.accountId);
    if (account) {
      const settleAmount = Number(settlementToDelete.amount);
      const delta = roundMoney(existing.loanType === 'borrow' ? settleAmount : -settleAmount);
      const newBalance = roundMoney(Number(account.balance || 0) + delta);
      await this.updateAccount(account.id!, { balance: toMoneyString(newBalance) });
    }

    const newSettlements = currentSettlements.filter((s) => s.id !== settlementId);
    const newStatus = this.computeLoanStatus({ ...existing, settlements: newSettlements });

    await db.transactions.update(transactionId, {
      settlements: newSettlements,
      loanStatus: newStatus,
      // If we moved back from settled, clear legacy fields
      settlementDate: newStatus === 'settled' ? existing.settlementDate : null,
      loanSettlementAccountId: newStatus === 'settled' ? existing.loanSettlementAccountId : null,
    });

    const updated = await db.transactions.get(transactionId);
    if (!updated) throw new Error('Failed to update transaction');
    return {
      ...updated,
      settlements: (updated.settlements ?? []).map((s) => ({
        ...s,
        date: s.date instanceof Date ? s.date : new Date(s.date),
      })),
    };
  }

  async getAccounts(): Promise<Account[]> {
    return await db.accounts.orderBy('id').toArray();
  }

  async getAccount(id: number): Promise<Account | undefined> {
    return await db.accounts.get(id);
  }

  async createAccount(account: Omit<Account, 'id'>): Promise<Account> {
    const normalized = { ...account, balance: toMoneyString(Number(account.balance || 0)) };
    const id = await db.accounts.add(normalized as Account);
    const created = await db.accounts.get(id);
    if (!created) {
      throw new Error('Failed to create account');
    }
    return created;
  }

  async updateAccount(id: number, updates: Partial<Omit<Account, 'id'>>): Promise<Account> {
    const normalized = {
      ...updates,
      ...(updates.balance !== undefined ? { balance: toMoneyString(Number(updates.balance || 0)) } : {}),
    };
    await db.accounts.update(id, normalized);
    const updated = await db.accounts.get(id);
    if (!updated) {
      throw new Error('Account not found');
    }
    return updated;
  }

  async deleteAccount(id: number): Promise<void> {
    const account = await db.accounts.get(id);
    if (!account) {
      throw new Error('Account not found');
    }
    const directCount = await db.transactions.where('accountId').equals(id).count();
    const settlementCount = await db.transactions.where('loanSettlementAccountId').equals(id).count();
    const nameCount = await db.transactions.where('paymentMethod').equals(account.name).count();
    if (directCount > 0 || settlementCount > 0 || nameCount > 0) {
      throw new Error('Account has linked transactions. Remove or edit those transactions first.');
    }
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

    const fromBalance = roundMoney(Number(from.balance || 0) - parsedAmount);
    const toBalance = roundMoney(Number(to.balance || 0) + parsedAmount);

    await this.updateAccount(fromAccountId, { balance: toMoneyString(fromBalance) });
    await this.updateAccount(toAccountId, { balance: toMoneyString(toBalance) });

    await db.transfers.add({
      fromAccountId,
      toAccountId,
      amount: toMoneyString(parsedAmount),
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

  async importData(data: { settings: Settings; categories: Category[]; transactions: Transaction[]; accounts?: Account[]; transfers?: Transfer[] }): Promise<void> {
    const hasAccounts = Array.isArray(data.accounts) && data.accounts.length > 0;
    const oldAccountIdToName = new Map<number, string>();
    const nameToAccountId = new Map<string, number>();

    if (data.settings) {
      await this.updateSettings({
        currencySymbol: data.settings.currencySymbol,
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

        // Remap settlement accountIds
        const remappedSettlements: LoanSettlement[] = (Array.isArray(tx.settlements) ? tx.settlements : []).map((s) => {
          let sAccountId = s.accountId;
          if (oldAccountIdToName.has(sAccountId)) {
            const name = oldAccountIdToName.get(sAccountId)!;
            sAccountId = nameToAccountId.get(name) ?? sAccountId;
          }
          return {
            ...s,
            accountId: sAccountId,
            date: s.date instanceof Date ? s.date : new Date(s.date),
          };
        });

        await db.transactions.add({
          amount: tx.amount,
          categoryId: catId ?? null,
          categoryName: tx.categoryName ?? null,
          date: new Date(tx.date),
          settlementDate: tx.settlementDate ? new Date(tx.settlementDate) : null,
          paymentMethod: tx.paymentMethod || 'Cash',
          accountId,
          loanSettlementAccountId: settlementAccountId,
          counterparty: tx.counterparty ?? null,
          note: tx.note ?? null,
          tags: Array.isArray(tx.tags) ? tx.tags : [],
          type: tx.type ?? 'expense',
          loanType: tx.loanType ?? (tx.type === 'loan' ? (tx.categoryName?.toLowerCase().includes('borrow') ? 'borrow' : 'lend') : null),
          loanStatus: tx.loanStatus ?? (tx.type === 'loan' ? 'open' : null),
          settlements: remappedSettlements,
        } as Transaction);
      }
    }

    if (data.transfers && data.transfers.length > 0) {
      const accounts = await db.accounts.toArray();
      for (const account of accounts) {
        if (account.id !== undefined) {
          nameToAccountId.set(account.name, account.id);
        }
      }

      for (const item of data.transfers) {
        let fromAccountId = item.fromAccountId;
        if (oldAccountIdToName.has(fromAccountId)) {
          const fromName = oldAccountIdToName.get(fromAccountId)!;
          fromAccountId = nameToAccountId.get(fromName) ?? fromAccountId;
        }

        let toAccountId = item.toAccountId;
        if (oldAccountIdToName.has(toAccountId)) {
          const toName = oldAccountIdToName.get(toAccountId)!;
          toAccountId = nameToAccountId.get(toName) ?? toAccountId;
        }

        const fromExists = await db.accounts.get(fromAccountId);
        const toExists = await db.accounts.get(toAccountId);
        if (!fromExists || !toExists) continue;

        await db.transfers.add({
          fromAccountId,
          toAccountId,
          amount: String(item.amount ?? '0'),
          note: item.note ?? null,
          date: item.date instanceof Date ? item.date : new Date(item.date),
        });
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
        balanceMap.set(tx.accountId, roundMoney(current + this.getBalanceDelta(tx)));
        // New-style settlements
        if (tx.settlements && tx.settlements.length > 0) {
          const impact = this.getSettlementsImpactByAccount(tx);
          for (const [accId, delta] of impact.entries()) {
            const cur = balanceMap.get(accId) ?? 0;
            balanceMap.set(accId, roundMoney(cur + delta));
          }
        } else if (tx.loanSettlementAccountId) {
          const settleCurrent = balanceMap.get(tx.loanSettlementAccountId) ?? 0;
          balanceMap.set(tx.loanSettlementAccountId, roundMoney(settleCurrent + this.getSettlementDelta(tx)));
        }
      }
      for (const [id, balance] of balanceMap.entries()) {
        await this.updateAccount(id, { balance: toMoneyString(balance) });
      }
    }
  }

  async resetAllData(): Promise<void> {
    await db.settings.clear();
    await db.categories.clear();
    await db.transactions.clear();
    await db.accounts.clear();
    await db.transfers.clear();

    await initializeDatabase();
  }
}

export const storage = new LocalStorage();
