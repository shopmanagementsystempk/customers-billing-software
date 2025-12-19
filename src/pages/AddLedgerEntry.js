import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate } from '../utils';
import { addLedgerEntry, getLedgerAccounts } from '../utils/ledgerUtils';

const AddLedgerEntry = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  
  const [formData, setFormData] = useState({
    entryDate: new Date().toISOString().split('T')[0],
    description: '',
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
    reference: ''
  });
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Fetch accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!currentUser || !activeShopId) return;
      
      setLoading(true);
      setError('');
      
      try {
        const accountsData = await getLedgerAccounts(activeShopId);
        setAccounts(accountsData);
      } catch (error) {
        console.error('Error fetching accounts:', error);
        setError('Failed to load accounts. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAccounts();
  }, [currentUser, activeShopId]);
  
  // Handle form input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentUser || !activeShopId) return;
    
    // Validate form
    if (!formData.description.trim()) {
      setError('Description is required');
      return;
    }
    
    if (!formData.debitAccountId) {
      setError('Debit account is required');
      return;
    }
    
    if (!formData.creditAccountId) {
      setError('Credit account is required');
      return;
    }
    
    if (formData.debitAccountId === formData.creditAccountId) {
      setError('Debit and credit accounts cannot be the same');
      return;
    }
    
    if (!formData.amount || isNaN(formData.amount) || parseFloat(formData.amount) <= 0) {
      setError('Please enter a valid amount greater than zero');
      return;
    }
    
    if (!formData.entryDate) {
      setError('Date is required');
      return;
    }
    
    setSubmitting(true);
    setError('');
    
    try {
      // Prepare entry data
      const entryData = {
        ...formData,
        amount: parseFloat(formData.amount),
        shopId: activeShopId
      };
      
      // Add entry to database
      await addLedgerEntry(entryData);
      
      setSuccess(true);
      
      // Reset form
      setFormData({
        entryDate: new Date().toISOString().split('T')[0],
        description: '',
        debitAccountId: '',
        creditAccountId: '',
        amount: '',
        reference: ''
      });
      
      // Redirect after a short delay
      setTimeout(() => {
        navigate('/ledger-entries');
      }, 1500);
    } catch (error) {
      console.error('Error adding ledger entry:', error);
      setError(error.message || 'Failed to add ledger entry. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  // Group accounts by type
  const accountsByType = {
    Asset: accounts.filter(a => a.accountType === 'Asset'),
    Liability: accounts.filter(a => a.accountType === 'Liability'),
    Income: accounts.filter(a => a.accountType === 'Income'),
    Expense: accounts.filter(a => a.accountType === 'Expense')
  };
  
  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader 
          title="Add Ledger Entry" 
          icon="bi-journal-plus" 
          subtitle="Record a new debit and credit transaction in your ledger."
        />
        <div className="page-header-actions">
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/ledger-entries')}
          >
            Back to Entries
          </Button>
        </div>
        
        {success && (
          <Alert variant="success">
            Ledger entry added successfully!
          </Alert>
        )}
        
        {error && <Alert variant="danger">{error}</Alert>}
        
        <Card className="shadow-sm">
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Entry Date *</Form.Label>
                    <Form.Control
                      type="date"
                      name="entryDate"
                      value={formData.entryDate}
                      onChange={handleChange}
                      required
                      disabled={submitting}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Reference (Optional)</Form.Label>
                    <Form.Control
                      type="text"
                      name="reference"
                      value={formData.reference}
                      onChange={handleChange}
                      placeholder="Invoice #, Receipt #, etc."
                      disabled={submitting}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label>Description *</Form.Label>
                    <Form.Control
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      required
                      placeholder="Brief description of the transaction"
                      disabled={submitting}
                    />
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Debit Account *</Form.Label>
                    <Form.Select
                      name="debitAccountId"
                      value={formData.debitAccountId}
                      onChange={handleChange}
                      required
                      disabled={submitting || loading}
                    >
                      <option value="">Select Debit Account</option>
                      {Object.keys(accountsByType).map(type => (
                        accountsByType[type].length > 0 && (
                          <optgroup key={type} label={type}>
                            {accountsByType[type].map(account => (
                              <option key={account.id} value={account.id}>
                                {account.accountName}
                              </option>
                            ))}
                          </optgroup>
                        )
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      Debit increases Assets/Expenses, decreases Liabilities/Income
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Credit Account *</Form.Label>
                    <Form.Select
                      name="creditAccountId"
                      value={formData.creditAccountId}
                      onChange={handleChange}
                      required
                      disabled={submitting || loading}
                    >
                      <option value="">Select Credit Account</option>
                      {Object.keys(accountsByType).map(type => (
                        accountsByType[type].length > 0 && (
                          <optgroup key={type} label={type}>
                            {accountsByType[type].map(account => (
                              <option key={account.id} value={account.id}>
                                {account.accountName}
                              </option>
                            ))}
                          </optgroup>
                        )
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      Credit decreases Assets/Expenses, increases Liabilities/Income
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Amount *</Form.Label>
                    <Form.Control
                      type="number"
                      name="amount"
                      value={formData.amount}
                      onChange={handleChange}
                      required
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      disabled={submitting}
                    />
                    <Form.Text className="text-muted">
                      Enter the transaction amount
                    </Form.Text>
                  </Form.Group>
                </Col>
                
                <Col md={12}>
                  <Alert variant="info" className="mt-3">
                    <strong>Double Entry Bookkeeping:</strong> Every transaction must have equal debits and credits. 
                    The amount entered will be debited to the debit account and credited to the credit account.
                  </Alert>
                </Col>
                
                <Col md={12}>
                  <div className="d-flex justify-content-end mt-3">
                    <Button 
                      variant="secondary" 
                      className="me-2"
                      onClick={() => navigate('/ledger-entries')}
                      disabled={submitting}
                    >
                      Cancel
                    </Button>
                    <Button 
                      variant="primary" 
                      type="submit"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-1" />
                          Saving...
                        </>
                      ) : (
                        'Save Entry'
                      )}
                    </Button>
                  </div>
                </Col>
              </Row>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default AddLedgerEntry;

