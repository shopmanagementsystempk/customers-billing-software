import React, { useEffect, useMemo, useState } from 'react';
import { Container, Card, Row, Col, Form, Button, Alert } from 'react-bootstrap';
import Select from 'react-select';
import { useLocation, useNavigate } from 'react-router-dom';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate, getTranslatedAttr } from '../components/Translate';
import { useAuth } from '../contexts/AuthContext';
import { getShopStock, addStockToItem } from '../utils/stockUtils';
import { formatDisplayDate } from '../utils/dateUtils';

const AddStockEntry = () => {
  const { currentUser, shopData, activeShopId } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stock, setStock] = useState([]);
  const [rows, setRows] = useState([{ item: null, quantity: '', costPrice: '', expiryDate: '', lowStockAlert: '' }]);
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentUser || !activeShopId) return;
    getShopStock(activeShopId).then(setStock);
  }, [currentUser, activeShopId]);

  const options = useMemo(
    () => stock.map(s => ({ value: s.id, label: s.name })),
    [stock]
  );

  // Preselect when navigated from inventory row
  useEffect(() => {
    const pre = location?.state?.preselectId;
    if (pre && rows?.length === 1) {
      const opt = options.find(o => o.value === pre);
      if (opt) {
        const selectedStockItem = stock.find(s => s.id === pre);
        setRows([{
          item: opt,
          quantity: '',
          costPrice: '',
          expiryDate: '',
          lowStockAlert: selectedStockItem?.lowStockAlert?.toString() || ''
        }]);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location?.state, options.length]);

  // Cleanup: Remove any print iframes when component unmounts
  useEffect(() => {
    return () => {
      const existingIframe = document.getElementById('print-stock-iframe');
      if (existingIframe && existingIframe.parentNode) {
        existingIframe.parentNode.removeChild(existingIframe);
      }
    };
  }, []);

  const setRowValue = (idx, key, value) => {
    setRows(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [key]: value };
      return next;
    });
  };

  const addRow = () => setRows(prev => [...prev, { item: null, quantity: '', costPrice: '', expiryDate: '', lowStockAlert: '' }]);
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const validRows = rows.filter(r => r.item && parseFloat(r.quantity) > 0);
    if (validRows.length === 0) { setError('Add at least one item and quantity'); return; }
    if (!activeShopId) { setError('Select a branch before adding stock.'); return; }
    setLoading(true);
    try {
      // Process all rows
      for (const r of validRows) {
        await addStockToItem(activeShopId, r.item.value, parseFloat(r.quantity), {
          costPrice: r.costPrice,
          supplier,
          note,
          expiryDate: r.expiryDate,
          purchaseDate,
          lowStockAlert: r.lowStockAlert && r.lowStockAlert.trim() ? parseFloat(r.lowStockAlert) : undefined
        });
      }
      setSuccess('Stock added successfully');
      printInvoice(validRows);
      // reset
      setRows([{ item: null, quantity: '', costPrice: '', expiryDate: '', lowStockAlert: '' }]);
      setSupplier('');
      setNote('');
      setPurchaseDate(new Date().toISOString().slice(0, 10));
    } catch (err) {
      setError(err.message || 'Failed to add stock');
    } finally {
      setLoading(false);
    }
  };

  const printInvoice = (validRows) => {
    try {
      // Remove any existing print iframe
      const existingIframe = document.getElementById('print-stock-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }

      // Create a hidden iframe for printing
      const iframe = document.createElement('iframe');
      iframe.id = 'print-stock-iframe';
      iframe.style.position = 'fixed';
      iframe.style.right = '0';
      iframe.style.bottom = '0';
      iframe.style.width = '0';
      iframe.style.height = '0';
      iframe.style.border = '0';
      document.body.appendChild(iframe);

      const now = new Date();
      const purchaseDateDisplay = formatDisplayDate(purchaseDate);
      const entryDateDisplay = formatDisplayDate(now);
      const bodyRows = (validRows || []).map(r => {
        const item = r.item ? stock.find(s => s.id === r.item.value) : null;
        const expiryText = formatDisplayDate(r.expiryDate);
        return `
          <tr>
            <td style="font-weight: 700 !important;">${item?.name || '-'}</td>
            <td style="text-align:right; font-weight: 700 !important;">${parseFloat(r.quantity).toFixed(2)}</td>
            <td style="font-weight: 700 !important;">${item?.quantityUnit || 'units'}</td>
            <td style="font-weight: 700 !important;">${expiryText}</td>
            <td style="font-weight: 700 !important;">${purchaseDateDisplay}</td>
            <td style="text-align:right; font-weight: 700 !important;">${r.costPrice ? Number(r.costPrice).toFixed(2) : '-'}</td>
          </tr>
        `;
      }).join('');
      const html = `
        <html>
          <head>
            <title>Stock In - ${shopData?.shopName || 'Shop'}</title>
            <style>
              * { font-weight: 700 !important; }
              body { font-family: Arial, sans-serif; padding: 20px; color: #111; font-weight: 700 !important; }
              h2 { margin: 0 0 10px 0; font-weight: 700 !important; }
              .meta { font-size: 12px; color: #555; margin-bottom: 20px; font-weight: 700 !important; }
              .meta * { font-weight: 700 !important; }
              .meta strong { font-weight: 700 !important; }
              strong { font-weight: 700 !important; }
              .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              .table th, .table td { border: 1px solid #ccc; padding: 8px; font-size: 13px; font-weight: 700 !important; }
              .table th { background: #f3f4f6; text-align: left; font-weight: 700 !important; }
              .tot { margin-top: 15px; font-weight: 700 !important; }
              @media print { 
                @page { size: A4; margin: 16mm; }
                * { font-weight: 700 !important; }
                .meta * { font-weight: 700 !important; }
                strong { font-weight: 700 !important; }
              }
            </style>
          </head>
          <body>
            <h2 style="font-weight: 700 !important;">${shopData?.shopName || 'Shop'} - Stock In</h2>
            <div class="meta" style="font-weight: 700 !important;">
              <strong style="font-weight: 700 !important;">Entry Date: ${entryDateDisplay} ${now.toLocaleTimeString()}</strong><br/>
              <strong style="font-weight: 700 !important;">Purchase Date: ${purchaseDateDisplay}</strong><br/>
              <strong style="font-weight: 700 !important;">Supplier: ${supplier || '-'}</strong><br/>
              <strong style="font-weight: 700 !important;">Note: ${note || '-'}</strong>
            </div>
            <table class="table">
              <thead>
                <tr>
                  <th style="font-weight: 700 !important;">Item</th>
                  <th style="font-weight: 700 !important;">Qty Added</th>
                  <th style="font-weight: 700 !important;">Unit</th>
                  <th style="font-weight: 700 !important;">Expiry</th>
                  <th style="font-weight: 700 !important;">Purchase Date</th>
                  <th style="font-weight: 700 !important;">Cost Price</th>
                </tr>
              </thead>
              <tbody>
                ${bodyRows}
              </tbody>
            </table>
            <div class="tot" style="font-weight: 700 !important;">Received by: ____________</div>
          </body>
        </html>
      `;

      // Write content to iframe
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      iframeDoc.open();
      iframeDoc.write(html);
      iframeDoc.close();

      // Print and remove iframe after printing
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();

        // Remove iframe after printing completes
        setTimeout(() => {
          if (iframe && iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        }, 1000);
      }, 200);
    } catch (e) {
      console.error('print error', e);
    }
  };

  return (
    <>
      <MainNavbar />
      <Container className="mt-3">
        <PageHeader
          title={<Translate textKey="stockInTitle" fallback="Add Stock" />}
          icon="bi-box-arrow-in-down"
          subtitle={<Translate textKey="stockInSubtitle" fallback="Record incoming deliveries and update product quantities." />}
        />
        <div className="page-header-actions">
          <Button variant="outline-secondary" onClick={() => navigate('/stock')}>
            <Translate textKey="backToInventory" fallback="Back to Inventory" />
          </Button>
        </div>
        <Card>
          <Card.Body>
            {error && <Alert variant="danger" className="mb-3">{error}</Alert>}
            {success && <Alert variant="success" className="mb-3">{success}</Alert>}
            <Form onSubmit={handleSubmit}>
              {rows.map((r, idx) => (
                <div key={idx} className="border rounded-3 p-3 mb-3 bg-light-subtle">
                  <Row className="g-3 align-items-end">
                    <Col md={5}>
                      <Form.Label><Translate textKey="item" fallback="Item" /></Form.Label>
                      <Select
                        value={r.item}
                        onChange={(opt) => {
                          setRowValue(idx, 'item', opt);
                          // Auto-populate lowStockAlert if item has one
                          if (opt) {
                            const selectedStockItem = stock.find(s => s.id === opt.value);
                            if (selectedStockItem?.lowStockAlert !== undefined && selectedStockItem?.lowStockAlert !== null) {
                              setRowValue(idx, 'lowStockAlert', selectedStockItem.lowStockAlert.toString());
                            }
                          }
                        }}
                        options={options}
                        placeholder="Select existing item"
                        classNamePrefix="select"
                      />
                    </Col>
                    <Col md={3}>
                      <Form.Label><Translate textKey="quantityToAdd" fallback="Quantity to add" /></Form.Label>
                      <Form.Control
                        type="number"
                        value={r.quantity}
                        onChange={(e) => setRowValue(idx, 'quantity', e.target.value)}
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Label><Translate textKey="costPrice" fallback="Cost price" /></Form.Label>
                      <Form.Control
                        type="number"
                        value={r.costPrice}
                        onChange={(e) => setRowValue(idx, 'costPrice', e.target.value)}
                        placeholder="0"
                        min="0"
                        step="0.01"
                      />
                    </Col>
                    <Col md={2}>
                      <Form.Label><Translate textKey="expiryDate" fallback="Expiry Date" /> ({getTranslatedAttr("optional")})</Form.Label>
                      <Form.Control
                        type="date"
                        value={r.expiryDate || ''}
                        onChange={(e) => setRowValue(idx, 'expiryDate', e.target.value)}
                      />
                    </Col>
                  </Row>
                  <Row className="g-3 mt-1">
                    <Col md={4}>
                      <Form.Label>Low Stock Alert (Optional)</Form.Label>
                      <Form.Control
                        type="number"
                        min="0"
                        step="0.01"
                        value={r.lowStockAlert || ''}
                        onChange={(e) => setRowValue(idx, 'lowStockAlert', e.target.value)}
                        placeholder="Minimum quantity"
                      />
                      <Form.Text className="text-muted" style={{ fontSize: '0.75rem' }}>
                        Alert when stock falls below this quantity
                      </Form.Text>
                    </Col>
                  </Row>
                  <div className="d-flex justify-content-end mt-3">
                    <Button variant="outline-danger" onClick={() => removeRow(idx)} disabled={rows.length === 1}>
                      <Translate textKey="remove" />
                    </Button>
                  </div>
                </div>
              ))}
              <div className="mt-2">
                <Button variant="outline-primary" onClick={addRow}>+ <Translate textKey="addItem" /></Button>
              </div>
              <Row className="g-3 mt-3">
                <Col md={4}>
                  <Form.Label><Translate textKey="supplierLabel" /> ({getTranslatedAttr("optional")})</Form.Label>
                  <Form.Control
                    type="text"
                    value={supplier}
                    onChange={(e) => setSupplier(e.target.value)}
                    placeholder={getTranslatedAttr("supplierLabel")}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label><Translate textKey="purchaseDateLabel" /></Form.Label>
                  <Form.Control
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                </Col>
                <Col md={4}>
                  <Form.Label><Translate textKey="notes" /> ({getTranslatedAttr("optional")})</Form.Label>
                  <Form.Control
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={getTranslatedAttr("noteOptional")}
                  />
                </Col>
              </Row>
              <div className="mt-4 d-flex gap-2">
                <Button type="submit" variant="primary" disabled={loading}>
                  {loading ? <Translate textKey="adding" /> : <Translate textKey="addStockAndPrint" />}
                </Button>
                <Button variant="outline-secondary" onClick={() => navigate('/stock')}>
                  <Translate textKey="cancel" />
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default AddStockEntry;

