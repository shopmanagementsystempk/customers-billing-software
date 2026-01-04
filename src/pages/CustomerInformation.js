import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Container, Card, Table, Button, Form, Modal, Alert, Spinner, Row, Col, InputGroup, Badge } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { generateTransactionId } from '../utils/receiptUtils';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { db } from '../firebase/config';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs, writeBatch } from 'firebase/firestore';
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
    phone2: '',
    address: '',
    city: '',
    accountType: '',
    route: '',
    loan: '0',
    status: 'active'
  });
  const [accountTypes, setAccountTypes] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [showManageAccountTypes, setShowManageAccountTypes] = useState(false);
  const [showManageRoutes, setShowManageRoutes] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newRouteName, setNewRouteName] = useState('');
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
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

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

  const fetchLoans = useCallback(async () => {
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
  }, [activeShopId]);

  useEffect(() => {
    fetchLoans();
  }, [fetchLoans]);

  const fetchOptions = useCallback(async () => {
    if (!activeShopId) return;
    try {
      const atSnap = await getDocs(query(collection(db, 'accountTypes'), where('shopId', '==', activeShopId)));
      setAccountTypes(atSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

      const rSnap = await getDocs(query(collection(db, 'routes'), where('shopId', '==', activeShopId)));
      setRoutes(rSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error('Error fetching options:', err);
    }
  }, [activeShopId]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  const addAccountType = async () => {
    if (!newTypeName.trim() || !activeShopId) return;
    try {
      await addDoc(collection(db, 'accountTypes'), {
        name: newTypeName.trim(),
        shopId: activeShopId
      });
      setNewTypeName('');
      fetchOptions();
    } catch (err) {
      console.error("Error adding account type:", err);
    }
  };

  const deleteAccountType = async (id) => {
    try {
      await deleteDoc(doc(db, 'accountTypes', id));
      fetchOptions();
    } catch (err) {
      console.error("Error deleting account type:", err);
    }
  };

  const addRoute = async () => {
    if (!newRouteName.trim() || !activeShopId) return;
    try {
      await addDoc(collection(db, 'routes'), {
        name: newRouteName.trim(),
        shopId: activeShopId
      });
      setNewRouteName('');
      fetchOptions();
    } catch (err) {
      console.error("Error adding route:", err);
    }
  };

  const deleteRoute = async (id) => {
    try {
      await deleteDoc(doc(db, 'routes', id));
      fetchOptions();
    } catch (err) {
      console.error("Error deleting route:", err);
    }
  };

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

        // Update or create Opening Balance loan
        const loansRef = collection(db, 'customerLoans');
        const q = query(loansRef,
          where('shopId', '==', activeShopId),
          where('customerName', '==', editingCustomer.name),
          where('transactionId', '==', 'Opening Balance')
        );
        const snapshot = await getDocs(q);

        const newLoanAmount = parseFloat(formData.loan) || 0;

        if (!snapshot.empty) {
          const loanDoc = snapshot.docs[0];
          await updateDoc(doc(db, 'customerLoans', loanDoc.id), {
            amount: newLoanAmount,
            customerName: formData.name // sync name if changed
          });
        } else if (newLoanAmount > 0) {
          await addDoc(collection(db, 'customerLoans'), {
            shopId: activeShopId,
            customerName: formData.name,
            amount: newLoanAmount,
            type: 'loan',
            transactionId: 'Opening Balance',
            status: 'outstanding',
            timestamp: new Date().toISOString()
          });
        }
        setSuccess(getTranslatedAttr('customerUpdatedSuccess'));
      } else {
        await addDoc(collection(db, 'customers'), customerData);
        if (parseFloat(formData.loan) > 0) {
          await addDoc(collection(db, 'customerLoans'), {
            shopId: activeShopId,
            customerName: formData.name,
            amount: parseFloat(formData.loan),
            type: 'loan',
            transactionId: 'Opening Balance',
            status: 'outstanding',
            timestamp: new Date().toISOString()
          });
        }
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
      phone2: customer.phone2 || '',
      address: customer.address || '',
      city: customer.city || '',
      accountType: customer.accountType || '',
      route: customer.route || '',
      loan: customer.loan || '0',
      status: customer.status || 'active'
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
      phone2: '',
      address: '',
      city: '',
      accountType: '',
      route: '',
      loan: '0',
      status: 'active'
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
    customer.phone2?.includes(searchTerm) ||
    customer.route?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.accountType?.toLowerCase().includes(searchTerm.toLowerCase())
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
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      processCSV(event.target.result);
      // Reset input so the same file can be uploaded again if needed
      e.target.value = '';
    };
    reader.onerror = () => {
      setError('Failed to read file');
    };
    reader.readAsText(file);
  };

  const processCSV = async (content) => {
    if (!activeShopId) {
      setError('Active Shop ID is missing');
      return;
    }

    try {
      setImporting(true);
      setError('');
      setSuccess('');

      const lines = content.split(/\r\n|\n/).filter(line => line.trim());
      if (lines.length < 2) {
        setError('File is empty or missing headers');
        setImporting(false);
        return;
      }

      const parseCSVLine = (line) => {
        const result = [];
        let curValue = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            result.push(curValue.trim().replace(/^"|"$/g, ''));
            curValue = '';
          } else {
            curValue += char;
          }
        }
        result.push(curValue.trim().replace(/^"|"$/g, ''));
        return result;
      };

      const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
      const batch = writeBatch(db);
      let count = 0;
      const customersRef = collection(db, 'customers');
      const now = new Date();

      // Track types and routes to add
      const existingTypes = new Set(accountTypes.map(t => t.name.toLowerCase()));
      const existingRoutes = new Set(routes.map(r => r.name.toLowerCase()));
      const typesToAdd = new Set();
      const routesToAdd = new Set();

      for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        if (values.length === 0) continue;

        const customerInfo = {
          shopId: activeShopId,
          createdAt: now,
          updatedAt: now,
          name: '',
          phone: '',
          phone2: '',
          address: '',
          city: '',
          accountType: '',
          route: '',
          loan: '0',
          status: 'active'
        };

        headers.forEach((header, index) => {
          const value = values[index];
          if (value === undefined || value === null) return;

          if (header.includes('name')) {
            customerInfo.name = value;
          } else if (header.includes('phone 1') || header === 'phone') {
            customerInfo.phone = value;
          } else if (header.includes('phone 2') || header === 'phone2') {
            customerInfo.phone2 = value;
          } else if (header.includes('address')) {
            customerInfo.address = value;
          } else if (header.includes('city')) {
            customerInfo.city = value;
          } else if (header.includes('account type') || header === 'accounttype') {
            customerInfo.accountType = value;
            if (value && !existingTypes.has(value.toLowerCase())) {
              typesToAdd.add(value);
            }
          } else if (header.includes('route')) {
            customerInfo.route = value;
            if (value && !existingRoutes.has(value.toLowerCase())) {
              routesToAdd.add(value);
            }
          } else if (header.includes('loan')) {
            customerInfo.loan = value;
          } else if (header.includes('status')) {
            customerInfo.status = value.toLowerCase() === 'inactive' ? 'inactive' : 'active';
          }
        });

        if (customerInfo.name) {
          const newDocRef = doc(customersRef);
          batch.set(newDocRef, customerInfo);

          if (parseFloat(customerInfo.loan) > 0) {
            const loanRef = doc(collection(db, 'customerLoans'));
            batch.set(loanRef, {
              shopId: activeShopId,
              customerName: customerInfo.name,
              amount: parseFloat(customerInfo.loan),
              type: 'loan',
              transactionId: 'Opening Balance',
              status: 'outstanding',
              timestamp: now.toISOString()
            });
          }
          count++;
        }

        if (count >= 400) break; // Reduced slightly to account for dual entries in batch
      }

      // Add missing types and routes
      for (const typeName of typesToAdd) {
        const typeRef = doc(collection(db, 'accountTypes'));
        batch.set(typeRef, { name: typeName, shopId: activeShopId });
      }
      for (const routeName of routesToAdd) {
        const routeRef = doc(collection(db, 'routes'));
        batch.set(routeRef, { name: routeName, shopId: activeShopId });
      }

      if (count > 0) {
        await batch.commit();
        setSuccess(`Successfully imported ${count} customers and updated options.`);
        fetchCustomers();
        fetchOptions();
      } else {
        setError('No valid customer names found in CSV');
      }

    } catch (err) {
      console.error('Import error:', err);
      setError(`Failed to import customers: ${err.message}`);
    } finally {
      setImporting(false);
    }
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
          <Button variant="outline-success" className="ms-2" onClick={handleImportClick} disabled={importing}>
            {importing ? (
              <><Spinner size="sm" className="me-2" /><Translate textKey="importing" />...</>
            ) : (
              <><i className="bi bi-file-earmark-excel me-2"></i><Translate textKey="importExcel" fallback="Import from Excel (CSV)" /></>
            )}
          </Button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            accept=".csv"
            onChange={handleImportCSV}
          />
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
                    <th>Account Type</th>
                    <th><Translate textKey="name" /></th>
                    <th><Translate textKey="address" /></th>
                    <th><Translate textKey="city" /></th>
                    <th>Phone 1</th>
                    <th>Phone 2</th>
                    <th>Loan</th>
                    <th>Status</th>
                    <th>Route</th>
                    <th><Translate textKey="action" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map(customer => (
                    <tr key={customer.id}>
                      <td>{customer.accountType || '-'}</td>
                      <td>{customer.name}</td>
                      <td>{customer.address || '-'}</td>
                      <td>{customer.city || '-'}</td>
                      <td>{customer.phone || '-'}</td>
                      <td>{customer.phone2 || '-'}</td>
                      <td>
                        {(() => {
                          const custLoans = loans.filter(l => (l.customerName || '').toLowerCase() === (customer.name || '').toLowerCase());
                          const total = custLoans.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);
                          return <span>RS {total.toFixed(2)}</span>;
                        })()}
                      </td>
                      <td>
                        <Badge bg={customer.status === 'inactive' ? 'danger' : 'success'}>
                          {customer.status || 'active'}
                        </Badge>
                      </td>
                      <td>{customer.route || '-'}</td>
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
                    <Form.Label>Account Type</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Select
                        name="accountType"
                        value={formData.accountType}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Account Type</option>
                        {accountTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                      </Form.Select>
                      <Button variant="outline-secondary" size="sm" onClick={() => setShowManageAccountTypes(true)}>Manage</Button>
                    </div>
                  </Form.Group>
                </Col>
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
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="address" /></Form.Label>
                    <Form.Control
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Address"
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
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Phone No 1</Form.Label>
                    <Form.Control
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="Primary phone"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Phone No 2</Form.Label>
                    <Form.Control
                      type="tel"
                      name="phone2"
                      value={formData.phone2}
                      onChange={handleInputChange}
                      placeholder="Secondary phone"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Loan / Opening Balance</Form.Label>
                    <Form.Control
                      type="number"
                      name="loan"
                      value={formData.loan}
                      onChange={handleInputChange}
                      placeholder="0.00"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <Form.Select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Route</Form.Label>
                    <div className="d-flex gap-2">
                      <Form.Select
                        name="route"
                        value={formData.route}
                        onChange={handleInputChange}
                      >
                        <option value="">Select Route</option>
                        {routes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </Form.Select>
                      <Button variant="outline-secondary" size="sm" onClick={() => setShowManageRoutes(true)}>Manage</Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>
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

      <Modal show={showManageAccountTypes} onHide={() => setShowManageAccountTypes(false)}>
        <Modal.Header closeButton><Modal.Title>Manage Account Types</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Add New Type</Form.Label>
            <div className="d-flex gap-2">
              <Form.Control value={newTypeName} onChange={e => setNewTypeName(e.target.value)} placeholder="Type name" />
              <Button onClick={addAccountType}>Add</Button>
            </div>
          </Form.Group>
          <Table size="sm">
            <thead><tr><th>Name</th><th>Action</th></tr></thead>
            <tbody>
              {accountTypes.map(t => (
                <tr key={t.id}>
                  <td>{t.name}</td>
                  <td><Button variant="danger" size="sm" onClick={() => deleteAccountType(t.id)}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>

      <Modal show={showManageRoutes} onHide={() => setShowManageRoutes(false)}>
        <Modal.Header closeButton><Modal.Title>Manage Routes</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Add New Route</Form.Label>
            <div className="d-flex gap-2">
              <Form.Control value={newRouteName} onChange={e => setNewRouteName(e.target.value)} placeholder="Route name" />
              <Button onClick={addRoute}>Add</Button>
            </div>
          </Form.Group>
          <Table size="sm">
            <thead><tr><th>Name</th><th>Action</th></tr></thead>
            <tbody>
              {routes.map(r => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td><Button variant="danger" size="sm" onClick={() => deleteRoute(r.id)}>Delete</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>
    </>
  );
};

export default CustomerInformation;

