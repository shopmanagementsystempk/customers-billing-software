import React, { useState, useEffect, useCallback } from 'react';
import { Container, Table, Button, Card, Form, InputGroup, Row, Col, Badge, Modal, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { getShopStock, deleteStockItem, deleteAllShopStock } from '../utils/stockUtils';
import { getInventoryCategories, addInventoryCategory, updateInventoryCategory, deleteInventoryCategory } from '../utils/categoryUtils';
import './ViewStock.css'; // Import the custom CSS
import { Translate, useTranslatedAttribute } from '../utils';
import { formatDisplayDate } from '../utils/dateUtils';
import JsBarcode from 'jsbarcode';
import jsPDF from 'jspdf';

const ViewStock = () => {
  const { currentUser, activeShopId } = useAuth();
  const [stockItems, setStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [itemToPrintBarcode, setItemToPrintBarcode] = useState(null);
  const [printBarcodeData, setPrintBarcodeData] = useState(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [inventoryCategories, setInventoryCategories] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [editCategory, setEditCategory] = useState({ id: '', name: '', description: '' });
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [categoryError, setCategoryError] = useState('');
  const [categorySuccess, setCategorySuccess] = useState('');
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertItems, setAlertItems] = useState([]);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const navigate = useNavigate();

  // Get translations for attributes
  const getTranslatedAttr = useTranslatedAttribute();

  // Delete ALL items
  const handleDeleteAll = () => {
    if (deleteConfirmationText !== 'DELETE ALL' || !activeShopId) return;

    setIsDeletingAll(true);
    deleteAllShopStock(activeShopId)
      .then((count) => {
        setStockItems([]);
        setShowDeleteAllModal(false);
        setDeleteConfirmationText('');
        alert(`Successfully deleted ${count} items.`);
      })
      .catch(error => {
        console.error('Error deleting all items:', error);
        alert('Failed to delete items. Please try again.');
      })
      .finally(() => {
        setIsDeletingAll(false);
      });
  };

  const fetchStock = useCallback(() => {
    if (!currentUser || !activeShopId) return;

    setLoading(true);

    // Create a simple function to fetch stock items
    getShopStock(activeShopId)
      .then(stockData => {
        console.log('Stock data fetched:', stockData);
        setStockItems(stockData);
      })
      .catch(error => {
        console.error('Error fetching stock items:', error);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentUser, activeShopId]);

  useEffect(() => {
    // Redirect to login if user is not authenticated
    if (!currentUser) {
      navigate('/login');
      return;
    }

    fetchStock();
  }, [fetchStock, currentUser, navigate]);

  // Fetch inventory categories
  const fetchCategories = useCallback(() => {
    if (!activeShopId) return;
    setCategoryLoading(true);
    getInventoryCategories(activeShopId)
      .then(setInventoryCategories)
      .catch(err => console.error('Failed to load categories', err))
      .finally(() => setCategoryLoading(false));
  }, [activeShopId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const lowStock = stockItems.filter(item => isLowStock(item));
    const expired = stockItems.filter(item => isExpired(item));
    const alerts = [...lowStock, ...expired];

    if (alerts.length > 0) {
      setAlertItems(alerts);
      setShowAlertModal(true);
    }
  }, [stockItems]);

  // Get unique categories for filter dropdown (combine inventory categories with existing stock categories)
  const stockCategories = [...new Set(stockItems.map(item => item.category))].filter(Boolean);
  const allCategories = [...new Set([...inventoryCategories.map(cat => cat.name), ...stockCategories])].sort();

  // Get unique stores and companies
  const allStores = [...new Set(stockItems.map(item => item.storeName))].filter(Boolean).sort();
  const allCompanies = [...new Set(stockItems.map(item => item.companyName))].filter(Boolean).sort();

  // Handle search and filtering
  // Helper functions for status filtering
  const isExpired = (item) => {
    if (!item?.expiryDate) return false;
    const expiry = new Date(item.expiryDate);
    const today = new Date();
    return expiry < today;
  };

  const isLowStock = (item) => {
    const alert = parseFloat(item?.lowStockAlert);
    const qty = parseFloat(item?.quantity);
    return !isNaN(alert) && alert > 0 && !isNaN(qty) && qty <= alert;
  };
  const filteredItems = stockItems
    .filter(item => {
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCategory = categoryFilter ? item.category === categoryFilter : true;
      const matchesStore = storeFilter ? (item.storeName === storeFilter) : true;
      const matchesCompany = companyFilter ? (item.companyName === companyFilter) : true;

      const matchesStatus = statusFilter === ''
        ? true
        : statusFilter === 'low'
          ? (isLowStock(item) || !!item.expiryDate)
          : statusFilter === 'expired'
            ? isExpired(item)
            : true;

      return matchesSearch && matchesCategory && matchesStatus && matchesStore && matchesCompany;
    })
    .sort((a, b) => {
      // Handle client-side sorting
      let comparison = 0;

      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'price') {
        comparison = parseFloat(a.price) - parseFloat(b.price);
      } else if (sortField === 'quantity') {
        comparison = parseFloat(a.quantity) - parseFloat(b.quantity);
      } else if (sortField === 'updatedAt') {
        comparison = new Date(a.updatedAt) - new Date(b.updatedAt);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });

  // Handle sorting
  const handleSort = (field) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Open delete confirmation modal
  const confirmDelete = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
  };

  // Delete stock item
  const handleDelete = () => {
    if (!itemToDelete) return;

    deleteStockItem(itemToDelete.id)
      .then(() => {
        fetchStock(); // Refresh the list
        setShowDeleteModal(false);
        setItemToDelete(null);
      })
      .catch(error => {
        console.error('Error deleting stock item:', error);
      });
  };

  // Open barcode print modal
  const printBarcode = (item) => {
    setItemToPrintBarcode(item);
    setShowBarcodeModal(true);
  };

  // Generate barcode image using jsbarcode
  const generateBarcodeImage = (barcodeValue) => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, barcodeValue, {
        format: "CODE128",
        width: 2,
        height: 80,
        displayValue: true,
        fontSize: 16,
        margin: 10
      });
      return canvas.toDataURL('image/png');
    } catch (error) {
      console.error('Error generating barcode:', error);
      return null;
    }
  };

  // Print barcode - use reliable popup method for cross-browser consistency
  const handlePrintBarcode = () => {
    // Defer to the popup approach which renders in a new document
    setShowBarcodeModal(false);
    setTimeout(() => {
      handlePrintBarcodePopup();
    }, 50);
  };

  // Popup method - generates barcode in new window
  const handlePrintBarcodePopup = () => {
    if (!itemToPrintBarcode) return;

    try {
      const printWindow = window.open('', '_blank', 'width=500,height=400,scrollbars=yes,resizable=yes');

      if (!printWindow) {
        alert('Please allow popups for this site to print barcodes.');
        return;
      }

      const barcodeNumber = itemToPrintBarcode.barcode || itemToPrintBarcode.sku || itemToPrintBarcode.id;
      const barcodeImage = generateBarcodeImage(barcodeNumber);

      if (!barcodeImage) {
        alert('Error generating barcode. Please try again.');
        printWindow.close();
        return;
      }

      printWindow.document.write(`
        <html>
          <head>
            <title>Barcode - ${itemToPrintBarcode.name}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                text-align: center; 
                padding: 20px; 
                margin: 0;
                background: white;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-height: 100vh;
              }
              .barcode-container {
                border: none;
                padding: 20px;
                margin: 20px auto;
                max-width: 400px;
                background: white;
                box-shadow: none;
              }
              .barcode { 
                width: 100%;
                max-width: 350px;
                height: auto;
                margin: 15px 0;
                display: block;
              }
              .print-info {
                font-size: 10px;
                color: #888;
                margin-top: 15px;
              }
              @media print { 
                body { 
                  padding: 10px; 
                  min-height: auto;
                }
                .print-info {
                  display: none;
                }
                .barcode-container {
                  box-shadow: none;
                  border: none;
                }
              }
            </style>
          </head>
          <body>
            <div class="barcode-container">
              <img src="${barcodeImage}" alt="Barcode" class="barcode" />
            </div>
            <div class="print-info">Press Ctrl+P to print this barcode</div>
          </body>
        </html>
      `);

      printWindow.document.close();

      // Wait for image to load before printing
      setTimeout(() => {
        try {
          printWindow.print();
          setTimeout(() => {
            if (!printWindow.closed) {
              printWindow.close();
            }
          }, 1000);
        } catch (printError) {
          console.error('Error printing:', printError);
        }
      }, 500);

    } catch (error) {
      console.error('Error opening print window:', error);
      alert('Error generating print window. Please try again.');
    } finally {
      setShowBarcodeModal(false);
      setItemToPrintBarcode(null);
    }
  };

  // Determine badge color based on quantity
  const getQuantityBadgeVariant = (quantity) => {
    if (quantity <= 0) return 'danger';
    if (quantity <= 10) return 'warning';
    return 'success';
  };

  // Category management handlers
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!activeShopId || !newCategory.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    setCategoryError('');
    setCategoryLoading(true);
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
      setCategoryLoading(false);
    }
  };

  // Generate PDF Report for Current Filtered Items
  const generatePDFReport = () => {
    if (filteredItems.length === 0) {
      alert("No items to export.");
      return;
    }

    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF('l', 'mm', 'a4'); // Landscape for more columns
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let y = margin + 10;

      // Header
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text("Inventory Stock Report", pageWidth / 2, y, { align: 'center' });
      y += 10;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      const filterText = [];
      if (categoryFilter) filterText.push(`Category: ${categoryFilter}`);
      if (storeFilter) filterText.push(`Store: ${storeFilter}`);
      if (companyFilter) filterText.push(`Company: ${companyFilter}`);
      if (searchTerm) filterText.push(`Search: ${searchTerm}`);

      pdf.text(`Generated on: ${new Date().toLocaleString()}`, margin, y);
      if (filterText.length > 0) {
        y += 5;
        pdf.text(`Filters: ${filterText.join(', ')}`, margin, y);
      }
      y += 10;

      // Table Header Settings
      const columns = [
        { title: "S.#", width: 12 },
        { title: "Item Name", width: 50 },
        { title: "Category", width: 35 },
        { title: "Company", width: 35 },
        { title: "Store", width: 35 },
        { title: "Pur. Price", width: 25 },
        { title: "Sale Price", width: 25 },
        { title: "Qty", width: 25 },
        { title: "Last Updated", width: 35 }
      ];

      // Draw Header Row
      pdf.setFont('helvetica', 'bold');
      pdf.setFillColor(240, 240, 240);
      pdf.rect(margin, y - 5, pageWidth - (2 * margin), 7, 'F');

      let x = margin;
      columns.forEach(col => {
        pdf.text(col.title, x + 2, y);
        x += col.width;
      });
      y += 7;

      // Draw Rows
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);

      filteredItems.forEach((item, index) => {
        // Page break check
        if (y > pageHeight - 15) {
          pdf.addPage();
          y = margin + 15;

          // Redraw header on new page
          pdf.setFont('helvetica', 'bold');
          pdf.setFillColor(240, 240, 240);
          pdf.rect(margin, y - 5, pageWidth - (2 * margin), 7, 'F');
          let curX = margin;
          columns.forEach(col => {
            pdf.text(col.title, curX + 2, y);
            curX += col.width;
          });
          pdf.setFont('helvetica', 'normal');
          y += 7;
        }

        let curX = margin;

        // Truncate long strings if necessary
        const truncate = (str, maxLen) => {
          if (!str) return "-";
          return str.length > maxLen ? str.substring(0, maxLen - 3) + "..." : str;
        };

        // Draw Serial Number
        pdf.text((index + 1).toString(), curX + 2, y); curX += 12;

        pdf.text(truncate(item.name, 30), curX + 2, y); curX += 50;
        pdf.text(truncate(item.category, 18), curX + 2, y); curX += 35;
        pdf.text(truncate(item.companyName, 18), curX + 2, y); curX += 35;
        pdf.text(truncate(item.storeName, 18), curX + 2, y); curX += 35;
        pdf.text(`RS ${parseFloat(item.costPrice || 0).toFixed(2)}`, curX + 2, y); curX += 25;
        pdf.text(`RS ${parseFloat(item.price || 0).toFixed(2)}`, curX + 2, y); curX += 25;
        pdf.text(`${item.quantity || 0} ${item.quantityUnit || 'Units'}`, curX + 2, y); curX += 25;
        pdf.text(formatDisplayDate(item.updatedAt), curX + 2, y);

        // Draw line separator
        pdf.setDrawColor(230, 230, 230);
        pdf.line(margin, y + 2, pageWidth - margin, y + 2);

        y += 7;
      });

      // Calculate totals
      const totalCostValue = filteredItems.reduce((sum, item) => sum + ((parseFloat(item.costPrice) || 0) * (parseFloat(item.quantity) || 0)), 0);
      const totalSaleValue = filteredItems.reduce((sum, item) => sum + ((parseFloat(item.price) || 0) * (parseFloat(item.quantity) || 0)), 0);

      // Draw Totals Section
      if (y > pageHeight - 35) {
        pdf.addPage();
        y = margin + 15;
      } else {
        y += 5;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(10);
      pdf.setDrawColor(0);
      pdf.line(margin, y - 2, pageWidth - margin, y - 2);

      // Total Items and Unit Price sum
      pdf.text(`Total Items: ${filteredItems.length}`, margin + 2, y);
      pdf.text(`Total Purchase Value: RS ${totalCostValue.toFixed(2)}`, margin + 180, y, { align: 'right' });
      y += 7;

      pdf.text(`Total Sale Value: RS ${totalSaleValue.toFixed(2)}`, margin + 180, y, { align: 'right' });
      y += 7;

      const potentialProfit = totalSaleValue - totalCostValue;
      pdf.text(`Potential Margin/Profit: RS ${potentialProfit.toFixed(2)}`, margin + 180, y, { align: 'right' });

      pdf.save(`Inventory_Report_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("PDF Export error:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setGeneratingPDF(false);
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
    setCategoryLoading(true);
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
      setCategoryLoading(false);
    }
  };

  const handleDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setShowDeleteCategoryModal(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setCategoryLoading(true);
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
      setCategoryLoading(false);
    }
  };

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          @media print {
            body * { visibility: hidden !important; }
            #printable-wrapper, #printable-wrapper * {
              visibility: visible;
            }
            #printable-wrapper {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            #printable-barcode {
              position: static;
              width: auto;
              margin: 0 auto;
            }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        `
      }} />

      <MainNavbar />
      <Container>
        <PageHeader
          title={<Translate textKey="stockInventory" fallback="Stock Inventory" />}
          icon="bi-box-seam"
          subtitle={<Translate textKey="inventorySubtitle" fallback="Monitor stock levels, add incoming quantities and keep products ready to sell." />}
        />
        <div className="page-header-actions">
          <div className="d-flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => navigate('/add-stock-entry')}
            >
              <Translate textKey="stockIn" />
            </Button>
            <Button
              variant="success"
              onClick={() => navigate('/add-stock')}
            >
              <Translate textKey="addNewItem" />
            </Button>
            <Button
              variant="outline-info"
              onClick={generatePDFReport}
              disabled={generatingPDF}
            >
              <i className="bi bi-file-earmark-pdf me-1"></i>
              {generatingPDF ? "Generating PDF..." : "Download Report (PDF)"}
            </Button>
            <Button
              variant="outline-primary"
              onClick={() => setShowCategoryModal(true)}
            >
              <i className="bi bi-tags me-1"></i>
              <Translate textKey="manageCategories" fallback="Manage Categories" />
            </Button>
            <Button
              variant="outline-danger"
              onClick={() => setShowDeleteAllModal(true)}
            >
              <i className="bi bi-trash me-1"></i>
              <Translate textKey="deleteAll" fallback="Delete All Inventory" />
            </Button>
          </div>
        </div>

        <Card className="mb-4">
          <Card.Body>
            <Row>
              <Col md={6} lg={4}>
                <Form.Group className="mb-3">
                  <Form.Label><Translate textKey="searchItems" /></Form.Label>
                  <InputGroup>
                    <Form.Control
                      type="text"
                      placeholder={getTranslatedAttr("searchItemsPlaceholder")}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <Button
                        variant="outline-secondary"
                        onClick={() => setSearchTerm('')}
                      >
                        <Translate textKey="clear" />
                      </Button>
                    )}
                  </InputGroup>
                </Form.Group>
              </Col>

              <Col md={6} lg={4}>
                <Form.Group className="mb-3">
                  <Form.Label><Translate textKey="filterByCategory" /></Form.Label>
                  <Form.Select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                  >
                    <option value=""><Translate textKey="allCategories" /></option>
                    {allCategories.map((category, index) => (
                      <option key={index} value={category}>
                        {category}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6} lg={4}>
                <Form.Group className="mb-3">
                  <Form.Label><Translate textKey="status" fallback="Status" /></Form.Label>
                  <Form.Select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value=""><Translate textKey="allCategories" fallback="All items" /></option>
                    <option value="low"><Translate textKey="lowStock" fallback="Low Stock" /></option>
                    <option value="expired"><Translate textKey="expired" fallback="Expired" /></option>
                  </Form.Select>
                </Form.Group>
              </Col>

              <Col md={6} lg={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Filter by Store</Form.Label>
                  <Form.Select
                    value={storeFilter}
                    onChange={(e) => setStoreFilter(e.target.value)}
                  >
                    <option value="">All Stores</option>
                    {allStores.map((store, index) => (
                      <option key={index} value={store}>{store}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6} lg={4}>
                <Form.Group className="mb-3">
                  <Form.Label>Filter by Company</Form.Label>
                  <Form.Select
                    value={companyFilter}
                    onChange={(e) => setCompanyFilter(e.target.value)}
                  >
                    <option value="">All Companies</option>
                    {allCompanies.map((company, index) => (
                      <option key={index} value={company}>{company}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {loading ? (
          <p className="text-center"><Translate textKey="loadingStockItems" /></p>
        ) : (
          <Card>
            <Card.Body>
              {filteredItems.length > 0 ? (
                <div className="table-responsive stock-table-container">
                  <Table hover responsive="sm" className="stock-table">
                    <thead>
                      <tr>
                        <th
                          className="cursor-pointer"
                          onClick={() => handleSort('name')}
                        >
                          <Translate textKey="itemName" />
                          {sortField === 'name' && (
                            <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th className="description-column"><Translate textKey="description" /></th>
                        <th><Translate textKey="category" /></th>
                        <th>Company</th>
                        <th>Store</th>
                        <th
                          className="cursor-pointer"
                          onClick={() => handleSort('price')}
                        >
                          <Translate textKey="price" /> (RS)
                          {sortField === 'price' && (
                            <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th
                          className="cursor-pointer"
                          onClick={() => handleSort('quantity')}
                        >
                          <Translate textKey="quantity" />
                          {sortField === 'quantity' && (
                            <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th
                          className="cursor-pointer"
                          onClick={() => handleSort('updatedAt')}
                        >
                          <Translate textKey="lastUpdated" />
                          {sortField === 'updatedAt' && (
                            <span>{sortDirection === 'asc' ? ' ↑' : ' ↓'}</span>
                          )}
                        </th>
                        <th><Translate textKey="actions" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map(item => (
                        <tr key={item.id}>
                          <td data-label={getTranslatedAttr("itemName")} className="text-nowrap">{item.name}</td>
                          <td data-label={getTranslatedAttr("description")} className="description-column">
                            <div className="description-cell-content">
                              {item.description || '-'}
                            </div>
                          </td>
                          <td data-label={getTranslatedAttr("category")}>{item.category || '-'}</td>
                          <td data-label="Company">{item.companyName || '-'}</td>
                          <td data-label="Store">{item.storeName || '-'}</td>
                          <td data-label={getTranslatedAttr("price")}>RS{parseFloat(item.price).toFixed(2)}</td>
                          <td data-label={getTranslatedAttr("quantity")}>
                            {(() => {
                              const qty = parseFloat(item.quantity) || 0;
                              const variant = getQuantityBadgeVariant(qty);
                              const bgColors = {
                                danger: '#ef4444',
                                warning: '#f59e0b',
                                success: '#10b981'
                              };
                              const textColors = {
                                danger: '#ffffff',
                                warning: '#000000',
                                success: '#ffffff'
                              };
                              return (
                                <Badge
                                  style={{
                                    backgroundColor: bgColors[variant],
                                    color: textColors[variant],
                                    padding: '0.5em 0.8em',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    minWidth: '70px',
                                    display: 'inline-block',
                                    textAlign: 'center'
                                  }}
                                >
                                  {(item.quantity === '' || item.quantity === undefined || item.quantity === null) ? 0 : item.quantity} {item.quantityUnit === 'kg' ? 'KG' : 'Units'}
                                </Badge>
                              );
                            })()}
                          </td>
                          <td data-label={getTranslatedAttr("lastUpdated")}>{formatDisplayDate(item.updatedAt)}</td>
                          <td data-label={getTranslatedAttr("actions")}>
                            <Button
                              variant="outline-success"
                              size="sm"
                              onClick={() => navigate('/add-stock-entry', { state: { preselectId: item.id } })}
                              className="me-1 mb-1"
                            >
                              <Translate textKey="addQuantity" />
                            </Button>
                            <Button
                              variant="outline-primary"
                              size="sm"
                              onClick={() => navigate(`/edit-stock/${item.id}`)}
                              className="me-1 mb-1"
                            >
                              <Translate textKey="edit" />
                            </Button>
                            <Button
                              variant="outline-secondary"
                              size="sm"
                              onClick={() => printBarcode(item)}
                              className="me-1 mb-1"
                            >
                              <Translate textKey="printBarcode" fallback="Print Barcode" />
                            </Button>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => confirmDelete(item)}
                              className="mb-1"
                            >
                              <Translate textKey="delete" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="text-center">
                  {stockItems.length > 0
                    ? <Translate textKey="noItemsMatch" />
                    : <Translate textKey="noItemsFound" />}
                </p>
              )}
            </Card.Body>
          </Card>
        )}

        {/* Delete Confirmation Modal */}
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="confirmDelete" /></Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p><Translate textKey="deleteItemConfirmation" /></p>
            {itemToDelete && <p><strong>{itemToDelete.name}</strong></p>}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              <Translate textKey="cancel" />
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              <Translate textKey="delete" />
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Delete All Confirmation Modal */}
        <Modal show={showDeleteAllModal} onHide={() => { setShowDeleteAllModal(false); setDeleteConfirmationText(''); }}>
          <Modal.Header closeButton className="bg-danger text-white">
            <Modal.Title>⚠ DANGER: Delete All Inventory</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="danger">
              <strong>Warning:</strong> This action cannot be undone. This will permanently delete <strong>ALL</strong> {stockItems.length} items in your inventory.
            </Alert>
            <p>To confirm, please type <strong>DELETE ALL</strong> in the box below:</p>
            <Form.Control
              type="text"
              placeholder="Type DELETE ALL to confirm"
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              className="border-danger"
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => { setShowDeleteAllModal(false); setDeleteConfirmationText(''); }}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDeleteAll}
              disabled={deleteConfirmationText !== 'DELETE ALL' || isDeletingAll}
            >
              {isDeletingAll ? 'Deleting...' : 'Permanently Delete Everything'}
            </Button>
          </Modal.Footer>
        </Modal>

        <Modal show={showBarcodeModal} onHide={() => setShowBarcodeModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="printBarcode" fallback="Print Barcode" /></Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p><Translate textKey="readyToPrintBarcode" fallback="Ready to print barcode for:" /></p>
            {itemToPrintBarcode && (
              <div>
                <p><strong>{itemToPrintBarcode.name}</strong></p>
                <p><Translate textKey="price" />: RS{parseFloat(itemToPrintBarcode.price).toFixed(2)}</p>
                <p><Translate textKey="barcodeLabel" />: {itemToPrintBarcode.barcode || itemToPrintBarcode.sku || itemToPrintBarcode.id}</p>
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowBarcodeModal(false)}>
              <Translate textKey="cancel" />
            </Button>
            <Button variant="primary" onClick={handlePrintBarcode}>
              <Translate textKey="printBarcode" />
            </Button>
            <Button variant="outline-primary" onClick={handlePrintBarcodePopup}>
              <Translate textKey="printPopup" fallback="Print (Popup)" />
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Category Management Modal */}
        < Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)} size="lg" >
          <Modal.Header closeButton>
            <Modal.Title>Manage Inventory Categories</Modal.Title>
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
                    placeholder={getTranslatedAttr("categoryName")}
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    required
                  />
                </Col>
                <Col md={5}>
                  <Form.Control
                    type="text"
                    placeholder={getTranslatedAttr("descriptionOptional")}
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  />
                </Col>
                <Col md={2}>
                  <Button type="submit" variant="primary" disabled={categoryLoading}>
                    <Translate textKey="add" />
                  </Button>
                </Col>
              </Row>
            </Form>

            <hr />

            <h6>Existing Categories</h6>
            {categoryLoading && !inventoryCategories.length ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" />
              </div>
            ) : inventoryCategories.length === 0 ? (
              <p className="text-muted">No categories yet. Add one above.</p>
            ) : (
              <Table hover size="sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {inventoryCategories.map(cat => (
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
                          Edit
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDeleteCategory(cat)}
                        >
                          Delete
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
              Close
            </Button>
          </Modal.Footer>
        </Modal >

        {/* Edit Category Modal */}
        < Modal show={showEditCategoryModal} onHide={() => setShowEditCategoryModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Category</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleUpdateCategory}>
            <Modal.Body>
              {categoryError && <Alert variant="danger">{categoryError}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label>Category Name</Form.Label>
                <Form.Control
                  type="text"
                  value={editCategory.name}
                  onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Description</Form.Label>
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
              <Button type="submit" variant="primary" disabled={categoryLoading}>
                {categoryLoading ? 'Updating...' : 'Update'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal >

        {/* Delete Category Confirmation Modal */}
        < Modal show={showDeleteCategoryModal} onHide={() => setShowDeleteCategoryModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Delete Category</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Are you sure you want to delete the category <strong>"{categoryToDelete?.name}"</strong>?</p>
            <p className="text-muted small">This will not delete products in this category, but the category will be removed from the dropdown.</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteCategoryModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteCategory} disabled={categoryLoading}>
              {categoryLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </Modal.Footer>
        </Modal >
      </Container >

      {/* Hidden printable barcode area (screen-hidden, print-visible) */}
      {
        printBarcodeData && (
          <div id="printable-wrapper" style={{ position: 'fixed', left: '-9999px', top: '-9999px' }}>
            <div id="printable-barcode">
              <div style={{
                fontFamily: 'Courier New, monospace',
                textAlign: 'center',
                padding: '20px',
                margin: '0',
                background: 'white',
                width: '300px',
                border: 'none',
                padding: '15px'
              }}>
                <div style={{
                  fontSize: '14px',
                  lineHeight: '1.2',
                  margin: '15px 0',
                  letterSpacing: '2px',
                  fontWeight: 'bold'
                }}>
                  {printBarcodeData.barcode}
                </div>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  marginTop: '12px',
                  letterSpacing: '3px'
                }}>
                  {printBarcodeData.barcodeNumber}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </>
  );
};

export default ViewStock;
