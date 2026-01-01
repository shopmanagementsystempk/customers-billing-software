import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Modal, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate, useTranslatedAttribute } from '../utils';
import { getLedgerEntries, deleteLedgerEntry, getLedgerAccounts } from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';

const LedgerEntries = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  const getTranslatedAttr = useTranslatedAttribute();

  const [entries, setEntries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [selectedAccount, setSelectedAccount] = useState('all');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState(null);

  // Fetch entries and accounts
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser || !activeShopId) return;

      setLoading(true);
      setError('');

      try {
        const accountsData = await getLedgerAccounts(activeShopId);
        setAccounts(accountsData);

        const filters = selectedAccount !== 'all' ? { accountId: selectedAccount } : {};
        const entriesData = await getLedgerEntries(activeShopId, filters);
        setEntries(entriesData);
      } catch (error) {
        console.error('Error fetching ledger entries:', error);
        setError(getTranslatedAttr('failedToLoadEntries'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, activeShopId, selectedAccount]);

  // Filter entries by date range
  const filteredEntries = entries.filter(entry => {
    const startDateMatch = !dateRange.startDate || entry.entryDate >= dateRange.startDate;
    const endDateMatch = !dateRange.endDate || entry.entryDate <= dateRange.endDate;
    return startDateMatch && endDateMatch;
  });

  // Get account name by ID
  const getAccountName = (accountId) => {
    const account = accounts.find(acc => acc.id === accountId);
    return account ? account.accountName : 'Unknown';
  };

  // Handle delete entry
  const handleDeleteClick = (entry) => {
    setEntryToDelete(entry);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!entryToDelete) return;

    try {
      await deleteLedgerEntry(entryToDelete.id);

      // Remove entry from state
      setEntries(prev => prev.filter(ent => ent.id !== entryToDelete.id));

      setShowDeleteModal(false);
      setEntryToDelete(null);
    } catch (error) {
      console.error('Error deleting ledger entry:', error);
      setError(error.message || getTranslatedAttr('error'));
      setShowDeleteModal(false);
    }
  };

  // Handle date range change
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader
          title={<Translate textKey="ledgerEntries" />}
          icon="bi-journal-bookmark"
          subtitle={<Translate textKey="manageEntriesSubtitle" />}
        />
        <div className="page-header-actions">
          <Button
            variant="outline-secondary"
            onClick={() => navigate('/ledger-accounts')}
          >
            <Translate textKey="viewAccounts" />
          </Button>
          <Button
            variant="primary"
            onClick={() => navigate('/add-ledger-entry')}
          >
            <Translate textKey="addEntry" />
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {/* Filters */}
        <Card className="mb-4 shadow-sm">
          <Card.Body>
            <h5><Translate textKey="filters" /></h5>
            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label><Translate textKey="account" /></Form.Label>
                  <Form.Select
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                  >
                    <option value="all"><Translate textKey="allAccounts" /></option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.accountName} ({getTranslatedAttr(account.accountType.toLowerCase())})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label><Translate textKey="startDate" /></Form.Label>
                  <Form.Control
                    type="date"
                    name="startDate"
                    value={dateRange.startDate}
                    onChange={handleDateChange}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label><Translate textKey="endDate" /></Form.Label>
                  <Form.Control
                    type="date"
                    name="endDate"
                    value={dateRange.endDate}
                    onChange={handleDateChange}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {/* Entries Table */}
        <Card className="shadow-sm">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5><Translate textKey="ledgerEntries" /> ({filteredEntries.length})</h5>
              {filteredEntries.length > 0 && (
                <Badge bg="info">
                  <Translate textKey="total" />: {formatCurrency(filteredEntries.reduce((sum, entry) => sum + entry.amount, 0))}
                </Badge>
              )}
            </div>

            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" />
                <p className="mt-2 text-muted"><Translate textKey="loading" />...</p>
              </div>
            ) : filteredEntries.length === 0 ? (
              <Alert variant="info" className="text-center mb-0">
                <Translate textKey="noDataFound" />
              </Alert>
            ) : (
              <div className="table-responsive">
                <Table hover className="ledger-table">
                  <thead>
                    <tr>
                      <th><Translate textKey="date" /></th>
                      <th><Translate textKey="description" /></th>
                      <th><Translate textKey="debitAccount" /></th>
                      <th><Translate textKey="creditAccount" /></th>
                      <th className="text-end"><Translate textKey="amount" /></th>
                      <th><Translate textKey="reference" /></th>
                      <th><Translate textKey="action" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="text-nowrap">{formatDisplayDate(entry.entryDate)}</td>
                        <td>{entry.description || '-'}</td>
                        <td>
                          <Badge bg="success" className="me-1">Dr</Badge>
                          {getAccountName(entry.debitAccountId)}
                        </td>
                        <td>
                          <Badge bg="danger" className="me-1">Cr</Badge>
                          {getAccountName(entry.creditAccountId)}
                        </td>
                        <td className="text-end"><strong>{formatCurrency(entry.amount || 0)}</strong></td>
                        <td><small className="text-muted">{entry.reference || '-'}</small></td>
                        <td>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteClick(entry)}
                          >
                            <Translate textKey="delete" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </Container>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title><Translate textKey="confirmDelete" /></Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Translate textKey="confirmDeleteEntry" />
          {entryToDelete && (
            <div className="mt-3 p-3 bg-light rounded">
              <p className="mb-1"><strong><Translate textKey="date" />:</strong> {formatDisplayDate(entryToDelete.entryDate)}</p>
              <p className="mb-1"><strong><Translate textKey="description" />:</strong> {entryToDelete.description || '-'}</p>
              <p className="mb-1"><strong><Translate textKey="amount" />:</strong> {formatCurrency(entryToDelete.amount || 0)}</p>
            </div>
          )}
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
    </>
  );
};

export default LedgerEntries;

