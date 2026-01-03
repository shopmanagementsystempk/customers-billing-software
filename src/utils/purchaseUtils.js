import { collection, addDoc, getDocs, query, where, writeBatch, doc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { addStockItem, addStockToItem } from './stockUtils';

const purchaseCollection = 'purchaseOrders';

const normalizeNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const MAX_ITEMS_IN_MAIN_DOC = 500;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

export const createPurchaseOrder = async (shopId, purchasePayload) => {
  if (!shopId) {
    throw new Error('Shop ID is required to create a purchase order');
  }

  const { items = [], supplier = '', invoiceNumber = '', purchaseDate, note = '', reference = '' } = purchasePayload || {};
  if (!items.length) {
    throw new Error('Add at least one item to the purchase');
  }

  const stockCollectionRef = collection(db, 'stock');
  const movementCollectionRef = collection(db, 'stockMovements');
  const purchaseCollectionRef = collection(db, purchaseCollection);

  const preparedItems = [];
  const stockUpdates = new Map(); // itemId -> { quantityToAdd, fields }
  const operations = []; // Array of { type: 'set'|'update', ref, data }

  const pDate = purchaseDate || new Date().toISOString();
  let totalCost = 0;

  // 1. Process all items
  for (const item of items) {
    const normalizedQuantity = normalizeNumber(item.quantity, 0);
    const normalizedCostPrice =
      item.costPrice !== undefined && item.costPrice !== '' ? normalizeNumber(item.costPrice, null) : null;

    totalCost += (normalizedQuantity * (normalizedCostPrice || 0));

    const normalizedLowStockAlert = item.lowStockAlert !== undefined && item.lowStockAlert !== '' && item.lowStockAlert !== null
      ? normalizeNumber(item.lowStockAlert, null)
      : null;

    if (item.sourceItemId) {
      // --- Existing Item ---
      const currentUpdate = stockUpdates.get(item.sourceItemId) || { quantity: 0, fields: {} };
      currentUpdate.quantity += normalizedQuantity;

      const updateFields = { updatedAt: new Date().toISOString() };
      if (item.expiryDate) updateFields.expiryDate = item.expiryDate;
      updateFields.purchaseDate = pDate;
      if (normalizedLowStockAlert !== null) updateFields.lowStockAlert = normalizedLowStockAlert;

      if (item.storeName) updateFields.storeName = item.storeName;
      if (item.companyName) updateFields.companyName = item.companyName;

      currentUpdate.fields = { ...currentUpdate.fields, ...updateFields };
      stockUpdates.set(item.sourceItemId, currentUpdate);

      const moveRef = doc(movementCollectionRef);
      operations.push({
        type: 'set',
        ref: moveRef,
        data: {
          shopId,
          itemId: item.sourceItemId,
          itemName: item.name || '',
          type: 'IN',
          quantity: normalizedQuantity,
          unit: item.unit || 'units',
          costPrice: normalizedCostPrice !== null ? normalizedCostPrice : undefined,
          supplier: supplier?.trim() || item.supplier?.trim() || '',
          reference: reference?.trim() || '',
          purchaseDate: pDate,
          expiryDate: item.expiryDate || null,
          createdAt: new Date().toISOString()
        }
      });

      preparedItems.push({
        ...item,
        stockItemId: item.sourceItemId,
        quantity: normalizedQuantity,
        costPrice: normalizedCostPrice ?? 0,
        sellingPrice: item.sellingPrice !== undefined && item.sellingPrice !== '' ? normalizeNumber(item.sellingPrice, 0) : null,
        unit: item.unit || 'units',
        expiryDate: item.expiryDate || null,
        existingItem: true
      });

    } else {
      // --- New Item ---
      const newStockRef = doc(stockCollectionRef);
      const stockPayload = {
        shopId,
        name: item.name?.trim() || 'Unnamed Item',
        description: item.description?.trim() || '',
        category: item.category?.trim() || '',
        price: normalizeNumber(item.sellingPrice, 0),
        quantity: normalizedQuantity,
        quantityUnit: item.unit || 'units',
        costPrice: normalizedCostPrice,
        supplier: supplier?.trim() || item.supplier?.trim() || '',
        sku: item.sku?.trim() || '',
        expiryDate: item.expiryDate || null,
        lowStockAlert: normalizedLowStockAlert,
        storeName: item.storeName?.trim() || '',
        companyName: item.companyName?.trim() || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      operations.push({ type: 'set', ref: newStockRef, data: stockPayload });

      preparedItems.push({
        ...item,
        stockItemId: newStockRef.id,
        quantity: normalizedQuantity,
        costPrice: normalizedCostPrice ?? 0,
        sellingPrice: item.sellingPrice !== undefined && item.sellingPrice !== '' ? normalizeNumber(item.sellingPrice, 0) : null,
        unit: item.unit || 'units',
        expiryDate: item.expiryDate || null,
        existingItem: false
      });
    }
  }

  // 2. Convert aggregations to operations
  stockUpdates.forEach((value, itemId) => {
    const stockRef = doc(db, 'stock', itemId);
    const payload = {
      ...value.fields,
      quantity: increment(value.quantity)
    };
    operations.push({ type: 'update', ref: stockRef, data: payload });
  });

  try {
    // 3. Execute Stock & Movement Batches (SEQUENTIAL + THROTTLED)
    const BATCH_SIZE = 250;
    const opChunks = [];
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
      opChunks.push(operations.slice(i, i + BATCH_SIZE));
    }

    for (let i = 0; i < opChunks.length; i++) {
      const chunk = opChunks[i];
      const batch = writeBatch(db);
      chunk.forEach(op => {
        if (op.type === 'set') batch.set(op.ref, op.data);
        else if (op.type === 'update') batch.update(op.ref, op.data);
      });

      await batch.commit();

      // Artificial Delay to avoid rate limiting
      if (i < opChunks.length - 1) {
        await delay(300);
      }
    }

    // 4. Save Purchase Order
    const isLargeOrder = preparedItems.length > MAX_ITEMS_IN_MAIN_DOC;

    const payload = {
      shopId,
      supplier: supplier?.trim() || '',
      invoiceNumber: invoiceNumber?.trim() || '',
      purchaseDate: pDate,
      note: note?.trim() || '',
      reference: reference?.trim() || '',
      createdAt: new Date().toISOString(),
      totalCost,
      totalItems: preparedItems.length,
      isLargeOrder,
      items: isLargeOrder ? [] : preparedItems
    };

    const docRef = await addDoc(purchaseCollectionRef, payload);

    // 5. If large order, save items to subcollection (SEQUENTIAL + THROTTLED)
    if (isLargeOrder) {
      const itemsSubRef = collection(docRef, 'items');
      const itemChunks = [];
      for (let i = 0; i < preparedItems.length; i += BATCH_SIZE) {
        itemChunks.push(preparedItems.slice(i, i + BATCH_SIZE));
      }

      for (let i = 0; i < itemChunks.length; i++) {
        const chunk = itemChunks[i];
        const batch = writeBatch(db);
        chunk.forEach(item => {
          const ref = doc(itemsSubRef);
          batch.set(ref, item);
        });

        await batch.commit();
        if (i < itemChunks.length - 1) {
          await delay(300);
        }
      }
    }

    return { id: docRef.id, ...payload };

  } catch (error) {
    console.error("Purchase Creation Error:", error);
    if (error.code === 'resource-exhausted') {
      throw new Error("Daily Write Quota Exceeded. You have hit the limit of Firestore writes for today. Please wait for the quota to reset or upgrade your Firebase plan.");
    }
    throw error;
  }
};

export const getPurchaseOrderItems = async (purchaseId) => {
  if (!purchaseId) return [];
  const itemsRef = collection(db, purchaseCollection, purchaseId, 'items');
  const snapshot = await getDocs(itemsRef);
  return snapshot.docs.map(doc => doc.data());
};

export const getPurchaseOrders = async (shopId) => {
  if (!shopId) return [];
  const purchaseRef = collection(db, purchaseCollection);
  const q = query(purchaseRef, where('shopId', '==', shopId));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return list.sort((a, b) => new Date(b.purchaseDate || b.createdAt) - new Date(a.purchaseDate || a.createdAt));
};
