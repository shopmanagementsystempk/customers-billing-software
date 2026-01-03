import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Container, Card, Row, Col, Form, Button, Alert, Table, Badge, Spinner, Modal } from 'react-bootstrap';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { createPurchaseOrder, getPurchaseOrders } from '../utils/purchaseUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import { getShopStock } from '../utils/stockUtils';
import { getInventoryCategories, addInventoryCategory, updateInventoryCategory, deleteInventoryCategory } from '../utils/categoryUtils';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc } from 'firebase/firestore';
import Select from 'react-select';
import { Translate, getTranslatedAttr } from '../components/Translate';

const defaultRow = {
  sourceItemId: '',
  name: '',
  category: '',
  description: '',
  quantity: '',
  unit: 'units',
  costPrice: '',
  sellingPrice: '',
  expiryDate: '',
  barcode: '',
  lowStockAlert: ''
};
const createEmptyRow = () => ({ ...defaultRow });

const formatCurrency = (value) => {
  if (value === null || value === undefined || value === '') return '0.00';
  return Number(value).toFixed(2);
};

const calculateRowTotal = (row) => {
  const quantity = parseFloat(row.quantity) || 0;
  const costPrice = parseFloat(row.costPrice) || 0;
  return quantity * costPrice;
};

const PurchaseManagement = () => {
  const { currentUser, shopData, activeShopId } = useAuth();
  const [rows, setRows] = useState([createEmptyRow()]);
  const [supplier, setSupplier] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [reference, setReference] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [stockItems, setStockItems] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [suppliersLoading, setSuppliersLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [editCategory, setEditCategory] = useState({ id: '', name: '', description: '' });
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [categoryError, setCategoryError] = useState('');
  const [categorySuccess, setCategorySuccess] = useState('');
  const [units, setUnits] = useState(['units', 'kg', 'litre', 'pack']);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const fileInputRef = React.useRef(null);

  const totalCost = useMemo(() => {
    return rows.reduce((sum, row) => sum + calculateRowTotal(row), 0);
  }, [rows]);

  useEffect(() => {
    if (!currentUser?.uid || !activeShopId) return;
    setHistoryLoading(true);
    getPurchaseOrders(activeShopId)
      .then(setHistory)
      .catch(err => console.error('Failed to load purchase history', err))
      .finally(() => setHistoryLoading(false));
  }, [currentUser, activeShopId]);

  useEffect(() => {
    if (!currentUser?.uid || !activeShopId) return;
    setStockLoading(true);
    getShopStock(activeShopId)
      .then(setStockItems)
      .catch(err => console.error('Failed to load stock items', err))
      .finally(() => setStockLoading(false));
  }, [currentUser, activeShopId]);

  const fetchCategories = useCallback(() => {
    if (!currentUser?.uid || !activeShopId) return;
    setCategoriesLoading(true);
    getInventoryCategories(activeShopId)
      .then(setCategories)
      .catch(err => console.error('Failed to load categories', err))
      .finally(() => setCategoriesLoading(false));
  }, [currentUser, activeShopId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const fetchSuppliers = useCallback(async () => {
    if (!currentUser?.uid || !activeShopId) return;

    setSuppliersLoading(true);
    try {
      const suppliersRef = collection(db, 'suppliers');
      const q = query(
        suppliersRef,
        where('shopId', '==', activeShopId)
      );
      const querySnapshot = await getDocs(q);
      const suppliersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by name in JavaScript to avoid Firestore index requirement
      suppliersData.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setSuppliers(suppliersData);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setSuppliersLoading(false);
    }
  }, [currentUser, activeShopId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  useEffect(() => {
    if (!currentUser?.uid || !activeShopId) return;
    const fetchUnits = async () => {
      try {
        setUnitsLoading(true);
        const unitsRef = collection(db, 'units');
        const q = query(unitsRef, where('shopId', '==', activeShopId));
        const snapshot = await getDocs(q);
        const custom = snapshot.docs.map(d => (d.data().name || '').toLowerCase()).filter(Boolean);
        const defaults = ['units', 'kg', 'litre', 'pack'];
        const merged = Array.from(new Set([...defaults, ...custom]));
        setUnits(merged);
      } catch (e) {
        console.error('Failed to load units', e);
      } finally {
        setUnitsLoading(false);
      }
    };
    fetchUnits();
  }, [currentUser, activeShopId]);

  const setRowValue = (index, key, value) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [key]: value };
      return next;
    });
  };

  // Generate random 8-digit barcode for a specific row
  const generateBarcodeForRow = (index) => {
    const randomBarcode = Math.floor(10000000 + Math.random() * 90000000).toString();
    setRowValue(index, 'barcode', randomBarcode);
  };

  const addRow = () => setRows(prev => [...prev, createEmptyRow()]);
  const removeRow = (index) => setRows(prev => prev.filter((_, idx) => idx !== index));

  // Category management handlers
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!currentUser?.uid || !newCategory.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    setCategoryError('');
    setCategoriesLoading(true);
    try {
      const categoryData = {
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
        shopId: activeShopId
      };
      await addInventoryCategory(categoryData);
      setCategorySuccess('Category added successfully');
      setNewCategory({ name: '', description: '' });
      fetchCategories();
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (err) {
      setCategoryError(err.message || 'Failed to add category');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditCategory({ id: category.id, name: category.name, description: category.description || '' });
    setShowEditCategoryModal(true);
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editCategory.id || !editCategory.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    setCategoryError('');
    setCategoriesLoading(true);
    try {
      await updateInventoryCategory(editCategory.id, {
        name: editCategory.name.trim(),
        description: editCategory.description.trim()
      });
      setCategorySuccess('Category updated successfully');
      setShowEditCategoryModal(false);
      setEditCategory({ id: '', name: '', description: '' });
      fetchCategories();
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (err) {
      setCategoryError(err.message || 'Failed to update category');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setShowDeleteCategoryModal(true);
  };

  const handleAddUnit = async (e) => {
    e.preventDefault();
    if (!currentUser?.uid) return;
    const name = (newUnitName || '').trim();
    if (!name) return;
    try {
      const unitsRef = collection(db, 'units');
      await addDoc(unitsRef, { shopId: activeShopId, name });
      setNewUnitName('');
      setShowUnitModal(false);
      // refresh list
      const q = query(unitsRef, where('shopId', '==', activeShopId));
      const snapshot = await getDocs(q);
      const custom = snapshot.docs.map(d => (d.data().name || '').toLowerCase()).filter(Boolean);
      const defaults = ['units', 'kg', 'litre', 'pack'];
      const merged = Array.from(new Set([...defaults, ...custom]));
      setUnits(merged);
    } catch (e) {
      console.error('Failed to add unit', e);
    }
  };

  const handleDeleteUnit = async (unitId) => {
    if (!unitId) return;
    try {
      await deleteDoc(doc(db, 'units', unitId));
      // refresh list
      const unitsRef = collection(db, 'units');
      const q = query(unitsRef, where('shopId', '==', activeShopId));
      const snapshot = await getDocs(q);
      const custom = snapshot.docs.map(d => (d.data().name || '').toLowerCase()).filter(Boolean);
      const defaults = ['units', 'kg', 'litre', 'pack'];
      const merged = Array.from(new Set([...defaults, ...custom]));
      setUnits(merged);
    } catch (e) {
      console.error('Failed to delete unit', e);
    }
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setCategoriesLoading(true);
    try {
      await deleteInventoryCategory(categoryToDelete.id);
      setCategorySuccess('Category deleted successfully');
      setShowDeleteCategoryModal(false);
      setCategoryToDelete(null);
      fetchCategories();
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (err) {
      setCategoryError(err.message || 'Failed to delete category');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleSelectExistingProduct = (index, itemId) => {
    setRows(prev => {
      const next = [...prev];
      const selectedItem = stockItems.find(item => item.id === itemId);

      if (!selectedItem) {
        next[index] = createEmptyRow();
        return next;
      }

      next[index] = {
        ...next[index],
        sourceItemId: itemId,
        name: selectedItem.name || next[index].name,
        category: selectedItem.category || next[index].category,
        description: selectedItem.description || next[index].description,
        unit: selectedItem.quantityUnit || next[index].unit || 'units',
        costPrice:
          selectedItem.costPrice !== undefined && selectedItem.costPrice !== null
            ? selectedItem.costPrice
            : next[index].costPrice,
        sellingPrice:
          selectedItem.price !== undefined && selectedItem.price !== null
            ? selectedItem.price
            : next[index].sellingPrice,
        barcode: selectedItem.barcode || '',
        lowStockAlert:
          selectedItem.lowStockAlert !== undefined && selectedItem.lowStockAlert !== null
            ? selectedItem.lowStockAlert.toString()
            : next[index].lowStockAlert
      };

      return next;
    });
  };

  const validateRows = () => {
    const validRows = rows.filter(row => row.name.trim() && parseFloat(row.quantity) > 0);
    if (!validRows.length) {
      setError('Add at least one valid item with name and quantity');
      return null;
    }
    return validRows.map(row => ({
      sourceItemId: row.sourceItemId || '',
      name: row.name.trim(),
      category: row.category.trim(),
      description: row.description.trim(),
      quantity: parseFloat(row.quantity),
      unit: row.unit,
      costPrice: parseFloat(row.costPrice || 0),
      sellingPrice: row.sellingPrice ? parseFloat(row.sellingPrice) : null,
      expiryDate: row.expiryDate || null,
      sku: (row.barcode || '').trim(),
      lowStockAlert: row.lowStockAlert ? parseFloat(row.lowStockAlert) : null
    }));
  };

  const resetForm = () => {
    setRows([createEmptyRow()]);
    setSupplier('');
    setInvoiceNumber('');
    setNote('');
    setReference('');
    setPurchaseDate(new Date().toISOString().slice(0, 10));
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const processCSV = (content) => {
    try {
      const lines = content.split(/\r\n|\n/).filter(line => line.trim());
      if (lines.length < 2) {
        setError('File appears to be empty or missing headers');
        return;
      }

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^"|"$/g, ''));
      const newRows = [];

      for (let i = 1; i < lines.length; i++) {
        // Regex to split by comma ignoring commas in quotes
        const values = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(v => v.trim().replace(/^"|"$/g, ''));

        if (values.length < 2) continue; // Skip empty/invalid lines

        const row = { ...createEmptyRow() };
        let hasData = false;

        headers.forEach((header, index) => {
          const value = values[index];
          if (!value) return;

          if (header.includes('name') || header.includes('item')) { row.name = value; hasData = true; }
          else if (header.includes('category')) { row.category = value; }
          else if (header.includes('qty') || header.includes('quantity')) { row.quantity = value; hasData = true; }
          else if (header.includes('cost')) { row.costPrice = value; }
          else if (header.includes('sell') || header.includes('price')) { row.sellingPrice = value; }
          else if (header.includes('unit')) { row.unit = value; }
          else if (header.includes('barcode') || header.includes('sku')) { row.barcode = value; }
          else if (header.includes('description')) { row.description = value; }
          else if (header.includes('expiry') || header.includes('date')) { row.expiryDate = value; }
          else if (header.includes('alert') || header.includes('stock')) { row.lowStockAlert = value; }
        });

        if (hasData && row.name) {
          newRows.push(row);
        }
      }

      if (newRows.length > 0) {
        setRows(prev => {
          // If the only row is empty, replace it
          if (prev.length === 1 && !prev[0].name.trim() && !prev[0].quantity) {
            return newRows;
          }
          return [...prev, ...newRows];
        });
        setSuccess(`Successfully imported ${newRows.length} items from CSV.`);
        setTimeout(() => setSuccess(''), 5000);
      } else {
        setError('No valid items found in the file. Please check columns: Name, Quantity, Cost, etc.');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to parse CSV file');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      setError('Please save your Excel file as CSV (Comma delimited) to import it here.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      processCSV(evt.target.result);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const validRows = validateRows();
    if (!validRows) return;
    if (!currentUser?.uid) {
      setError('Please login again');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        supplier,
        invoiceNumber,
        purchaseDate,
        note,
        reference,
        items: validRows,
      };
      const purchaseRecord = await createPurchaseOrder(activeShopId, payload);
      setSuccess('Purchase recorded and items added to inventory');
      resetForm();
      getPurchaseOrders(activeShopId).then(setHistory);
      printInvoice(purchaseRecord);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to record purchase');
    } finally {
      setLoading(false);
    }
  };

  const printInvoice = (purchase) => {
    if (!purchase) return;
    try {
      const iframe = document.createElement('iframe');
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const total = purchase.items.reduce((sum, item) => sum + (item.quantity * (item.costPrice || 0)), 0);
      const purchaseDateDisplay = formatDisplayDate(purchase.purchaseDate || new Date());
      const bodyRows = purchase.items.map(item => `
        <tr>
          <td>${item.name}</td>
          <td>${item.category || '-'}</td>
          <td>${item.quantity} ${item.unit}</td>
          <td>${formatDisplayDate(item.expiryDate)}</td>
          <td>${formatCurrency(item.costPrice)}</td>
          <td>${formatCurrency(item.quantity * (item.costPrice || 0))}</td>
        </tr>
      `).join('');

      const html = `
        <html>
          <head>
            <title>Purchase Invoice - ${shopData?.shopName || 'Shop'}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
              h2 { margin-bottom: 8px; }
              table { width: 100%; border-collapse: collapse; margin-top: 16px; }
              th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
              th { background: #f5f5f5; }
              .meta { margin-top: 12px; font-size: 13px; }
              .total { margin-top: 20px; font-size: 16px; font-weight: bold; }
            </style>
          </head>
          <body>
            <h2>${shopData?.shopName || 'Shop'} - ${getTranslatedAttr("purchaseInvoice")}</h2>
            <div class="meta">
              <div><strong>${getTranslatedAttr("invoiceNumber")}:</strong> ${purchase.invoiceNumber || '-'}</div>
              <div><strong>${getTranslatedAttr("supplierLabel")}:</strong> ${purchase.supplier || '-'}</div>
              <div><strong>${getTranslatedAttr("date")}:</strong> ${purchaseDateDisplay}</div>
              <div><strong>${getTranslatedAttr("reference")}:</strong> ${purchase.reference || '-'}</div>
              <div><strong>${getTranslatedAttr("notes")}:</strong> ${purchase.note || '-'}</div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>${getTranslatedAttr("item")}</th>
                  <th>${getTranslatedAttr("category")}</th>
                  <th>${getTranslatedAttr("quantity")}</th>
                  <th>${getTranslatedAttr("expiryDate")}</th>
                  <th>${getTranslatedAttr("costPrice")}</th>
                  <th>${getTranslatedAttr("lineTotal")}</th>
                </tr>
              </thead>
              <tbody>
                ${bodyRows}
              </tbody>
            </table>
            <div class="total">${getTranslatedAttr("totalCost")}: RS ${formatCurrency(total)}</div>
          </body>
        </html>
      `;

      const doc = iframe.contentWindow.document;
      doc.open();
      doc.write(html);
      doc.close();
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 1000);
    } catch (err) {
      console.error('Print error', err);
    }
  };

  const renderHistory = () => {
    if (historyLoading) {
      return (
        <div className="text-center py-4">
          <Spinner animation="border" />
        </div>
      );
    }

    if (!history.length) {
      return (
        <div className="empty-state">
          <i className="bi bi-receipt"></i>
          <h5><Translate textKey="noPurchaseHistory" fallback="No purchase history yet" /></h5>
          <p><Translate textKey="purchaseHistoryHelp" fallback="All recorded purchases will appear here with quick invoice access." /></p>
        </div>
      );
    }

    return (
      <Table responsive hover className="mb-0">
        <thead>
          <tr>
            <th><Translate textKey="invoiceNo" /></th>
            <th><Translate textKey="supplierLabel" /></th>
            <th><Translate textKey="date" /></th>
            <th><Translate textKey="items" /></th>
            <th><Translate textKey="totalCost" /></th>
            <th><Translate textKey="actions" /></th>
          </tr>
        </thead>
        <tbody>
          {history.map(purchase => {
            const total = purchase.items?.reduce((sum, item) => sum + (item.quantity * (item.costPrice || 0)), 0) || 0;
            return (
              <tr key={purchase.id}>
                <td>{purchase.invoiceNumber || '-'}</td>
                <td>{purchase.supplier || '-'}</td>
                <td>{formatDisplayDate(purchase.purchaseDate)}</td>
                <td>
                  <Badge bg="primary">{purchase.items?.length || 0}</Badge>
                </td>
                <td>RS {formatCurrency(total)}</td>
                <td>
                  <Button size="sm" variant="outline-primary" onClick={() => printInvoice(purchase)}>
                    <Translate textKey="printInvoice" />
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    );
  };

  return (
    <>
      <MainNavbar />
      <Container className="pos-content mt-3">
        <PageHeader
          title={<Translate textKey="purchaseManagement" fallback="Purchase Management" />}
          icon="bi-cart-plus"
          subtitle={<Translate textKey="purchaseManagementSubtitle" fallback="Record incoming purchases, auto-create inventory items, and keep invoices handy." />}
        >
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="supplierLabel" /></span>
            <span className="hero-metrics__value">{supplier || '—'}</span>
          </div>
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="items" /></span>
            <span className="hero-metrics__value">{rows.length}</span>
          </div>
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="totalCost" /></span>
            <span className="hero-metrics__value">RS {formatCurrency(totalCost)}</span>
          </div>
        </PageHeader>

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Card className="mb-4">
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                <Col md={4}>
                  <Form.Group>
                    <Form.Label><Translate textKey="supplierLabel" /></Form.Label>
                    <Form.Select
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      disabled={suppliersLoading}
                    >
                      <option value=""><Translate textKey="selectOption" /></option>
                      {suppliers.map(sup => (
                        <option key={sup.id} value={sup.name}>
                          {sup.name} {sup.company ? `(${sup.company})` : ''}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {suppliersLoading ? getTranslatedAttr("loading") : suppliers.length === 0 ? getTranslatedAttr("noSuppliersFound") : ''}
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label><Translate textKey="invoiceNumber" /></Form.Label>
                    <Form.Control value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="INV-00123" />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group>
                    <Form.Label><Translate textKey="purchaseDateLabel" /></Form.Label>
                    <Form.Control type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
                  </Form.Group>
                </Col>
              </Row>

              <Row className="g-3 mt-1">
                <Col md={6}>
                  <Form.Group>
                    <Form.Label><Translate textKey="reference" /></Form.Label>
                    <Form.Control value={reference} onChange={(e) => setReference(e.target.value)} placeholder={getTranslatedAttr("reference")} />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group>
                    <Form.Label><Translate textKey="notes" /></Form.Label>
                    <Form.Control value={note} onChange={(e) => setNote(e.target.value)} placeholder={getTranslatedAttr("notes")} />
                  </Form.Group>
                </Col>
              </Row>

              <div className="mt-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h5 className="mb-0"><Translate textKey="items" /></h5>
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileUpload}
                      accept=".csv,.txt"
                      style={{ display: 'none' }}
                    />
                    <Button variant="outline-success" size="sm" onClick={handleImportClick}>
                      <i className="bi bi-file-earmark-spreadsheet me-1"></i>
                      Import from Excel (CSV)
                    </Button>
                  </div>
                </div>
                {rows.map((row, idx) => (
                  <Card key={idx} className="mb-3">
                    <Card.Body>
                      <Row className="g-3">
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label><Translate textKey="existingProduct" /></Form.Label>
                            <Select
                              isDisabled={stockLoading || !stockItems.length}
                              isClearable
                              placeholder={stockLoading ? getTranslatedAttr("loading") : getTranslatedAttr("searchInventoryPlaceholder")}
                              options={stockItems.map(item => ({
                                value: item.id,
                                label: `${item.name}${item.barcode ? ` • ${item.barcode}` : ''}`,
                                barcode: item.barcode || '',
                                name: item.name || ''
                              }))}
                              value={(row.sourceItemId && stockItems.length) ? (() => {
                                const it = stockItems.find(i => i.id === row.sourceItemId);
                                return it ? { value: it.id, label: `${it.name}${it.barcode ? ` • ${it.barcode}` : ''}`, barcode: it.barcode || '', name: it.name || '' } : null;
                              })() : null}
                              onChange={(selected) => handleSelectExistingProduct(idx, selected ? selected.value : '')}
                              filterOption={(candidate, input) => {
                                const text = (input || '').toLowerCase();
                                return candidate.label.toLowerCase().includes(text) ||
                                  ((candidate.data && candidate.data.barcode) ? candidate.data.barcode.toLowerCase().includes(text) : false);
                              }}
                            />
                            <Form.Text className="text-muted">
                              {stockItems.length
                                ? 'Select to auto-fill item details'
                                : 'No products in inventory yet'}
                            </Form.Text>
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group>
                            <Form.Label><Translate textKey="itemNameLabel" /></Form.Label>
                            <Form.Control value={row.name} onChange={(e) => setRowValue(idx, 'name', e.target.value)} required />
                          </Form.Group>
                        </Col>
                        <Col md={4}>
                          <Form.Group>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <Form.Label className="mb-0">Category</Form.Label>
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 text-decoration-none"
                                onClick={() => setShowCategoryModal(true)}
                                style={{ fontSize: '0.75rem' }}
                              >
                                <i className="bi bi-pencil-square me-1"></i><Translate textKey="manageCategories" />
                              </Button>
                            </div>
                            <Form.Select
                              value={row.category}
                              onChange={(e) => setRowValue(idx, 'category', e.target.value)}
                              disabled={categoriesLoading}
                            >
                              <option value="">Select a category</option>
                              {categories.map(cat => (
                                <option key={cat.id} value={cat.name}>
                                  {cat.name}
                                </option>
                              ))}
                            </Form.Select>
                            <Form.Text className="text-muted">
                              {categoriesLoading ? 'Loading categories...' : categories.length === 0 ? 'No categories yet. Click "Manage Categories" to add.' : ''}
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row className="g-3 mt-1">
                        <Col md={4}>
                          <Form.Group>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <Form.Label className="mb-0">Barcode</Form.Label>
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 text-decoration-none"
                                onClick={() => generateBarcodeForRow(idx)}
                                style={{ fontSize: '0.75rem' }}
                              >
                                <i className="bi bi-upc-scan me-1"></i><Translate textKey="generate" />
                              </Button>
                            </div>
                            <Form.Control value={row.barcode || ''} onChange={(e) => setRowValue(idx, 'barcode', e.target.value)} placeholder={getTranslatedAttr("optional")} />
                            <Form.Text className="text-muted"><Translate textKey="barcodeScanningHelp" /></Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row className="g-3 mt-1">
                        <Col md={12}>
                          <Form.Group>
                            <Form.Label><Translate textKey="description" /></Form.Label>
                            <Form.Control value={row.description} onChange={(e) => setRowValue(idx, 'description', e.target.value)} placeholder={getTranslatedAttr("optional")} />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row className="g-3 mt-1">
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label><Translate textKey="quantityLabel" /></Form.Label>
                            <Form.Control type="number" min="0" step="0.01" value={row.quantity} onChange={(e) => setRowValue(idx, 'quantity', e.target.value)} />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <div className="d-flex justify-content-between align-items-center mb-1">
                              <Form.Label className="mb-0">Unit</Form.Label>
                              <Button
                                variant="link"
                                size="sm"
                                className="p-0 text-decoration-none"
                                onClick={() => setShowUnitModal(true)}
                                style={{ fontSize: '0.75rem' }}
                              >
                                <i className="bi bi-pencil-square me-1"></i><Translate textKey="manageUnits" fallback="Manage Units" />
                              </Button>
                            </div>
                            <Form.Select value={row.unit} onChange={(e) => setRowValue(idx, 'unit', e.target.value)} disabled={unitsLoading}>
                              {units.map(u => (
                                <option key={u} value={u}><Translate textKey={u} fallback={u} /></option>
                              ))}
                            </Form.Select>
                            <Form.Text className="text-muted">{unitsLoading ? 'Loading units...' : ''}</Form.Text>
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label><Translate textKey="costPriceLabel" /></Form.Label>
                            <Form.Control type="number" min="0" step="0.01" value={row.costPrice} onChange={(e) => setRowValue(idx, 'costPrice', e.target.value)} />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label><Translate textKey="sellingPriceLabel" /> ({getTranslatedAttr("optional")})</Form.Label>
                            <Form.Control type="number" min="0" step="0.01" value={row.sellingPrice} onChange={(e) => setRowValue(idx, 'sellingPrice', e.target.value)} />
                          </Form.Group>
                        </Col>
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label><Translate textKey="expiryDateLabel" /></Form.Label>
                            <Form.Control type="date" value={row.expiryDate || ''} onChange={(e) => setRowValue(idx, 'expiryDate', e.target.value)} />
                          </Form.Group>
                        </Col>
                      </Row>
                      <Row className="g-3 mt-1">
                        <Col md={3}>
                          <Form.Group>
                            <Form.Label>Low Stock Alert (Optional)</Form.Label>
                            <Form.Control
                              type="number"
                              min="0"
                              step="0.01"
                              value={row.lowStockAlert || ''}
                              onChange={(e) => setRowValue(idx, 'lowStockAlert', e.target.value)}
                              placeholder={getTranslatedAttr("lowStockAlert")}
                            />
                            <Form.Text className="text-muted">
                              <Translate textKey="lowStockAlertHelp" />
                            </Form.Text>
                          </Form.Group>
                        </Col>
                      </Row>
                      <div className="d-flex justify-content-between align-items-center mt-3">
                        <div className="text-muted"><Translate textKey="lineTotal" />: RS {formatCurrency(calculateRowTotal(row))}</div>
                        <Button variant="outline-danger" size="sm" onClick={() => removeRow(idx)} disabled={rows.length === 1}>
                          <Translate textKey="remove" />
                        </Button>
                      </div>
                    </Card.Body>
                  </Card>
                ))}
                <Button variant="outline-primary" onClick={addRow}>
                  <Translate textKey="addAnotherItem" fallback="+ Add Another Item" />
                </Button>
              </div>

              <div className="d-flex align-items-center justify-content-between mt-4">
                <div className="fw-bold fs-5">Grand Total: RS {formatCurrency(totalCost)}</div>
                <div className="d-flex gap-2">
                  <Button type="submit" variant="primary" disabled={loading}>
                    {loading ? <Translate textKey="saving" /> : <Translate textKey="savePurchaseAndPrint" fallback="Save Purchase & Print Invoice" />}
                  </Button>
                  <Button variant="outline-secondary" onClick={resetForm} disabled={loading}>
                    Reset
                  </Button>
                </div>
              </div>
            </Form>
          </Card.Body>
        </Card>

        <Card>
          <Card.Header><Translate textKey="stockHistory" fallback="Purchase History" /></Card.Header>
          <Card.Body className="p-0">
            {renderHistory()}
          </Card.Body>
        </Card>

        {/* Category Management Modal */}
        <Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="inventoryCategories" fallback="Manage Inventory Categories" /></Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {categoryError && <Alert variant="danger" dismissible onClose={() => setCategoryError('')}>{categoryError}</Alert>}
            {categorySuccess && <Alert variant="success" dismissible onClose={() => setCategorySuccess('')}>{categorySuccess}</Alert>}

            <Form onSubmit={handleAddCategory} className="mb-4">
              <h6><Translate textKey="addNewCategory" fallback="Add New Category" /></h6>
              <Row className="g-2">
                <Col md={5}>
                  <Form.Control
                    type="text"
                    placeholder="Category name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    required
                  />
                </Col>
                <Col md={5}>
                  <Form.Control
                    type="text"
                    placeholder="Description (optional)"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  />
                </Col>
                <Col md={2}>
                  <Button type="submit" variant="primary" disabled={categoriesLoading}>
                    <Translate textKey="add" />
                  </Button>
                </Col>
              </Row>
            </Form>

            <hr />

            <h6><Translate textKey="existingCategories" fallback="Existing Categories" /></h6>
            {categoriesLoading && !categories.length ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" />
              </div>
            ) : categories.length === 0 ? (
              <p className="text-muted">No categories yet. Add one above.</p>
            ) : (
              <Table hover size="sm">
                <thead>
                  <tr>
                    <th><Translate textKey="name" /></th>
                    <th><Translate textKey="description" /></th>
                    <th><Translate textKey="actions" /></th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr key={cat.id}>
                      <td>{cat.name}</td>
                      <td>{cat.description || '-'}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => handleEditCategory(cat)}
                        >
                          <Translate textKey="edit" />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDeleteCategory(cat)}
                        >
                          <Translate textKey="delete" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
              <Translate textKey="close" />
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Edit Category Modal */}
        <Modal show={showEditCategoryModal} onHide={() => setShowEditCategoryModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="editCategory" /></Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleUpdateCategory}>
            <Modal.Body>
              {categoryError && <Alert variant="danger">{categoryError}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="categoryName" /></Form.Label>
                <Form.Control
                  type="text"
                  value={editCategory.name}
                  onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label><Translate textKey="description" /></Form.Label>
                <Form.Control
                  type="text"
                  value={editCategory.description}
                  onChange={(e) => setEditCategory({ ...editCategory, description: e.target.value })}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowEditCategoryModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={categoriesLoading}>
                {categoriesLoading ? <Translate textKey="updating" /> : <Translate textKey="update" />}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Delete Category Confirmation Modal */}
        <Modal show={showDeleteCategoryModal} onHide={() => setShowDeleteCategoryModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="deleteCategory" /></Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Are you sure you want to delete the category <strong>"{categoryToDelete?.name}"</strong>?</p>
            <p className="text-muted small">This will not delete products in this category, but the category will be removed from the dropdown.</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteCategoryModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteCategory} disabled={categoriesLoading}>
              {categoriesLoading ? <Translate textKey="deleting" /> : <Translate textKey="delete" />}
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Unit Management Modal */}
        <Modal show={showUnitModal} onHide={() => setShowUnitModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="manageUnits" fallback="Manage Units" /></Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form onSubmit={handleAddUnit} className="mb-3">
              <Row className="g-2">
                <Col xs={8}>
                  <Form.Control
                    type="text"
                    placeholder="New unit (e.g., box, dozen)"
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    required
                  />
                </Col>
                <Col xs={4}>
                  <Button type="submit" variant="primary" disabled={unitsLoading}><Translate textKey="add" /></Button>
                </Col>
              </Row>
            </Form>

            <h6>Available Units</h6>
            {unitsLoading ? (
              <div className="text-center py-2"><Spinner animation="border" size="sm" /></div>
            ) : (
              <Table hover size="sm">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th style={{ width: '120px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map(u => (
                    <tr key={u}>
                      <td>{u}</td>
                      <td>
                        {['units', 'kg', 'litre', 'pack'].includes(u) ? (
                          <span className="text-muted">Default</span>
                        ) : (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={async () => {
                              const unitsRef = collection(db, 'units');
                              const q = query(unitsRef, where('shopId', '==', activeShopId));
                              const snapshot = await getDocs(q);
                              const match = snapshot.docs.find(d => (d.data().name || '').toLowerCase() === u.toLowerCase());
                              if (match) handleDeleteUnit(match.id);
                            }}
                          >
                            <Translate textKey="delete" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowUnitModal(false)}><Translate textKey="close" /></Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  );
};

export default PurchaseManagement;


