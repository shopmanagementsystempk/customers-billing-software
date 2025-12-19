import React, { useState, useEffect } from 'react';
import { Container, Card, Button, Row, Col, Form, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase/config';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import Select from 'react-select';
import './GuestNewReceipt.css';
import '../styles/select.css';

function GuestNewReceipt() {
  const { currentUser, isGuest, activeShopId } = useAuth();
  const navigate = useNavigate();
  
  // Guest-specific state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Receipt data
  const [receiptNumber, setReceiptNumber] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [items, setItems] = useState([
    { name: '', quantity: 1, price: 0, total: 0 }
  ]);
  const [subtotal, setSubtotal] = useState(0);
  const [tax, setTax] = useState(0);
  const [total, setTotal] = useState(0);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  
  // Shop settings
  const [shopData, setShopData] = useState({
    name: '',
    address: '',
    phone: '',
    receiptDescription: ''
  });

  // Check if user is guest
  useEffect(() => {
    if (!isGuest) {
      navigate('/dashboard');
      return;
    }
    
    // Load shop data for receipt
    const loadShopData = async () => {
      try {
        const shopQuery = query(collection(db, 'shops'), where('userId', '==', activeShopId || currentUser.uid));
        const shopSnapshot = await getDocs(shopQuery);
        
        if (!shopSnapshot.empty) {
          const shopDoc = shopSnapshot.docs[0];
          const data = shopDoc.data();
          setShopData({
            name: data.name || '',
            address: data.address || '',
            phone: data.phone || '',
            receiptDescription: data.receiptDescription || ''
          });
        }
      } catch (error) {
        console.error('Error loading shop data:', error);
      }
    };
    
    loadShopData();
  }, [isGuest, currentUser, navigate, activeShopId]);

  // Fetch employees
  useEffect(() => {
    if (currentUser && isGuest && activeShopId) {
      const fetchEmployees = async () => {
        try {
          const employeesRef = collection(db, 'employees');
          const employeesQuery = query(
            employeesRef,
            where('shopId', '==', activeShopId)
          );
          const snapshot = await getDocs(employeesQuery);
          const employeesList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setEmployees(employeesList);
          setEmployeesLoaded(true);
        } catch (error) {
          console.error('Error loading employees:', error);
          setEmployeesLoaded(true);
        }
      };
      fetchEmployees();
    }
  }, [currentUser, isGuest, activeShopId]);

  // Calculate totals
  useEffect(() => {
    const newSubtotal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    setSubtotal(newSubtotal);
    const newTax = newSubtotal * 0.1; // 10% tax
    setTax(newTax);
    setTotal(newSubtotal + newTax);
  }, [items]);

  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    if (field === 'quantity' || field === 'price') {
      value = parseFloat(value) || 0;
    }
    newItems[index][field] = value;
    newItems[index].total = newItems[index].quantity * newItems[index].price;
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0, total: 0 }]);
  };

  const removeItem = (index) => {
    if (items.length > 1) {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
    }
  };

  const generateReceiptNumber = () => {
    const timestamp = Date.now().toString().slice(-6);
    return `GST-${timestamp}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      // Validate required fields
      if (!customerName.trim()) {
        throw new Error('Customer name is required');
      }

      const validItems = items.filter(item => item.name.trim() && item.quantity > 0 && item.price >= 0);
      if (validItems.length === 0) {
        throw new Error('Please add at least one valid item');
      }

      if (!activeShopId) {
        throw new Error('Select a branch before creating a receipt.');
      }

      const receiptNum = receiptNumber || generateReceiptNumber();
      
      const receiptData = {
        receiptNumber: receiptNum,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerAddress: customerAddress.trim(),
        items: validItems,
        subtotal: subtotal,
        tax: tax,
        total: total,
        userId: currentUser.uid,
        shopId: activeShopId,
        shopName: shopData.name,
        shopAddress: shopData.address,
        shopPhone: shopData.phone,
        shopReceiptDescription: shopData.receiptDescription,
        createdAt: serverTimestamp(),
        isGuestReceipt: true,
        guestUserId: currentUser.uid,
        employeeName: selectedEmployee ? selectedEmployee.name : null,
        employeeId: selectedEmployee ? selectedEmployee.id : null
      };

      // Save to Firestore
      await addDoc(collection(db, 'receipts'), receiptData);
      
      setSuccess(`Receipt ${receiptNum} created successfully!`);
      
      // Reset form after successful submission
      setTimeout(() => {
        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setItems([{ name: '', quantity: 1, price: 0, total: 0 }]);
        setReceiptNumber('');
        setSelectedEmployee(null);
        setSuccess('');
      }, 2000);

    } catch (error) {
      console.error('Error creating receipt:', error);
      setError(error.message || 'Failed to create receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    // Simple print functionality for guest users
    window.print();
  };

  if (!isGuest) {
    return null; // Don't render anything if not a guest user
  }

  return (
    <Container fluid className="py-4">
      <div className="guest-receipt-container">
        <Row>
          <Col lg={12}>
            <Card>
              <Card.Header className="d-flex justify-content-between align-items-center">
                <h4 className="mb-0">Create New Receipt</h4>
                <div>
                  <Button 
                    variant="outline-secondary" 
                    onClick={handlePrint}
                    className="me-2"
                  >
                    Print Receipt
                  </Button>
                  <Button 
                    variant="outline-primary" 
                    onClick={() => navigate('/guest-dashboard')}
                  >
                    Back to Dashboard
                  </Button>
                </div>
              </Card.Header>
              <Card.Body>
                {error && <Alert variant="danger">{error}</Alert>}
                {success && <Alert variant="success">{success}</Alert>}
                
                <Form onSubmit={handleSubmit}>
                  {/* Receipt Number */}
                  <Row className="mb-3">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Receipt Number</Form.Label>
                        <Form.Control
                          type="text"
                          value={receiptNumber}
                          onChange={(e) => setReceiptNumber(e.target.value)}
                          placeholder="Auto-generated if left empty"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Customer Information */}
                  <h5 className="mb-3">Customer Information</h5>
                  <Row className="mb-3">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Customer Name *</Form.Label>
                        <Form.Control
                          type="text"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          required
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Phone Number</Form.Label>
                        <Form.Control
                          type="tel"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Address</Form.Label>
                        <Form.Control
                          type="text"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Employee Selection */}
                  <Row className="mb-3">
                    <Col md={4}>
                      <Form.Group>
                        <Form.Label>Employee (Optional)</Form.Label>
                        <Select
                          value={selectedEmployee ? { value: selectedEmployee.id, label: selectedEmployee.name } : null}
                          onChange={(option) => setSelectedEmployee(option ? employees.find(emp => emp.id === option.value) : null)}
                          options={employees.map(emp => ({ value: emp.id, label: emp.name }))}
                          placeholder="Select Employee"
                          isClearable
                          className="basic-single"
                          classNamePrefix="select"
                        />
                      </Form.Group>
                    </Col>
                  </Row>

                  {/* Items */}
                  <h5 className="mb-3">Items</h5>
                  {items.map((item, index) => (
                    <Row key={index} className="mb-2 align-items-end">
                      <Col md={4}>
                        <Form.Group>
                          <Form.Label>Item Name</Form.Label>
                          <Form.Control
                            type="text"
                            value={item.name}
                            onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                            placeholder="Item name"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group>
                          <Form.Label>Quantity</Form.Label>
                          <Form.Control
                            type="number"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            min="0"
                            step="0.01"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group>
                          <Form.Label>Price</Form.Label>
                          <Form.Control
                            type="number"
                            value={item.price}
                            onChange={(e) => handleItemChange(index, 'price', e.target.value)}
                            min="0"
                            step="0.01"
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Form.Group>
                          <Form.Label>Total</Form.Label>
                          <Form.Control
                            type="number"
                            value={item.total.toFixed(2)}
                            readOnly
                          />
                        </Form.Group>
                      </Col>
                      <Col md={2}>
                        <Button 
                          variant="outline-danger" 
                          onClick={() => removeItem(index)}
                          disabled={items.length <= 1}
                        >
                          Remove
                        </Button>
                      </Col>
                    </Row>
                  ))}
                  
                  <Button 
                    variant="outline-primary" 
                    onClick={addItem}
                    className="mb-3"
                  >
                    Add Item
                  </Button>

                  {/* Totals */}
                  <Row className="justify-content-end">
                    <Col md={4}>
                      <div className="totals-section">
                        <div className="d-flex justify-content-between">
                          <span>Subtotal:</span>
                          <span>${subtotal.toFixed(2)}</span>
                        </div>
                        <div className="d-flex justify-content-between">
                          <span>Tax (10%):</span>
                          <span>${tax.toFixed(2)}</span>
                        </div>
                        <div className="d-flex justify-content-between fw-bold">
                          <span>Total:</span>
                          <span>${total.toFixed(2)}</span>
                        </div>
                      </div>
                    </Col>
                  </Row>

                  {/* Submit Button */}
                  <div className="d-flex justify-content-end mt-4">
                    <Button 
                      variant="success" 
                      type="submit" 
                      disabled={loading}
                      size="lg"
                    >
                      {loading ? 'Creating Receipt...' : 'Create Receipt'}
                    </Button>
                  </div>
                </Form>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </div>
    </Container>
  );
}

export default GuestNewReceipt;