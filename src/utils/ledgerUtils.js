import { collection, addDoc, getDocs, getDoc, updateDoc, doc, query, where, orderBy, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

// ============ LEDGER ACCOUNTS ============

// Get all ledger accounts for a shop
export const getLedgerAccounts = async (shopId) => {
  try {
    const accountsRef = collection(db, 'ledgerAccounts');
    const q = query(
      accountsRef, 
      where('shopId', '==', shopId),
      orderBy('accountType', 'asc'),
      orderBy('accountName', 'asc')
    );
    
    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    return accounts;
  } catch (error) {
    // Fallback if index not created
    console.log('Index not created yet, falling back to basic query');
    const accountsRef = collection(db, 'ledgerAccounts');
    const q = query(accountsRef, where('shopId', '==', shopId));
    
    const querySnapshot = await getDocs(q);
    const accounts = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Sort client-side
    accounts.sort((a, b) => {
      if (a.accountType !== b.accountType) {
        return a.accountType.localeCompare(b.accountType);
      }
      return a.accountName.localeCompare(b.accountName);
    });
    
    return accounts;
  }
};

// Get a single ledger account by ID
export const getLedgerAccountById = async (accountId) => {
  try {
    const accountRef = doc(db, 'ledgerAccounts', accountId);
    const accountSnap = await getDoc(accountRef);
    
    if (accountSnap.exists()) {
      return {
        id: accountSnap.id,
        ...accountSnap.data()
      };
    } else {
      throw new Error('Ledger account not found');
    }
  } catch (error) {
    console.error('Error fetching ledger account:', error);
    throw error;
  }
};

// Add a new ledger account
export const addLedgerAccount = async (accountData) => {
  try {
    const accountsRef = collection(db, 'ledgerAccounts');
    const docRef = await addDoc(accountsRef, {
      ...accountData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding ledger account:', error);
    throw error;
  }
};

// Update a ledger account
export const updateLedgerAccount = async (accountId, updateData) => {
  try {
    const accountRef = doc(db, 'ledgerAccounts', accountId);
    await updateDoc(accountRef, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    return accountId;
  } catch (error) {
    console.error('Error updating ledger account:', error);
    throw error;
  }
};

// Delete a ledger account
export const deleteLedgerAccount = async (accountId, shopId) => {
  try {
    // Check if account has any entries
    const entries = await getLedgerEntriesByAccount(accountId, shopId);
    if (entries.length > 0) {
      throw new Error('Cannot delete account with existing entries');
    }
    
    const accountRef = doc(db, 'ledgerAccounts', accountId);
    await deleteDoc(accountRef);
    return true;
  } catch (error) {
    console.error('Error deleting ledger account:', error);
    throw error;
  }
};

// Initialize default ledger accounts for a shop
export const initializeDefaultAccounts = async (shopId) => {
  const defaultAccounts = [
    // Assets
    { accountName: 'Cash', accountType: 'Asset', shopId, openingBalance: 0, description: 'Cash in hand' },
    { accountName: 'Bank Account', accountType: 'Asset', shopId, openingBalance: 0, description: 'Bank account balance' },
    { accountName: 'Accounts Receivable', accountType: 'Asset', shopId, openingBalance: 0, description: 'Money owed by customers' },
    { accountName: 'Inventory', accountType: 'Asset', shopId, openingBalance: 0, description: 'Stock inventory value' },
    
    // Liabilities
    { accountName: 'Accounts Payable', accountType: 'Liability', shopId, openingBalance: 0, description: 'Money owed to suppliers' },
    { accountName: 'Loans Payable', accountType: 'Liability', shopId, openingBalance: 0, description: 'Outstanding loans' },
    
    // Income
    { accountName: 'Sales Revenue', accountType: 'Income', shopId, openingBalance: 0, description: 'Revenue from sales' },
    { accountName: 'Other Income', accountType: 'Income', shopId, openingBalance: 0, description: 'Miscellaneous income' },
    
    // Expenses
    { accountName: 'Operating Expenses', accountType: 'Expense', shopId, openingBalance: 0, description: 'General operating expenses' },
    { accountName: 'Salaries', accountType: 'Expense', shopId, openingBalance: 0, description: 'Employee salaries' },
    { accountName: 'Rent', accountType: 'Expense', shopId, openingBalance: 0, description: 'Rent expenses' },
    { accountName: 'Utilities', accountType: 'Expense', shopId, openingBalance: 0, description: 'Utility bills' },
  ];

  try {
    const existingAccounts = await getLedgerAccounts(shopId);
    if (existingAccounts.length > 0) {
      return; // Accounts already initialized
    }

    const accountsRef = collection(db, 'ledgerAccounts');
    const promises = defaultAccounts.map(account => 
      addDoc(accountsRef, {
        ...account,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
    );
    
    await Promise.all(promises);
    return true;
  } catch (error) {
    console.error('Error initializing default accounts:', error);
    throw error;
  }
};

// ============ LEDGER ENTRIES ============

// Get all ledger entries for a shop
export const getLedgerEntries = async (shopId, filters = {}) => {
  try {
    const entriesRef = collection(db, 'ledgerEntries');
    let q;
    
    try {
      if (filters.accountId) {
        q = query(
          entriesRef,
          where('shopId', '==', shopId),
          where('debitAccountId', '==', filters.accountId),
          orderBy('entryDate', 'desc')
        );
      } else {
        q = query(
          entriesRef,
          where('shopId', '==', shopId),
          orderBy('entryDate', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      let entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter by credit account if needed (client-side)
      if (filters.accountId) {
        entries = entries.filter(entry => 
          entry.debitAccountId === filters.accountId || 
          entry.creditAccountId === filters.accountId
        );
      }
      
      return entries;
    } catch (indexError) {
      console.log('Index not created yet, falling back to basic query');
      q = query(entriesRef, where('shopId', '==', shopId));
      
      const querySnapshot = await getDocs(q);
      let entries = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Filter client-side
      if (filters.accountId) {
        entries = entries.filter(entry => 
          entry.debitAccountId === filters.accountId || 
          entry.creditAccountId === filters.accountId
        );
      }
      
      // Sort client-side
      entries.sort((a, b) => {
        return new Date(b.entryDate) - new Date(a.entryDate);
      });
      
      return entries;
    }
  } catch (error) {
    console.error('Error fetching ledger entries:', error);
    throw error;
  }
};

// Get ledger entries by account ID
export const getLedgerEntriesByAccount = async (accountId, shopId) => {
  try {
    const entriesRef = collection(db, 'ledgerEntries');
    const q = query(entriesRef, where('shopId', '==', shopId));
    
    const querySnapshot = await getDocs(q);
    const entries = querySnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(entry => 
        entry.debitAccountId === accountId || entry.creditAccountId === accountId
      );
    
    return entries;
  } catch (error) {
    console.error('Error fetching ledger entries by account:', error);
    throw error;
  }
};

// Get a single ledger entry by ID
export const getLedgerEntryById = async (entryId) => {
  try {
    const entryRef = doc(db, 'ledgerEntries', entryId);
    const entrySnap = await getDoc(entryRef);
    
    if (entrySnap.exists()) {
      return {
        id: entrySnap.id,
        ...entrySnap.data()
      };
    } else {
      throw new Error('Ledger entry not found');
    }
  } catch (error) {
    console.error('Error fetching ledger entry:', error);
    throw error;
  }
};

// Add a new ledger entry
export const addLedgerEntry = async (entryData) => {
  try {
    // Validate that debit and credit accounts are different
    if (entryData.debitAccountId === entryData.creditAccountId) {
      throw new Error('Debit and credit accounts cannot be the same');
    }
    
    // Validate that amount is positive
    if (parseFloat(entryData.amount) <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    
    const entriesRef = collection(db, 'ledgerEntries');
    const docRef = await addDoc(entriesRef, {
      ...entryData,
      amount: parseFloat(entryData.amount),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    return docRef.id;
  } catch (error) {
    console.error('Error adding ledger entry:', error);
    throw error;
  }
};

// Update a ledger entry
export const updateLedgerEntry = async (entryId, updateData) => {
  try {
    // Validate that debit and credit accounts are different
    if (updateData.debitAccountId === updateData.creditAccountId) {
      throw new Error('Debit and credit accounts cannot be the same');
    }
    
    // Validate that amount is positive
    if (updateData.amount && parseFloat(updateData.amount) <= 0) {
      throw new Error('Amount must be greater than zero');
    }
    
    const entryRef = doc(db, 'ledgerEntries', entryId);
    await updateDoc(entryRef, {
      ...updateData,
      amount: updateData.amount ? parseFloat(updateData.amount) : undefined,
      updatedAt: new Date().toISOString()
    });
    return entryId;
  } catch (error) {
    console.error('Error updating ledger entry:', error);
    throw error;
  }
};

// Delete a ledger entry
export const deleteLedgerEntry = async (entryId) => {
  try {
    const entryRef = doc(db, 'ledgerEntries', entryId);
    await deleteDoc(entryRef);
    return true;
  } catch (error) {
    console.error('Error deleting ledger entry:', error);
    throw error;
  }
};

// Calculate account balance
export const calculateAccountBalance = async (accountId, shopId) => {
  try {
    const entries = await getLedgerEntries(shopId);
    const account = await getLedgerAccountById(accountId);
    
    let balance = parseFloat(account.openingBalance || 0);
    
    entries.forEach(entry => {
      if (entry.debitAccountId === accountId) {
        // Debit increases assets/expenses, decreases liabilities/income
        if (account.accountType === 'Asset' || account.accountType === 'Expense') {
          balance += parseFloat(entry.amount || 0);
        } else {
          balance -= parseFloat(entry.amount || 0);
        }
      } else if (entry.creditAccountId === accountId) {
        // Credit decreases assets/expenses, increases liabilities/income
        if (account.accountType === 'Asset' || account.accountType === 'Expense') {
          balance -= parseFloat(entry.amount || 0);
        } else {
          balance += parseFloat(entry.amount || 0);
        }
      }
    });
    
    return balance;
  } catch (error) {
    console.error('Error calculating account balance:', error);
    throw error;
  }
};

// Calculate balances for all accounts in a single pass (optimized)
// This function is exported so it can be used in other files if needed
export const calculateAllAccountBalances = (accounts, entries) => {
  const balances = {};
  
  // Initialize balances with opening balances
  accounts.forEach(account => {
    balances[account.id] = parseFloat(account.openingBalance || 0);
  });
  
  // Create a map for faster account lookup (O(1) instead of O(n))
  const accountMap = {};
  accounts.forEach(account => {
    accountMap[account.id] = account;
  });
  
  // Process all entries in a single pass
  entries.forEach(entry => {
    const amount = parseFloat(entry.amount || 0);
    
    // Process debit account
    if (entry.debitAccountId && accountMap[entry.debitAccountId]) {
      const debitAccount = accountMap[entry.debitAccountId];
      if (debitAccount.accountType === 'Asset' || debitAccount.accountType === 'Expense') {
        balances[debitAccount.id] += amount;
      } else {
        balances[debitAccount.id] -= amount;
      }
    }
    
    // Process credit account
    if (entry.creditAccountId && accountMap[entry.creditAccountId]) {
      const creditAccount = accountMap[entry.creditAccountId];
      if (creditAccount.accountType === 'Asset' || creditAccount.accountType === 'Expense') {
        balances[creditAccount.id] -= amount;
      } else {
        balances[creditAccount.id] += amount;
      }
    }
  });
  
  return balances;
};

// Get ledger statistics (optimized version)
export const getLedgerStatistics = async (shopId) => {
  try {
    // Fetch accounts and entries in parallel
    const [accounts, entries] = await Promise.all([
      getLedgerAccounts(shopId),
      getLedgerEntries(shopId)
    ]);
    
    // Calculate balances for all accounts in a single pass (much faster!)
    const accountBalances = calculateAllAccountBalances(accounts, entries);
    
    // Group accounts by type
    const accountsByType = {
      Asset: accounts.filter(a => a.accountType === 'Asset'),
      Liability: accounts.filter(a => a.accountType === 'Liability'),
      Income: accounts.filter(a => a.accountType === 'Income'),
      Expense: accounts.filter(a => a.accountType === 'Expense')
    };
    
    // Calculate totals by type
    const totalsByType = {
      Asset: accountsByType.Asset.reduce((sum, acc) => sum + (accountBalances[acc.id] || 0), 0),
      Liability: accountsByType.Liability.reduce((sum, acc) => sum + (accountBalances[acc.id] || 0), 0),
      Income: accountsByType.Income.reduce((sum, acc) => sum + (accountBalances[acc.id] || 0), 0),
      Expense: accountsByType.Expense.reduce((sum, acc) => sum + (accountBalances[acc.id] || 0), 0)
    };
    
    // Calculate profit/loss
    const netIncome = totalsByType.Income - totalsByType.Expense;
    const totalEquity = totalsByType.Asset - totalsByType.Liability;
    
    return {
      totalAccounts: accounts.length,
      totalEntries: entries.length,
      accountsByType,
      totalsByType,
      accountBalances,
      netIncome,
      totalEquity
    };
  } catch (error) {
    console.error('Error getting ledger statistics:', error);
    throw error;
  }
};

// ============ AUTOMATIC LEDGER ENTRIES FROM SALES ============

// Get or create account by name and type (optimized - accepts pre-fetched accounts)
const getOrCreateAccount = async (shopId, accountName, accountType, accountsCache = null) => {
  try {
    // Use cached accounts if provided, otherwise fetch
    let accounts = accountsCache;
    if (!accounts) {
      accounts = await getLedgerAccounts(shopId);
    }
    
    let account = accounts.find(acc => 
      acc.accountName === accountName && acc.accountType === accountType
    );
    
    if (!account) {
      // Create account if it doesn't exist
      const accountId = await addLedgerAccount({
        shopId,
        accountName,
        accountType,
        openingBalance: 0,
        description: `Auto-created for ${accountType} tracking`
      });
      account = await getLedgerAccountById(accountId);
      // Add to cache if provided
      if (accountsCache) {
        accountsCache.push(account);
      }
    }
    
    return account;
  } catch (error) {
    console.error('Error getting or creating account:', error);
    throw error;
  }
};

// Create automatic ledger entry for a sale (optimized version)
export const createSaleLedgerEntry = async (receiptData) => {
  try {
    const { shopId, totalAmount, discount, paymentMethod, transactionId, items, timestamp } = receiptData;
    
    if (!shopId || !totalAmount) {
      console.warn('Missing required data for ledger entry');
      return null;
    }
    
    // Fetch all accounts once (instead of fetching 8+ times)
    const accountsCache = await getLedgerAccounts(shopId);
    
    // Get or create accounts in parallel (only the ones we need)
    const accountPromises = [
      getOrCreateAccount(shopId, 'Sales Revenue', 'Income', accountsCache),
      getOrCreateAccount(shopId, 'Cash', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Bank Account', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'UPI Payments', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Card Payments', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Wallet Payments', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Accounts Receivable', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Discounts Given', 'Expense', accountsCache)
    ];
    
    const [
      salesAccount,
      cashAccount,
      bankAccount,
      upiAccount,
      cardAccount,
      walletAccount,
      accountsReceivableAccount,
      discountAccount
    ] = await Promise.all(accountPromises);
    
    // Determine payment account based on payment method
    let paymentAccount;
    const paymentMethodLower = (paymentMethod || 'Cash').toLowerCase();
    
    if (paymentMethodLower.includes('cash')) {
      paymentAccount = cashAccount;
    } else if (paymentMethodLower.includes('card') || paymentMethodLower.includes('credit') || paymentMethodLower.includes('debit')) {
      paymentAccount = cardAccount;
    } else if (paymentMethodLower.includes('upi')) {
      paymentAccount = upiAccount;
    } else if (paymentMethodLower.includes('wallet')) {
      paymentAccount = walletAccount;
    } else if (paymentMethodLower.includes('bank') || paymentMethodLower.includes('transfer')) {
      paymentAccount = bankAccount;
    } else if (receiptData.isLoan || receiptData.loanAmount > 0) {
      paymentAccount = accountsReceivableAccount;
    } else {
      paymentAccount = cashAccount; // Default to cash
    }
    
    const entryDate = receiptData.date || receiptData.timestamp || new Date().toISOString().split('T')[0];
    const saleAmount = parseFloat(totalAmount) || 0;
    const discountAmount = parseFloat(discount) || 0;
    const netSaleAmount = saleAmount - discountAmount;
    
    // Prepare all entries to create
    const entriesToCreate = [];
    
    // Main sale entry: Debit Payment Account, Credit Sales Revenue
    entriesToCreate.push({
      shopId,
      entryDate,
      description: `Sale - Transaction ${transactionId || 'N/A'}`,
      debitAccountId: paymentAccount.id,
      creditAccountId: salesAccount.id,
      amount: netSaleAmount,
      reference: transactionId || '',
      paymentMethod: paymentMethod || 'Cash',
      transactionType: 'Sale',
      receiptId: receiptData.id || receiptData.receiptId || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    
    // Discount entry if discount exists
    if (discountAmount > 0) {
      entriesToCreate.push({
        shopId,
        entryDate,
        description: `Discount - Transaction ${transactionId || 'N/A'}`,
        debitAccountId: discountAccount.id,
        creditAccountId: salesAccount.id,
        amount: discountAmount,
        reference: transactionId || '',
        paymentMethod: paymentMethod || 'Cash',
        transactionType: 'Discount',
        receiptId: receiptData.id || receiptData.receiptId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    // COGS entry if cost prices are available
    if (items && items.length > 0) {
      const totalCost = items.reduce((sum, item) => {
        const costPrice = parseFloat(item.costPrice || 0);
        const quantity = parseFloat(item.quantity || 0);
        return sum + (costPrice * quantity);
      }, 0);
      
      if (totalCost > 0) {
        // Get inventory and COGS accounts (only if needed)
        const [inventoryAccount, cogsAccount] = await Promise.all([
          getOrCreateAccount(shopId, 'Inventory', 'Asset', accountsCache),
          getOrCreateAccount(shopId, 'Cost of Goods Sold', 'Expense', accountsCache)
        ]);
        
        entriesToCreate.push({
          shopId,
          entryDate,
          description: `COGS - Transaction ${transactionId || 'N/A'}`,
          debitAccountId: cogsAccount.id,
          creditAccountId: inventoryAccount.id,
          amount: totalCost,
          reference: transactionId || '',
          transactionType: 'COGS',
          receiptId: receiptData.id || receiptData.receiptId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
    }
    
    // Create all entries in parallel
    const entryPromises = entriesToCreate.map(entry => addLedgerEntry(entry));
    const entryIds = await Promise.all(entryPromises);
    
    return entryIds[0]; // Return the main sale entry ID
  } catch (error) {
    console.error('Error creating sale ledger entry:', error);
    // Don't throw - we don't want to break the sale process
    return null;
  }
};

// Create automatic ledger entry for a refund/return (optimized version)
export const createRefundLedgerEntry = async (returnData) => {
  try {
    const { shopId, returnAmount, originalReceipt, paymentMethod, transactionId, reason } = returnData;
    
    if (!shopId || !returnAmount) {
      console.warn('Missing required data for refund ledger entry');
      return null;
    }
    
    // Fetch all accounts once
    const accountsCache = await getLedgerAccounts(shopId);
    
    // Get or create accounts in parallel
    const accountPromises = [
      getOrCreateAccount(shopId, 'Sales Revenue', 'Income', accountsCache),
      getOrCreateAccount(shopId, 'Cash', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Bank Account', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'UPI Payments', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Card Payments', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Wallet Payments', 'Asset', accountsCache),
      getOrCreateAccount(shopId, 'Refunds', 'Expense', accountsCache)
    ];
    
    const [
      salesAccount,
      cashAccount,
      bankAccount,
      upiAccount,
      cardAccount,
      walletAccount,
      refundAccount
    ] = await Promise.all(accountPromises);
    
    // Determine payment account based on original payment method
    let paymentAccount;
    const paymentMethodLower = (paymentMethod || originalReceipt?.paymentMethod || 'Cash').toLowerCase();
    
    if (paymentMethodLower.includes('cash')) {
      paymentAccount = cashAccount;
    } else if (paymentMethodLower.includes('card') || paymentMethodLower.includes('credit') || paymentMethodLower.includes('debit')) {
      paymentAccount = cardAccount;
    } else if (paymentMethodLower.includes('upi')) {
      paymentAccount = upiAccount;
    } else if (paymentMethodLower.includes('wallet')) {
      paymentAccount = walletAccount;
    } else if (paymentMethodLower.includes('bank') || paymentMethodLower.includes('transfer')) {
      paymentAccount = bankAccount;
    } else {
      paymentAccount = cashAccount; // Default to cash
    }
    
    const entryDate = returnData.date || returnData.timestamp || new Date().toISOString().split('T')[0];
    const refundAmount = parseFloat(returnAmount) || 0;
    
    // Prepare entries to create
    const entriesToCreate = [
      {
        shopId,
        entryDate,
        description: `Refund - Transaction ${transactionId || originalReceipt?.transactionId || 'N/A'}${reason ? ` - ${reason}` : ''}`,
        debitAccountId: salesAccount.id,
        creditAccountId: paymentAccount.id,
        amount: refundAmount,
        reference: transactionId || originalReceipt?.transactionId || '',
        paymentMethod: paymentMethod || originalReceipt?.paymentMethod || 'Cash',
        transactionType: 'Refund',
        receiptId: originalReceipt?.id || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        shopId,
        entryDate,
        description: `Refund Expense - Transaction ${transactionId || originalReceipt?.transactionId || 'N/A'}`,
        debitAccountId: refundAccount.id,
        creditAccountId: paymentAccount.id,
        amount: refundAmount,
        reference: transactionId || originalReceipt?.transactionId || '',
        paymentMethod: paymentMethod || originalReceipt?.paymentMethod || 'Cash',
        transactionType: 'Refund',
        receiptId: originalReceipt?.id || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];
    
    // Create all entries in parallel
    const entryPromises = entriesToCreate.map(entry => addLedgerEntry(entry));
    const entryIds = await Promise.all(entryPromises);
    
    return entryIds[0]; // Return the main refund entry ID
  } catch (error) {
    console.error('Error creating refund ledger entry:', error);
    return null;
  }
};

// Create automatic ledger entry for a voided transaction
export const createVoidLedgerEntry = async (voidData) => {
  try {
    const { shopId, voidAmount, originalReceipt, reason } = voidData;
    
    if (!shopId || !voidAmount) {
      console.warn('Missing required data for void ledger entry');
      return null;
    }
    
    // Get or create accounts
    const salesAccount = await getOrCreateAccount(shopId, 'Sales Revenue', 'Income');
    const cashAccount = await getOrCreateAccount(shopId, 'Cash', 'Asset');
    const bankAccount = await getOrCreateAccount(shopId, 'Bank Account', 'Asset');
    const upiAccount = await getOrCreateAccount(shopId, 'UPI Payments', 'Asset');
    const cardAccount = await getOrCreateAccount(shopId, 'Card Payments', 'Asset');
    const walletAccount = await getOrCreateAccount(shopId, 'Wallet Payments', 'Asset');
    const voidAccount = await getOrCreateAccount(shopId, 'Voided Transactions', 'Expense');
    
    // Determine payment account based on original payment method
    let paymentAccount;
    const paymentMethod = originalReceipt?.paymentMethod || 'Cash';
    const paymentMethodLower = paymentMethod.toLowerCase();
    
    if (paymentMethodLower.includes('cash')) {
      paymentAccount = cashAccount;
    } else if (paymentMethodLower.includes('card') || paymentMethodLower.includes('credit') || paymentMethodLower.includes('debit')) {
      paymentAccount = cardAccount;
    } else if (paymentMethodLower.includes('upi')) {
      paymentAccount = upiAccount;
    } else if (paymentMethodLower.includes('wallet')) {
      paymentAccount = walletAccount;
    } else if (paymentMethodLower.includes('bank') || paymentMethodLower.includes('transfer')) {
      paymentAccount = bankAccount;
    } else {
      paymentAccount = cashAccount;
    }
    
    const entryDate = voidData.date || voidData.timestamp || new Date().toISOString().split('T')[0];
    const voidAmountValue = parseFloat(voidAmount) || 0;
    
    // Create void entry: Debit Sales Revenue, Credit Payment Account
    const voidEntry = {
      shopId,
      entryDate,
      description: `Void - Transaction ${originalReceipt?.transactionId || 'N/A'}${reason ? ` - ${reason}` : ''}`,
      debitAccountId: salesAccount.id,
      creditAccountId: paymentAccount.id,
      amount: voidAmountValue,
      reference: originalReceipt?.transactionId || '',
      paymentMethod: paymentMethod,
      transactionType: 'Void',
      receiptId: originalReceipt?.id || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    const voidEntryId = await addLedgerEntry(voidEntry);
    
    // Also create a void expense entry for tracking
    const voidExpenseEntry = {
      shopId,
      entryDate,
      description: `Void Expense - Transaction ${originalReceipt?.transactionId || 'N/A'}`,
      debitAccountId: voidAccount.id,
      creditAccountId: paymentAccount.id,
      amount: voidAmountValue,
      reference: originalReceipt?.transactionId || '',
      paymentMethod: paymentMethod,
      transactionType: 'Void',
      receiptId: originalReceipt?.id || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await addLedgerEntry(voidExpenseEntry);
    
    return voidEntryId;
  } catch (error) {
    console.error('Error creating void ledger entry:', error);
    return null;
  }
};

// ============ DAILY CLOSING AND RECONCILIATION ============

// Get daily closing summary
export const getDailyClosing = async (shopId, date) => {
  try {
    const closingDate = date || new Date().toISOString().split('T')[0];
    
    // Get all entries for the day
    const entries = await getLedgerEntries(shopId, {});
    const dayEntries = entries.filter(entry => entry.entryDate === closingDate);
    
    // Get accounts
    const accounts = await getLedgerAccounts(shopId);
    
    // Calculate totals by payment method
    const paymentMethodTotals = {};
    const transactionTypeTotals = {};
    
    dayEntries.forEach(entry => {
      const paymentMethod = entry.paymentMethod || 'Cash';
      const transactionType = entry.transactionType || 'Manual';
      
      if (!paymentMethodTotals[paymentMethod]) {
        paymentMethodTotals[paymentMethod] = { debit: 0, credit: 0 };
      }
      if (!transactionTypeTotals[transactionType]) {
        transactionTypeTotals[transactionType] = { count: 0, total: 0 };
      }
      
      // Determine if this entry affects the payment method account
      const paymentAccount = accounts.find(acc => 
        (acc.accountName === 'Cash' && paymentMethod.toLowerCase().includes('cash')) ||
        (acc.accountName === 'Card Payments' && paymentMethod.toLowerCase().includes('card')) ||
        (acc.accountName === 'UPI Payments' && paymentMethod.toLowerCase().includes('upi')) ||
        (acc.accountName === 'Wallet Payments' && paymentMethod.toLowerCase().includes('wallet')) ||
        (acc.accountName === 'Bank Account' && (paymentMethod.toLowerCase().includes('bank') || paymentMethod.toLowerCase().includes('transfer')))
      );
      
      if (paymentAccount) {
        if (entry.debitAccountId === paymentAccount.id) {
          paymentMethodTotals[paymentMethod].debit += parseFloat(entry.amount || 0);
        }
        if (entry.creditAccountId === paymentAccount.id) {
          paymentMethodTotals[paymentMethod].credit += parseFloat(entry.amount || 0);
        }
      }
      
      if (transactionType === 'Sale' || transactionType === 'Refund' || transactionType === 'Void') {
        transactionTypeTotals[transactionType].count++;
        if (transactionType === 'Sale') {
          transactionTypeTotals[transactionType].total += parseFloat(entry.amount || 0);
        } else {
          transactionTypeTotals[transactionType].total -= parseFloat(entry.amount || 0);
        }
      }
    });
    
    // Calculate net by payment method
    const netByPaymentMethod = {};
    Object.keys(paymentMethodTotals).forEach(method => {
      netByPaymentMethod[method] = paymentMethodTotals[method].debit - paymentMethodTotals[method].credit;
    });
    
    // Calculate total sales, refunds, discounts
    const salesTotal = transactionTypeTotals['Sale']?.total || 0;
    const refundsTotal = Math.abs(transactionTypeTotals['Refund']?.total || 0);
    const voidsTotal = Math.abs(transactionTypeTotals['Void']?.total || 0);
    const discountsTotal = dayEntries
      .filter(e => e.transactionType === 'Discount')
      .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
    
    return {
      date: closingDate,
      totalEntries: dayEntries.length,
      salesCount: transactionTypeTotals['Sale']?.count || 0,
      salesTotal,
      refundsCount: transactionTypeTotals['Refund']?.count || 0,
      refundsTotal,
      voidsCount: transactionTypeTotals['Void']?.count || 0,
      voidsTotal,
      discountsTotal,
      netSales: salesTotal - refundsTotal - voidsTotal - discountsTotal,
      paymentMethodTotals: netByPaymentMethod,
      transactionTypeTotals
    };
  } catch (error) {
    console.error('Error getting daily closing:', error);
    throw error;
  }
};

// Get accounting report data (optimized version)
export const getAccountingReport = async (shopId, startDate, endDate) => {
  try {
    // Fetch accounts and entries in parallel
    const [entries, accounts] = await Promise.all([
      getLedgerEntries(shopId, {}),
      getLedgerAccounts(shopId)
    ]);
    
    // Calculate all balances in a single pass (much faster!)
    const accountBalances = calculateAllAccountBalances(accounts, entries);
    
    // Filter entries by date range for payment method breakdown
    const filteredEntries = entries.filter(entry => {
      const entryDate = entry.entryDate;
      return (!startDate || entryDate >= startDate) && (!endDate || entryDate <= endDate);
    });
    
    // Group by account type
    const accountsByType = {
      Asset: accounts.filter(a => a.accountType === 'Asset'),
      Liability: accounts.filter(a => a.accountType === 'Liability'),
      Income: accounts.filter(a => a.accountType === 'Income'),
      Expense: accounts.filter(a => a.accountType === 'Expense')
    };
    
    // Calculate totals by type
    const totalsByType = {
      Asset: accountsByType.Asset.reduce((sum, acc) => sum + (accountBalances[acc.id] || 0), 0),
      Liability: accountsByType.Liability.reduce((sum, acc) => sum + (accountBalances[acc.id] || 0), 0),
      Income: accountsByType.Income.reduce((sum, acc) => sum + (accountBalances[acc.id] || 0), 0),
      Expense: accountsByType.Expense.reduce((sum, acc) => sum + (accountBalances[acc.id] || 0), 0)
    };
    
    // Calculate profit/loss
    const grossProfit = totalsByType.Income - totalsByType.Expense;
    const netIncome = totalsByType.Income - totalsByType.Expense;
    const totalEquity = totalsByType.Asset - totalsByType.Liability;
    
    // Payment method breakdown (only for filtered entries)
    const paymentMethodBreakdown = {};
    filteredEntries.forEach(entry => {
      const method = entry.paymentMethod || 'Cash';
      if (!paymentMethodBreakdown[method]) {
        paymentMethodBreakdown[method] = { count: 0, total: 0 };
      }
      paymentMethodBreakdown[method].count++;
      if (entry.transactionType === 'Sale') {
        paymentMethodBreakdown[method].total += parseFloat(entry.amount || 0);
      }
    });
    
    return {
      period: { startDate, endDate },
      totalEntries: filteredEntries.length,
      accountsByType,
      totalsByType,
      accountBalances,
      grossProfit,
      netIncome,
      totalEquity,
      paymentMethodBreakdown
    };
  } catch (error) {
    console.error('Error getting accounting report:', error);
    throw error;
  }
};

