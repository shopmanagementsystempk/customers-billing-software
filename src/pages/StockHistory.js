import React, { useEffect, useState } from 'react';
import { Container, Card, Table, Button, Form } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../contexts/AuthContext';
import { getStockMovements, getShopStock } from '../utils/stockUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import { Translate, getTranslatedAttr } from '../components/Translate';

const StockHistory = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  const [movements, setMovements] = useState([]);
  const [items, setItems] = useState([]);
  const [filterItem, setFilterItem] = useState('');

  useEffect(() => {
    if (!currentUser || !activeShopId) return;
    getShopStock(activeShopId).then(setItems);
    getStockMovements(activeShopId).then(setMovements);
  }, [currentUser, activeShopId]);

  const filtered = movements.filter(m => filterItem ? m.itemId === filterItem : true);

  const printHistory = () => {
    const win = window.open('', '_blank');
    const rows = filtered.map(m => `
      <tr>
        <td>${m.itemName || '-'}</td>
        <td>${m.type}</td>
        <td style="text-align:right">${m.quantity}</td>
        <td>${m.unit || '-'}</td>
        <td>${m.supplier || '-'}</td>
        <td>${m.note || '-'}</td>
        <td>${formatDisplayDate(m.createdAt)}</td>
      </tr>
    `).join('');
    win.document.write(`
      <html><head><title>Stock History</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;}
        table{width:100%;border-collapse:collapse}
        th,td{border:1px solid #ccc;padding:6px;font-size:12px}
        th{background:#f3f4f6;text-align:left}
        @media print { @page { size:A4; margin:14mm } }
      </style>
      </head><body>
      <h3>Stock History</h3>
      <table><thead><tr>
        <th>Item</th><th>Type</th><th>Qty</th><th>Unit</th><th>Supplier</th><th>Note</th><th>Time</th>
      </tr></thead><tbody>${rows}</tbody></table>
      </body></html>
    `);
    win.document.close();
    setTimeout(() => win.print(), 200);
  };

  return (
    <>
      <MainNavbar />
      <Container className="mt-3">
        <PageHeader
          title={<Translate textKey="stockHistory" fallback="Stock History" />}
          icon="bi-clock-history"
          subtitle={<Translate textKey="stockHistorySubtitle" fallback="Review all stock in and stock out transactions for your store." />}
        />
        <div className="page-header-actions">
          <div className="d-flex gap-2 flex-wrap">
            <Button variant="outline-secondary" onClick={() => navigate('/stock')}><Translate textKey="back" /></Button>
            <Button variant="primary" onClick={printHistory}><Translate textKey="print" /></Button>
          </div>
        </div>
        <Card>
          <Card.Body>
            <div className="d-flex align-items-center gap-2 mb-3">
              <Form.Label className="mb-0"><Translate textKey="filterItem" fallback="Filter item:" /></Form.Label>
              <Form.Select value={filterItem} onChange={(e) => setFilterItem(e.target.value)} style={{ maxWidth: 280 }}>
                <option value=""><Translate textKey="allCategories" fallback="All items" /></option>
                {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </Form.Select>
            </div>
            <div className="table-responsive">
              <Table hover size="sm">
                <thead>
                  <tr>
                    <th><Translate textKey="item" /></th>
                    <th><Translate textKey="type" /></th>
                    <th><Translate textKey="quantity" /></th>
                    <th><Translate textKey="unit" /></th>
                    <th><Translate textKey="supplier" /></th>
                    <th><Translate textKey="notes" /></th>
                    <th><Translate textKey="time" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(m => (
                    <tr key={m.id}>
                      <td>{m.itemName || '-'}</td>
                      <td><Translate textKey={m.type === 'Stock In' ? 'stockInType' : (m.type === 'Stock Out' ? 'stockOutType' : m.type)} fallback={m.type} /></td>
                      <td>{m.quantity}</td>
                      <td><Translate textKey={m.unit} fallback={m.unit || '-'} /></td>
                      <td>{m.supplier || '-'}</td>
                      <td>{m.note || '-'}</td>
                      <td>{formatDisplayDate(m.createdAt)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="text-center text-muted"><Translate textKey="noDataFound" /></td></tr>
                  )}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default StockHistory;


