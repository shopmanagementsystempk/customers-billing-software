import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Table, Form, Row, Col, Spinner, Alert, Button } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import { db } from '../firebase/config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Translate } from '../utils';
import jsPDF from 'jspdf';

const LoadFormReport = () => {
  const { currentUser, activeShopId, shopData } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [staffMembers, setStaffMembers] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('All');

  const fetchReceipts = useCallback(async () => {
    if (!activeShopId) return;

    setLoading(true);
    setError('');
    try {
      const receiptsRef = collection(db, 'receipts');
      const q = query(
        receiptsRef,
        where('shopId', '==', activeShopId)
      );
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // Sort by timestamp descending
      data.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      setReceipts(data);
    } catch (err) {
      console.error('Error fetching receipts:', err);
      setError('Failed to load receipts');
    } finally {
      setLoading(false);
    }
  }, [activeShopId]);

  const fetchStaffMembers = useCallback(async () => {
    if (!activeShopId) return;
    try {
      const staffRef = collection(db, 'staff');
      const q = query(staffRef, where('shopId', '==', activeShopId));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log('Fetched staff members:', data);
      setStaffMembers(data);
    } catch (err) {
      console.error('Error fetching staff:', err);
    }
  }, [activeShopId]);

  useEffect(() => {
    if (activeShopId) {
      fetchReceipts();
      fetchStaffMembers();
    }
  }, [activeShopId, fetchReceipts, fetchStaffMembers]);

  // Filter receipts based on date range, search term, and staff
  const filteredReceipts = receipts.filter(receipt => {
    // Date filter
    if (dateFrom || dateTo) {
      const receiptDate = receipt.timestamp ? new Date(receipt.timestamp) : null;
      if (receiptDate) {
        if (dateFrom) {
          const fromDate = new Date(dateFrom);
          fromDate.setHours(0, 0, 0, 0);
          if (receiptDate < fromDate) return false;
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setHours(23, 59, 59, 999);
          if (receiptDate > toDate) return false;
        }
      }
    }

    // Staff filter - match by staff account (createdBy) OR by employeeName
    if (selectedStaff !== 'All') {
      const receiptsStaffMember = staffMembers.find(s => s.id === receipt.createdBy);
      const matchByAccount = receiptsStaffMember && receiptsStaffMember.name === selectedStaff;
      const matchByEmployee = receipt.employeeName === selectedStaff;
      if (!matchByAccount && !matchByEmployee) return false;
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        (receipt.transactionId || '').toLowerCase().includes(search) ||
        (receipt.customerName || '').toLowerCase().includes(search)
      );
    }

    return true;
  });

  // Get receipts to export (selected or all filtered)
  const getReceiptsToExport = () => {
    if (selectedRows.size > 0) {
      return filteredReceipts.filter(r => selectedRows.has(r.id));
    }
    return filteredReceipts;
  };

  // Calculate totals
  const totalNetAmount = filteredReceipts.reduce((sum, r) => sum + (parseFloat(r.totalAmount) || 0), 0);
  const selectedNetAmount = Array.from(selectedRows).reduce((sum, id) => {
    const receipt = filteredReceipts.find(r => r.id === id);
    return sum + (receipt ? parseFloat(receipt.totalAmount) || 0 : 0);
  }, 0);

  // Toggle row selection
  const toggleRowSelection = (id) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedRows(newSelected);
  };

  // Select/Deselect all
  const toggleSelectAll = () => {
    if (selectedRows.size === filteredReceipts.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredReceipts.map(r => r.id)));
    }
  };

  // Aggregate products from selected receipts
  const getAggregatedProducts = () => {
    const receiptsToExport = getReceiptsToExport();
    const productMap = new Map();

    receiptsToExport.forEach(receipt => {
      if (receipt.items && Array.isArray(receipt.items)) {
        receipt.items.forEach(item => {
          const productName = item.name || 'Unknown Product';
          const qty = parseFloat(item.quantity) || 0;
          
          if (productMap.has(productName)) {
            productMap.set(productName, productMap.get(productName) + qty);
          } else {
            productMap.set(productName, qty);
          }
        });
      }
    });

    return Array.from(productMap.entries()).map(([name, pcs]) => ({ name, pcs }));
  };

  // Export to CSV
  const exportToCSV = () => {
    const products = getAggregatedProducts();
    const headers = ['Product Name', 'Pcs'];
    const rows = products.map(p => [p.name, p.pcs.toFixed(2)]);

    const csvContent = [
      [shopData?.shopName || 'Shop'],
      [shopData?.address || ''],
      [],
      ['Load Form'],
      [`Staff: ${selectedStaff}`],
      [`Generated: ${formatDisplayDate(new Date())}`],
      [],
      headers,
      ...rows,
      [],
      ['Total Products', products.length],
      ['Total Pcs', products.reduce((sum, p) => sum + p.pcs, 0).toFixed(2)]
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `load_form_${selectedStaff}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Print Load Form
  const handlePrint = () => {
    const products = getAggregatedProducts();
    const totalPcs = products.reduce((sum, p) => sum + p.pcs, 0);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Load Form - ${selectedStaff}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 20px; }
          .shop-name { font-size: 24px; font-weight: bold; margin-bottom: 5px; }
          .shop-address { font-size: 12px; color: #666; margin-bottom: 15px; }
          .title { font-size: 18px; font-weight: bold; margin-bottom: 10px; }
          .staff { font-size: 14px; margin-bottom: 5px; }
          .date { font-size: 11px; color: #666; margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          th { background-color: #428bca; color: white; padding: 8px; text-align: left; border: 1px solid #ddd; }
          td { padding: 8px; border: 1px solid #ddd; }
          tr:nth-child(even) { background-color: #f8f8f8; }
          .total-row { background-color: #ddd; font-weight: bold; }
          .text-center { text-align: center; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="shop-name">${shopData?.shopName || 'Shop'}</div>
          <div class="shop-address">${shopData?.address || ''}</div>
          <div class="title">Load Form</div>
          <div class="staff">Staff: ${selectedStaff}</div>
          <div class="date">Date: ${formatDisplayDate(new Date())}</div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Product Name</th>
              <th class="text-center" style="width: 100px;">Pcs</th>
            </tr>
          </thead>
          <tbody>
            ${products
              .map(
                (p) => `
              <tr>
                <td>${p.name}</td>
                <td class="text-center">${p.pcs.toFixed(2)}</td>
              </tr>
            `
              )
              .join('')}
            <tr class="total-row">
              <td>Total</td>
              <td class="text-center">${totalPcs.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'absolute';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    iframe.contentWindow.document.open();
    iframe.contentWindow.document.write(printContent);
    iframe.contentWindow.document.close();

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  };

  // Export to PDF
  const exportToPDF = () => {
    const products = getAggregatedProducts();
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    let yPosition = margin;
    const lineHeight = 7;

    // Shop Name
    pdf.setFontSize(20);
    pdf.setFont('helvetica', 'bold');
    pdf.text(shopData?.shopName || 'Shop', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Shop Address
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    if (shopData?.address) {
      pdf.text(shopData.address, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += 6;
    }

    // Load Form Heading
    yPosition += 4;
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Load Form', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 8;

    // Staff Name
    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Staff: ${selectedStaff}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    // Date
    pdf.setFontSize(9);
    pdf.text(`Date: ${formatDisplayDate(new Date())}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 10;

    // Table headers
    const colWidths = [120, 40];
    const headers = ['Product Name', 'Pcs'];
    const tableStartX = (pageWidth - colWidths[0] - colWidths[1]) / 2;

    pdf.setFillColor(66, 139, 202);
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);

    let xPos = tableStartX;
    headers.forEach((header, i) => {
      pdf.rect(xPos, yPosition, colWidths[i], lineHeight, 'F');
      pdf.text(header, xPos + colWidths[i] / 2, yPosition + 5, { align: 'center' });
      xPos += colWidths[i];
    });
    yPosition += lineHeight;

    // Table rows
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);

    let totalPcs = 0;
    products.forEach((product, index) => {
      if (yPosition > 270) {
        pdf.addPage();
        yPosition = margin;
      }

      xPos = tableStartX;
      const fillColor = index % 2 === 0 ? [248, 248, 248] : [255, 255, 255];

      // Product Name
      pdf.setFillColor(...fillColor);
      pdf.setDrawColor(200, 200, 200);
      pdf.rect(xPos, yPosition, colWidths[0], lineHeight, 'FD');
      pdf.text(product.name.substring(0, 50), xPos + 3, yPosition + 5);
      xPos += colWidths[0];

      // Pcs
      pdf.setFillColor(...fillColor);
      pdf.rect(xPos, yPosition, colWidths[1], lineHeight, 'FD');
      pdf.text(product.pcs.toFixed(2), xPos + colWidths[1] / 2, yPosition + 5, { align: 'center' });

      totalPcs += product.pcs;
      yPosition += lineHeight;
    });

    // Total row
    yPosition += 2;
    xPos = tableStartX;
    pdf.setFont('helvetica', 'bold');
    pdf.setFillColor(220, 220, 220);
    pdf.rect(xPos, yPosition, colWidths[0], lineHeight, 'FD');
    pdf.text('Total', xPos + 3, yPosition + 5);
    xPos += colWidths[0];
    pdf.rect(xPos, yPosition, colWidths[1], lineHeight, 'FD');
    pdf.text(totalPcs.toFixed(2), xPos + colWidths[1] / 2, yPosition + 5, { align: 'center' });

    pdf.save(`load_form_${selectedStaff}_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <>
      <MainNavbar />
      <Container className="pos-content">
        <PageHeader
          title={<Translate textKey="loadFormReport" fallback="Load Form Report" />}
          icon="bi-file-earmark-text"
          subtitle="View all receipts generated"
        >
          <div className="hero-metrics__item">
            <span className="hero-metrics__label">Total Receipts</span>
            <span className="hero-metrics__value">{filteredReceipts.length}</span>
          </div>
        </PageHeader>

        <Card className="mb-4">
          <Card.Body>
            <Row className="mb-3">
              <Col md={2}>
                <Form.Group>
                  <Form.Label>From Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>To Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label>Staff</Form.Label>
                  <Form.Select
                    value={selectedStaff}
                    onChange={(e) => setSelectedStaff(e.target.value)}
                  >
                    <option value="All">All Staff</option>
                    {staffMembers.map((staff, index) => (
                      <option key={staff.id || index} value={staff.name}>{staff.name}</option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label>Search</Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Search by invoice or customer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </Form.Group>
              </Col>
              <Col md={3} className="d-flex align-items-end gap-2">
                <Button variant="success" size="sm" onClick={exportToCSV}>
                  <i className="bi bi-file-earmark-excel me-1"></i> CSV
                </Button>
                <Button variant="danger" size="sm" onClick={exportToPDF}>
                  <i className="bi bi-file-earmark-pdf me-1"></i> PDF
                </Button>
                <Button variant="primary" size="sm" onClick={handlePrint}>
                  <i className="bi bi-printer me-1"></i> Print
                </Button>
              </Col>
            </Row>

            {selectedRows.size > 0 && (
              <Alert variant="info" className="d-flex justify-content-between align-items-center">
                <span>
                  <strong>{selectedRows.size}</strong> receipt(s) selected | 
                  Selected Total: <strong>{formatCurrency(selectedNetAmount)}</strong>
                </span>
                <Button variant="outline-secondary" size="sm" onClick={() => setSelectedRows(new Set())}>
                  Clear Selection
                </Button>
              </Alert>
            )}

            {error && <Alert variant="danger">{error}</Alert>}

            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" />
              </div>
            ) : filteredReceipts.length === 0 ? (
              <div className="text-center py-4">
                <i className="bi bi-inbox" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                <p className="text-muted mt-3">No receipts found</p>
              </div>
            ) : (
              <div className="table-responsive">
                <Table striped bordered hover>
                  <thead className="table-dark">
                    <tr>
                      <th style={{ width: '40px' }}>
                        <Form.Check
                          type="checkbox"
                          checked={selectedRows.size === filteredReceipts.length && filteredReceipts.length > 0}
                          onChange={toggleSelectAll}
                        />
                      </th>
                      <th>Date</th>
                      <th>Invoice Number</th>
                      <th>Customer Name</th>
                      <th>Net Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReceipts.map(receipt => (
                      <tr 
                        key={receipt.id} 
                        className={selectedRows.has(receipt.id) ? 'table-primary' : ''}
                        style={{ cursor: 'pointer' }}
                        onClick={() => toggleRowSelection(receipt.id)}
                      >
                        <td onClick={(e) => e.stopPropagation()}>
                          <Form.Check
                            type="checkbox"
                            checked={selectedRows.has(receipt.id)}
                            onChange={() => toggleRowSelection(receipt.id)}
                          />
                        </td>
                        <td>{receipt.timestamp ? formatDisplayDate(new Date(receipt.timestamp)) : '-'}</td>
                        <td>{receipt.transactionId || receipt.id}</td>
                        <td>{receipt.customerName || 'Walk-in Customer'}</td>
                        <td>{formatCurrency(parseFloat(receipt.totalAmount) || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-secondary">
                    <tr>
                      <td colSpan="4" className="text-end fw-bold">Total:</td>
                      <td className="fw-bold">{formatCurrency(totalNetAmount)}</td>
                    </tr>
                  </tfoot>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default LoadFormReport;
