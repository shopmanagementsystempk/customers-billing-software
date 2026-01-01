import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate, useTranslatedAttribute } from '../utils';
import { getLedgerEntryById, updateLedgerEntry, getLedgerAccounts } from '../utils/ledgerUtils';

const EditLedgerEntry = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  const { id } = useParams();
  const getTranslatedAttr = useTranslatedAttribute();

  const [formData, setFormData] = useState({
    entryDate: '',
    description: '',
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
    reference: ''
  });

  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Fetch entry and accounts
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser || !activeShopId || !id) return;

      setLoading(true);
      setError('');

      try {
        const [entryData, accountsData] = await Promise.all([
          getLedgerEntryById(id),
          getLedgerAccounts(activeShopId)
        ]);

        setAccounts(accountsData);
        setFormData({
          entryDate: entryData.entryDate || '',
          description: entryData.description || '',
          debitAccountId: entryData.debitAccountId || '',
          creditAccountId: entryData.creditAccountId || '',
          amount: entryData.amount || '',
          reference: entryData.reference || ''
        });
      } catch (error) {
        console.error('Error fetching ledger data:', error);
        setError(getTranslatedAttr('failedToLoadEntry'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, activeShopId, id]);

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

    if (!currentUser || !activeShopId || !id) return;

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
      // Prepare update data
      const updateData = {
        ...formData,
        amount: parseFloat(formData.amount)
      };

      // Update entry in database
      await updateLedgerEntry(id, updateData);

      setSuccess(true);

      // Redirect after a short delay
      setTimeout(() => {
        navigate('/ledger-entries');
      }, 1500);
    } catch (error) {
      console.error('Error updating ledger entry:', error);
      setError(error.message || getTranslatedAttr('failedToSaveEntry'));
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

  if (loading) {
    return (
      <>
        <MainNavbar />
        <Container className="pb-4">
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="mt-2"><Translate textKey="loading" />...</p>
          </div>
        </Container>
      </>
    );
  }

  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader
          title={<Translate textKey="editEntry" />}
          icon="bi-journal-text"
          subtitle={<Translate textKey="editEntrySubtitle" />}
        />
        <div className="page-header-actions">
          <Button
            variant="outline-secondary"
            onClick={() => navigate('/ledger-entries')}
          >
            <Translate textKey="back" />
          </Button>
        </div>

        {success && (
          <Alert variant="success">
            <Translate textKey="entryUpdatedSuccess" />
          </Alert>
        )}

        {error && <Alert variant="danger">{error}</Alert>}

        <Card className="shadow-sm">
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Row className="g-3">
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="date" /> *</Form.Label>
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
                    <Form.Label><Translate textKey="reference" /> (<Translate textKey="optional" />)</Form.Label>
                    <Form.Control
                      type="text"
                      name="reference"
                      value={formData.reference}
                      onChange={handleChange}
                      placeholder={getTranslatedAttr('reference')}
                      disabled={submitting}
                    />
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="description" /> *</Form.Label>
                    <Form.Control
                      type="text"
                      name="description"
                      value={formData.description}
                      onChange={handleChange}
                      required
                      placeholder={getTranslatedAttr('description')}
                      disabled={submitting}
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="debitAccount" /> *</Form.Label>
                    <Form.Select
                      name="debitAccountId"
                      value={formData.debitAccountId}
                      onChange={handleChange}
                      required
                      disabled={submitting}
                    >
                      <option value="">{getTranslatedAttr('selectOption')}</option>
                      {Object.keys(accountsByType).map(type => (
                        accountsByType[type].length > 0 && (
                          <optgroup key={type} label={getTranslatedAttr(type.toLowerCase())}>
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
                      <Translate textKey="debitHelpText" fallback="Debit increases Assets/Expenses, decreases Liabilities/Income" />
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="creditAccount" /> *</Form.Label>
                    <Form.Select
                      name="creditAccountId"
                      value={formData.creditAccountId}
                      onChange={handleChange}
                      required
                      disabled={submitting}
                    >
                      <option value="">{getTranslatedAttr('selectOption')}</option>
                      {Object.keys(accountsByType).map(type => (
                        accountsByType[type].length > 0 && (
                          <optgroup key={type} label={getTranslatedAttr(type.toLowerCase())}>
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
                      <Translate textKey="creditHelpText" fallback="Credit decreases Assets/Expenses, increases Liabilities/Income" />
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="amount" /> *</Form.Label>
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
                      <Translate textKey="amountHelpText" fallback="Enter the transaction amount" />
                    </Form.Text>
                  </Form.Group>
                </Col>

                <Col md={12}>
                  <Alert variant="info" className="mt-3">
                    <Translate textKey="doubleEntryHelp" fallback="Double Entry Bookkeeping: Every transaction must have equal debits and credits." />
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
                      <Translate textKey="cancel" />
                    </Button>
                    <Button
                      variant="primary"
                      type="submit"
                      disabled={submitting}
                    >
                      {submitting ? (
                        <>
                          <Spinner animation="border" size="sm" className="me-1" />
                          <Translate textKey="updating" />...
                        </>
                      ) : (
                        <Translate textKey="save" />
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

export default EditLedgerEntry;

