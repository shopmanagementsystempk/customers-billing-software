import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Card, Table, Button, Form, Modal, Alert, Spinner, Row, Col, InputGroup, Badge } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { generateTransactionId } from '../utils/receiptUtils';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { db } from '../firebase/config';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { Translate, useTranslatedAttribute } from '../utils';

const CustomerInformation = () => {
  const { currentUser, activeShopId, shopData } = useAuth();
  const getTranslatedAttr = useTranslatedAttribute();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loansLoading, setLoansLoading] = useState(false);
  const [showLoansModal, setShowLoansModal] = useState(false);
  const [selectedCustomerLoans, setSelectedCustomerLoans] = useState([]);
  const [selectedCustomerName, setSelectedCustomerName] = useState('');
  const [showPayLoanModal, setShowPayLoanModal] = useState(false);
  const [payingCustomerName, setPayingCustomerName] = useState('');
  const [customerOutstandingLoans, setCustomerOutstandingLoans] = useState([]);
  const [outstandingTotal, setOutstandingTotal] = useState(0);
  const [payLoading, setPayLoading] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('0');
  const [paymentTransactionId, setPaymentTransactionId] = useState('');
  const printIframeRef = useRef(null);

  const fetchCustomers = useCallback(async () => {
    if (!activeShopId) return;

    setLoading(true);
    try {
      const customersRef = collection(db, 'customers');
      const q = query(
        customersRef,
        where('shopId', '==', activeShopId)
      );
      const querySnapshot = await getDocs(q);
      const customersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by name in JavaScript to avoid Firestore index requirement
      customersData.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setCustomers(customersData);
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(getTranslatedAttr('failedToLoadCustomers'));
    } finally {
      setLoading(false);
    }
  }, [activeShopId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    const fetchLoans = async () => {
      if (!activeShopId) return;
      setLoansLoading(true);
      try {
        const loansRef = collection(db, 'customerLoans');
        const q = query(loansRef, where('shopId', '==', activeShopId));
        const snapshot = await getDocs(q);
        const loanData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setLoans(loanData);
      } catch (err) {
        console.error('Error fetching customer loans:', err);
      } finally {
        setLoansLoading(false);
      }
    };
    fetchLoans();
  }, [activeShopId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!formData.name.trim()) {
      setError(getTranslatedAttr('customerNameRequired'));
      return;
    }

    if (!activeShopId) {
      setError('Shop ID is missing');
      return;
    }

    try {
      const customerData = {
        ...formData,
        shopId: activeShopId,
        createdAt: editingCustomer ? editingCustomer.createdAt : new Date(),
        updatedAt: new Date()
      };

      if (editingCustomer) {
        const customerRef = doc(db, 'customers', editingCustomer.id);
        await updateDoc(customerRef, customerData);
        setSuccess(getTranslatedAttr('customerUpdatedSuccess'));
      } else {
        await addDoc(collection(db, 'customers'), customerData);
        setSuccess(getTranslatedAttr('customerAddedSuccess'));
      }

      setShowModal(false);
      resetForm();
      fetchCustomers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving customer:', err);
      setError(getTranslatedAttr('failedToSaveCustomer') + ': ' + err.message);
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      address: customer.address || '',
      city: customer.city || '',
      notes: customer.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = (customer) => {
    setCustomerToDelete(customer);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!customerToDelete) return;

    try {
      await deleteDoc(doc(db, 'customers', customerToDelete.id));
      setSuccess(getTranslatedAttr('customerDeletedSuccess'));
      setShowDeleteModal(false);
      setCustomerToDelete(null);
      fetchCustomers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting customer:', err);
      setError(getTranslatedAttr('failedToDeleteCustomer') + ': ' + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      notes: ''
    });
    setEditingCustomer(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.phone?.includes(searchTerm) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openPayLoanModal = (customer) => {
    const custLoans = loans.filter(l => (l.customerName || '').toLowerCase() === (customer.name || '').toLowerCase() && (l.status || 'outstanding') !== 'paid');
    const total = custLoans.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
    setCustomerOutstandingLoans(custLoans);
    setOutstandingTotal(total);
    setPayingCustomerName(customer.name || '');
    setPaymentAmount(total.toFixed(2));
    setPaymentTransactionId(generateTransactionId());
    setShowPayLoanModal(true);
  };

  const confirmPayLoan = async () => {
    if (customerOutstandingLoans.length === 0) {
      setShowPayLoanModal(false);
      return;
    }
    setPayLoading(true);
    try {
      let remaining = Math.max(0, Math.min(parseFloat(paymentAmount) || 0, outstandingTotal));
      const now = new Date().toISOString();
      const sorted = [...customerOutstandingLoans].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
      const updatedLoansLocal = [...loans];
      for (const loan of sorted) {
        if (remaining <= 0) break;
        const amt = Math.max(0, parseFloat(loan.amount) || 0);
        if (remaining >= amt) {
          await updateDoc(doc(db, 'customerLoans', loan.id), {
            status: 'paid',
            paidAt: now,
            paidAmount: amt,
            amount: 0
          });
          const idx = updatedLoansLocal.findIndex(l => l.id === loan.id);
          if (idx >= 0) updatedLoansLocal[idx] = { ...updatedLoansLocal[idx], status: 'paid', amount: 0, paidAt: now, paidAmount: amt };
          remaining -= amt;
        } else {
          await updateDoc(doc(db, 'customerLoans', loan.id), {
            status: 'outstanding',
            paidAt: now,
            paidAmount: (parseFloat(loan.paidAmount) || 0) + remaining,
            amount: (amt - remaining)
          });
          const idx = updatedLoansLocal.findIndex(l => l.id === loan.id);
          if (idx >= 0) updatedLoansLocal[idx] = { ...updatedLoansLocal[idx], status: 'outstanding', amount: (amt - remaining), paidAt: now, paidAmount: (parseFloat(loan.paidAmount) || 0) + remaining };
          remaining = 0;
        }
      }
      setLoans(updatedLoansLocal);
      await addDoc(collection(db, 'customerLoanPayments'), {
        shopId: activeShopId,
        customerName: payingCustomerName,
        transactionId: paymentTransactionId,
        amountPaid: Math.max(0, Math.min(parseFloat(paymentAmount) || 0, outstandingTotal)),
        timestamp: now
      });
      setShowPayLoanModal(false);
      setSuccess(getTranslatedAttr('loanPaymentRecorded'));
      setTimeout(() => setSuccess(''), 3000);
      const amtToPrint = Math.max(0, Math.min(parseFloat(paymentAmount) || 0, outstandingTotal));
      printPaymentReceipt(paymentTransactionId, payingCustomerName, amtToPrint);
    } catch (err) {
      setError(getTranslatedAttr('failedToPayLoan') + ': ' + err.message);
    } finally {
      setPayLoading(false);
    }
  };

  const printPaymentReceipt = (transactionId, customerName, amount) => {
    const existing = document.getElementById('print-iframe');
    if (existing) existing.remove();
    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const currentDate = new Date().toLocaleDateString();
    const currentTime = new Date().toLocaleTimeString();
    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Loan Payment - ${shopData?.shopName || 'Shop'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @media print { body { margin: 0; padding: 0; } }
            body { width: 80mm; font-family: 'Courier New', monospace; color: #000; margin: 0 auto; background: #fff; padding: 6mm 4mm; font-weight: 700; }
            .center { text-align: center; }
            .header-logo { max-height: 36px; margin: 6px auto 8px; display: block; }
            .shop-name { font-size: 20px; font-weight: 700; margin: 4px 0; }
            .shop-address, .shop-phone { font-size: 12px; margin: 2px 0; }
            .sep { border-top: 1px dotted #000; margin: 6px 0; }
            .meta { display: grid; grid-template-columns: 1fr 1fr; font-size: 12px; margin: 6px 0; }
            .meta-right { text-align: right; }
            .totals { margin-top: 8px; border-top: 1px dotted #000; border-bottom: 1px dotted #000; padding: 6px 0; font-size: 12px; }
            .line { display: flex; justify-content: space-between; margin: 3px 0; }
            .net { text-align: right; font-weight: 700; font-size: 18px; margin-top: 6px; }
            .thanks { text-align: center; margin-top: 12px; font-size: 12px; }
            .dev { text-align: center; margin-top: 40px; padding: 6px 0; font-size: 10px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
          </style>
        </head>
        <body>
          <div class="center">
            ${shopData?.logoUrl ? `<img class="header-logo" src="${shopData.logoUrl}" alt="logo" onerror='this.style.display="none"' />` : ''}
            <div class="shop-name">${shopData?.shopName || 'Shop Name'}</div>
            ${shopData?.address ? `<div class="shop-address">${shopData.address}</div>` : ''}
            <div class="shop-phone">Phone # ${shopData?.phoneNumbers?.[0] || shopData?.phoneNumber || ''}</div>
          </div>
          <div class="sep"></div>
          <div class="meta">
            <div>Payment: ${transactionId}</div>
            <div class="meta-right">${currentDate} ${currentTime}</div>
          </div>
          <div class="sep"></div>
          <div style="font-size:12px; margin-bottom:8px;">Received loan payment from: <strong>${customerName}</strong></div>
          <div class="totals">
            <div class="line"><span>Amount Paid</span><span>${Math.round(parseFloat(amount))}</span></div>
          </div>
          <div class="net">${Math.round(parseFloat(amount))}</div>
          <div class="thanks">Thank you</div>
          <div class="dev">software developed by SARMAD 03425050007</div>
        </body>
      </html>
    `;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(receiptHTML);
    iframeDoc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => { if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 1000);
    }, 250);
  };

  return (
    <>
      <MainNavbar />
      <Container className="pos-content">
        <PageHeader
          title={<Translate textKey="customerInformation" />}
          icon="bi-people"
          subtitle={<Translate textKey="manageCustomersSubtitle" />}
        >
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="totalCustomers" /></span>
            <span className="hero-metrics__value">{customers.length}</span>
          </div>
        </PageHeader>

        <div className="page-header-actions mb-3">
          <Button variant="primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <i className="bi bi-plus-circle me-2"></i><Translate textKey="addNewCustomer" />
          </Button>
        </div>

        {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

        <Card>
          <Card.Body>
            <Row className="mb-3">
              <Col md={6}>
                <InputGroup>
                  <InputGroup.Text>
                    <i className="bi bi-search"></i>
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder={getTranslatedAttr('searchCustomerPlaceholder')}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </InputGroup>
              </Col>
            </Row>

            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" />
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-4">
                <i className="bi bi-people" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                <p className="text-muted mt-3">
                  {searchTerm ? getTranslatedAttr('noReceiptsMatch') : <Translate textKey="noDataFound" />}
                </p>
              </div>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th><Translate textKey="name" /></th>
                    <th><Translate textKey="phone" /></th>
                    <th><Translate textKey="email" /></th>
                    <th><Translate textKey="address" /></th>
                    <th><Translate textKey="city" /></th>
                    <th><Translate textKey="loans" /></th>
                    <th><Translate textKey="action" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => (
                    <tr key={customer.id}>
                      <td>{customer.name}</td>
                      <td>{customer.phone || '-'}</td>
                      <td>{customer.email || '-'}</td>
                      <td>{customer.address || '-'}</td>
                      <td>{customer.city || '-'}</td>
                      <td>
                        {(() => {
                          const custLoans = loans.filter(l => (l.customerName || '').toLowerCase() === (customer.name || '').toLowerCase());
                          const count = custLoans.length;
                          const total = custLoans.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
                          return (
                            <div>
                              <Badge bg={count > 0 ? 'danger' : 'secondary'}>{count}</Badge>
                              <span className="ms-2">RS {total.toFixed(2)}</span>
                            </div>
                          );
                        })()}
                      </td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => {
                            const custLoans = loans.filter(l => (l.customerName || '').toLowerCase() === (customer.name || '').toLowerCase());
                            setSelectedCustomerLoans(custLoans);
                            setSelectedCustomerName(customer.name || '');
                            setShowLoansModal(true);
                          }}
                        >
                          <Translate textKey="viewLoans" />
                        </Button>
                        {(() => {
                          const custLoans = loans.filter(l => (l.customerName || '').toLowerCase() === (customer.name || '').toLowerCase() && (l.status || 'outstanding') !== 'paid');
                          const total = custLoans.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
                          return total > 0 ? (
                            <Button
                              variant="outline-success"
                              size="sm"
                              className="me-2"
                              onClick={() => openPayLoanModal(customer)}
                            >
                              <Translate textKey="payLoan" />
                            </Button>
                          ) : null;
                        })()}
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => handleEdit(customer)}
                        >
                          <i className="bi bi-pencil"></i> <Translate textKey="edit" />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(customer)}
                        >
                          <i className="bi bi-trash"></i> <Translate textKey="delete" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>

        {/* Add/Edit Modal */}
        <Modal show={showModal} onHide={handleCloseModal} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>{editingCustomer ? <Translate textKey="editCustomer" /> : <Translate textKey="addNewCustomer" />}</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="name" /> *</Form.Label>
                    <Form.Control
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Customer name"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="phone" /></Form.Label>
                    <Form.Control
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="Phone number"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="email" /></Form.Label>
                    <Form.Control
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="Email address"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="city" /></Form.Label>
                    <Form.Control
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      placeholder="City"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="address" /></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  placeholder="Full address"
                />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="notes" /></Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Additional notes about the customer"
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                <Translate textKey="cancel" />
              </Button>
              <Button variant="primary" type="submit">
                {editingCustomer ? <Translate textKey="save" /> : <Translate textKey="add" />}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="delete" /></Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p><Translate textKey="confirmDeleteCustomer" values={{ name: customerToDelete?.name }} /></p>
            <p className="text-muted small"><Translate textKey="deleteItemConfirmation" /></p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              <Translate textKey="cancel" />
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              <Translate textKey="delete" />
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>

      <Modal show={showLoansModal} onHide={() => setShowLoansModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title><Translate textKey="loanHistory" /> - {selectedCustomerName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {loansLoading ? (
            <div className="text-center py-3"><Spinner animation="border" /></div>
          ) : selectedCustomerLoans.length === 0 ? (
            <p className="text-muted">No loans recorded for this customer.</p>
          ) : (
            <Table hover size="sm">
              <thead>
                <tr>
                  <th><Translate textKey="date" /></th>
                  <th><Translate textKey="transactionId" /></th>
                  <th><Translate textKey="total" /></th>
                  <th><Translate textKey="status" /></th>
                </tr>
              </thead>
              <tbody>
                {selectedCustomerLoans.map(loan => (
                  <tr key={loan.id}>
                    <td>{loan.timestamp ? new Date(loan.timestamp).toLocaleString() : '-'}</td>
                    <td>{loan.transactionId || loan.receiptId || '-'}</td>
                    <td>RS {(parseFloat(loan.amount) || 0).toFixed(2)}</td>
                    <td>{loan.status || getTranslatedAttr('outstanding')}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowLoansModal(false)}><Translate textKey="close" /></Button>
        </Modal.Footer>
      </Modal>

      <Modal show={showPayLoanModal} onHide={() => setShowPayLoanModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title><Translate textKey="payLoan" /> - {payingCustomerName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p><Translate textKey="outstanding" />: RS {outstandingTotal.toFixed(2)}</p>
          <Form.Group className="mb-3">
            <Form.Label><Translate textKey="amountToPay" /></Form.Label>
            <Form.Control
              type="number"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              min="0"
              step="0.01"
            />
            <Form.Text className="text-muted">Max: RS {outstandingTotal.toFixed(2)}</Form.Text>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowPayLoanModal(false)} disabled={payLoading}><Translate textKey="cancel" /></Button>
          <Button variant="success" onClick={confirmPayLoan} disabled={payLoading || outstandingTotal <= 0 || (parseFloat(paymentAmount) || 0) <= 0}>
            {payLoading ? <Translate textKey="processing" /> : <Translate textKey="payNow" />}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default CustomerInformation;

