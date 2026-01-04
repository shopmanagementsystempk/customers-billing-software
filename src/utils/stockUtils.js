import { collection, addDoc, getDocs, doc, getDoc, updateDoc, deleteDoc, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase/config';

// Mock data for testing/fallback
const MOCK_STOCK = [
  {
    id: 'mock-item-1',
    name: 'Sample Product 1',
    description: 'This is a sample product',
    category: 'General',
    price: 19.99,
    quantity: 25,
    costPrice: 15.00,
    shopId: 'test-shop-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'mock-item-2',
    name: 'Sample Product 2',
    description: 'Another sample product',
    category: 'Electronics',
    price: 29.99,
    quantity: 10,
    costPrice: 25.00,
    shopId: 'test-shop-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }
];

// Add a new stock item
export const addStockItem = async (shopId, itemData) => {
  try {
    console.log('Adding stock item for shop ID:', shopId);

    if (!shopId) {
      console.error('No shop ID provided for addStockItem');
      throw new Error('Shop ID is required to add stock item');
    }

    const stockRef = collection(db, 'stock');
    const docRef = await addDoc(stockRef, {
      shopId,
      ...itemData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    console.log('Stock item added with ID:', docRef.id);
    return docRef.id;
  } catch (error) {
    console.error('Error adding stock item:', error);
    console.error('Error details:', error.code, error.message);
    throw error;
  }
};

// Get all stock items for a shop
export const getShopStock = async (shopId) => {
  try {
    console.log(`Fetching stock items for shop ID: ${shopId}`);

    if (!shopId) {
      console.error('No shop ID provided for getShopStock');
      return [];
    }

    const stockRef = collection(db, 'stock');
    const q = query(stockRef, where('shopId', '==', shopId));

    console.log('Executing Firestore query...');
    const querySnapshot = await getDocs(q);
    console.log(`Query returned ${querySnapshot.docs.length} results`);

    const items = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return items;
  } catch (error) {
    console.error('Error fetching stock items:', error);
    console.error('Error details:', error.code, error.message);
    // Return empty array instead of throwing to avoid loading state getting stuck
    return [];
  }
};

// Get a single stock item by ID
export const getStockItemById = async (itemId) => {
  try {
    const stockRef = doc(db, 'stock', itemId);
    const stockSnap = await getDoc(stockRef);

    if (stockSnap.exists()) {
      return {
        id: stockSnap.id,
        ...stockSnap.data()
      };
    } else {
      throw new Error('Stock item not found');
    }
  } catch (error) {
    console.error('Error fetching stock item:', error);
    throw error;
  }
};

// Update a stock item
export const updateStockItem = async (itemId, updateData) => {
  try {
    const stockRef = doc(db, 'stock', itemId);
    await updateDoc(stockRef, {
      ...updateData,
      updatedAt: new Date().toISOString()
    });
    return itemId;
  } catch (error) {
    console.error('Error updating stock item:', error);
    throw error;
  }
};

// Delete a stock item
export const deleteStockItem = async (itemId) => {
  try {
    const stockRef = doc(db, 'stock', itemId);
    await deleteDoc(stockRef);
    return true;
  } catch (error) {
    console.error('Error deleting stock item:', error);
    throw error;
  }
};

// Update stock quantity when a sale is made (optimized)
export const updateStockQuantity = async (shopId, items) => {
  try {
    if (!items || items.length === 0) {
      return true; // Nothing to update
    }

    const stockRef = collection(db, 'stock');
    const q = query(stockRef, where('shopId', '==', shopId));
    const querySnapshot = await getDocs(q);

    const stockItems = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Create a map for faster lookup (O(1) instead of O(n))
    const stockMap = {};
    stockItems.forEach(item => {
      stockMap[item.name] = item;
    });

    // Process each sold item and prepare updates
    const updates = [];
    items.forEach(soldItem => {
      const stockItem = stockMap[soldItem.name];

      if (stockItem) {
        // Make sure units match before deducting (both should be in the same unit)
        // If units don't match, we can't properly deduct
        if (!soldItem.quantityUnit || soldItem.quantityUnit === stockItem.quantityUnit) {
          const newQuantity = Math.max(0, (stockItem.quantity || 0) - (soldItem.quantity || 0));
          updates.push(updateStockItem(stockItem.id, { quantity: newQuantity }));
        }
      }
    });

    // Execute all updates in parallel
    if (updates.length > 0) {
      await Promise.all(updates);
    }

    return true;
  } catch (error) {
    console.error('Error updating stock quantities:', error);
    throw error;
  }
};

// Restore stock quantity when a receipt is deleted
export const restoreStockQuantity = async (shopId, items) => {
  try {
    const stockRef = collection(db, 'stock');
    const q = query(stockRef, where('shopId', '==', shopId));
    const querySnapshot = await getDocs(q);

    const stockItems = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Process each item to restore
    const updates = items.map(receiptItem => {
      const stockItem = stockItems.find(item => item.name === receiptItem.name);

      if (stockItem) {
        // Make sure units match before adding (both should be in the same unit)
        if (!receiptItem.quantityUnit || receiptItem.quantityUnit === stockItem.quantityUnit) {
          const newQuantity = stockItem.quantity + parseFloat(receiptItem.quantity) + parseFloat(receiptItem.bonus || 0);
          return updateStockItem(stockItem.id, { quantity: newQuantity });
        }
      }

      return Promise.resolve();
    });

    await Promise.all(updates);
    return true;
  } catch (error) {
    console.error('Error restoring stock quantities:', error);
    throw error;
  }
};

// Record a stock movement (IN/OUT) for history
export const recordStockMovement = async (movement) => {
  // movement: { shopId, itemId, itemName, type: 'IN'|'OUT', quantity, unit, costPrice?, note?, supplier?, reference?, createdAt? }
  const movementsRef = collection(db, 'stockMovements');
  const payload = {
    ...movement,
    createdAt: movement.createdAt || new Date().toISOString()
  };
  const docRef = await addDoc(movementsRef, payload);
  return docRef.id;
};

// Add stock to an existing item and record movement
export const addStockToItem = async (shopId, itemId, quantityToAdd, options = {}) => {
  // options: { costPrice, note, supplier, itemSnapshot }
  const stockDocRef = doc(db, 'stock', itemId);
  const snap = options.itemSnapshot || await getDoc(stockDocRef);
  if (!snap.exists()) throw new Error('Stock item not found');
  const item = { id: snap.id, ...snap.data() };
  const newQuantity = (parseFloat(item.quantity) || 0) + parseFloat(quantityToAdd || 0);
  const updatePayload = { quantity: newQuantity, updatedAt: new Date().toISOString() };
  if (options.expiryDate) {
    updatePayload.expiryDate = options.expiryDate;
  }
  if (options.purchaseDate) {
    updatePayload.purchaseDate = options.purchaseDate;
  }
  if (options.lowStockAlert !== undefined && options.lowStockAlert !== null) {
    updatePayload.lowStockAlert = parseFloat(options.lowStockAlert);
  }
  if (options.storeName) updatePayload.storeName = options.storeName;
  if (options.companyName) updatePayload.companyName = options.companyName;

  await updateDoc(stockDocRef, updatePayload);
  await recordStockMovement({
    shopId,
    itemId,
    itemName: item.name,
    type: 'IN',
    quantity: parseFloat(quantityToAdd || 0),
    unit: item.quantityUnit || 'units',
    costPrice: options.costPrice != null ? parseFloat(options.costPrice) : undefined,
    note: options.note || '',
    supplier: options.supplier || '',
    reference: options.reference || '',
    expiryDate: options.expiryDate || null,
    purchaseDate: options.purchaseDate || null
  });
  return { itemId, newQuantity };
};

// Fetch stock movements for a shop (optionally filtered by itemId)
export const getStockMovements = async (shopId, itemId) => {
  const movementsRef = collection(db, 'stockMovements');
  let q = query(movementsRef, where('shopId', '==', shopId));
  const all = await getDocs(q);
  const list = all.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(m => (itemId ? m.itemId === itemId : true))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return list;
};

// Delete ALL stock items for a shop
export const deleteAllShopStock = async (shopId) => {
  try {
    const stockRef = collection(db, 'stock');
    const q = query(stockRef, where('shopId', '==', shopId));
    const snapshot = await getDocs(q);

    if (snapshot.empty) return 0;

    const BATCH_SIZE = 450;
    const chunks = [];
    for (let i = 0; i < snapshot.docs.length; i += BATCH_SIZE) {
      chunks.push(snapshot.docs.slice(i, i + BATCH_SIZE));
    }

    let count = 0;
    for (const chunk of chunks) {
      const chunkBatch = writeBatch(db);
      for (const doc of chunk) {
        chunkBatch.delete(doc.ref);
        count++;
      }
      await chunkBatch.commit();
    }

    return count;
  } catch (error) {
    console.error('Error deleting all stock items:', error);
    throw error;
  }
};
