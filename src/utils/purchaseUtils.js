import { collection, addDoc, getDocs, query, where, writeBatch, doc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { addStockItem, addStockToItem } from './stockUtils';

const purchaseCollection = 'purchaseOrders';

const normalizeNumber = (value, fallback = 0) => {
  const parsed = parseFloat(value);
  return Number.isNaN(parsed) ? fallback : parsed;
};

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

  // 1. Process all items
  for (const item of items) {
    const normalizedQuantity = normalizeNumber(item.quantity, 0);
    const normalizedCostPrice =
      item.costPrice !== undefined && item.costPrice !== '' ? normalizeNumber(item.costPrice, null) : null;

    const normalizedLowStockAlert = item.lowStockAlert !== undefined && item.lowStockAlert !== '' && item.lowStockAlert !== null
      ? normalizeNumber(item.lowStockAlert, null)
      : null;

    if (item.sourceItemId) {
      // --- Existing Item ---
      // Aggregate stock updates to prevent collision in batches
      const currentUpdate = stockUpdates.get(item.sourceItemId) || { quantity: 0, fields: {} };

      // Sum quantity
      currentUpdate.quantity += normalizedQuantity;

      // Merge other fields (Last one wins logic for metadata)
      const updateFields = { updatedAt: new Date().toISOString() };
      if (item.expiryDate) updateFields.expiryDate = item.expiryDate;
      updateFields.purchaseDate = pDate;
      if (normalizedLowStockAlert !== null) updateFields.lowStockAlert = normalizedLowStockAlert;

      currentUpdate.fields = { ...currentUpdate.fields, ...updateFields };
      stockUpdates.set(item.sourceItemId, currentUpdate);

      // Create Movement (Unique doc, no collision)
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

  // 3. Execute Batches (Parallelized)
  const BATCH_SIZE = 450; // Safety margin below 500
  const batchPromises = [];

  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = operations.slice(i, i + BATCH_SIZE);

    chunk.forEach(op => {
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'update') {
        batch.update(op.ref, op.data);
      }
    });

    batchPromises.push(batch.commit());
  }

  await Promise.all(batchPromises);

  // 4. Save Purchase Order
  const payload = {
    shopId,
    supplier: supplier?.trim() || '',
    invoiceNumber: invoiceNumber?.trim() || '',
    purchaseDate: pDate,
    note: note?.trim() || '',
    reference: reference?.trim() || '',
    items: preparedItems,
    createdAt: new Date().toISOString(),
  };

  const docRef = await addDoc(purchaseCollectionRef, payload);
  return { id: docRef.id, ...payload };
};

export const getPurchaseOrders = async (shopId) => {
  if (!shopId) return [];
  const purchaseRef = collection(db, purchaseCollection);
  const q = query(purchaseRef, where('shopId', '==', shopId));
  const snapshot = await getDocs(q);
  const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  return list.sort((a, b) => new Date(b.purchaseDate || b.createdAt) - new Date(a.purchaseDate || a.createdAt));
};


