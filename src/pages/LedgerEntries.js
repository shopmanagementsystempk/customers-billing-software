import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Modal, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate } from '../utils';
import { getLedgerEntries, deleteLedgerEntry, getLedgerAccounts } from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';

const LedgerEntries = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  
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
        console.error('Error fetching ledger data:', error);
        setError('Failed to load ledger entries. Please try again.');
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
      console.error('Error deleting entry:', error);
      setError('Failed to delete entry. Please try again.');
      setShowDeleteModal(false);
    }
  };
  
  // Handle date range change
  const handleDateRangeChange = (e) => {
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
          title="Ledger Entries" 
          icon="bi-journal-bookmark" 
          subtitle="View and manage all ledger transactions (debit and credit entries)."
        />
        <div className="page-header-actions">
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/ledger-accounts')}
          >
            View Accounts
          </Button>
          <Button 
            variant="primary" 
            onClick={() => navigate('/add-ledger-entry')}
          >
            Add Entry
          </Button>
        </div>
        
        {error && <Alert variant="danger">{error}</Alert>}
        
        {/* Filters */}
        <Card className="mb-4 shadow-sm">
          <Card.Body>
            <h5>Filters</h5>
            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Account</Form.Label>
                  <Form.Select 
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                  >
                    <option value="all">All Accounts</option>
                    {accounts.map(account => (
                      <option key={account.id} value={account.id}>
                        {account.accountName} ({account.accountType})
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control 
                    type="date" 
                    name="startDate"
                    value={dateRange.startDate}
                    onChange={handleDateRangeChange}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>End Date</Form.Label>
                  <Form.Control 
                    type="date" 
                    name="endDate"
                    value={dateRange.endDate}
                    onChange={handleDateRangeChange}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        {/* Entries Table */}
        <Card className="shadow-sm">
          <Card.Body>
            <h5>Ledger Entries ({filteredEntries.length})</h5>
            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" />
                <p className="mt-2">Loading...</p>
              </div>
            ) : filteredEntries.length > 0 ? (
              <div className="table-responsive">
                <Table hover className="ledger-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th>Debit Account</th>
                      <th>Credit Account</th>
                      <th className="text-end">Amount</th>
                      <th>Reference</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.map(entry => (
                      <tr key={entry.id}>
                        <td>{formatDisplayDate(entry.entryDate)}</td>
                        <td>{entry.description || '-'}</td>
                        <td>
                          <Badge bg="danger">{getAccountName(entry.debitAccountId)}</Badge>
                        </td>
                        <td>
                          <Badge bg="success">{getAccountName(entry.creditAccountId)}</Badge>
                        </td>
                        <td className="text-end">
                          <strong>{formatCurrency(entry.amount || 0)}</strong>
                        </td>
                        <td>{entry.reference || '-'}</td>
                        <td>
                          <Button 
                            variant="outline-primary" 
                            size="sm"
                            className="me-1"
                            onClick={() => navigate(`/edit-ledger-entry/${entry.id}`)}
                          >
                            Edit
                          </Button>
                          <Button 
                            variant="outline-danger" 
                            size="sm"
                            onClick={() => handleDeleteClick(entry)}
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <Alert variant="info">
                No ledger entries found matching your filters.
              </Alert>
            )}
          </Card.Body>
        </Card>
      </Container>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this ledger entry? This action cannot be undone.
          {entryToDelete && (
            <div className="mt-3">
              <p><strong>Date:</strong> {formatDisplayDate(entryToDelete.entryDate)}</p>
              <p><strong>Description:</strong> {entryToDelete.description || '-'}</p>
              <p><strong>Debit Account:</strong> {getAccountName(entryToDelete.debitAccountId)}</p>
              <p><strong>Credit Account:</strong> {getAccountName(entryToDelete.creditAccountId)}</p>
              <p><strong>Amount:</strong> {formatCurrency(entryToDelete.amount || 0)}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default LedgerEntries;

