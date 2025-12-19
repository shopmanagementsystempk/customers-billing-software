import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Modal, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate } from '../utils';
import { 
  getLedgerAccounts, 
  addLedgerAccount, 
  updateLedgerAccount, 
  deleteLedgerAccount,
  initializeDefaultAccounts,
  calculateAccountBalance,
  getLedgerEntries,
  calculateAllAccountBalances
} from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/receiptUtils';

const LedgerAccounts = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [balances, setBalances] = useState({});
  
  // New account form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAccount, setNewAccount] = useState({ 
    accountName: '', 
    accountType: 'Asset', 
    openingBalance: 0, 
    description: '' 
  });
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  
  // Edit account form
  const [showEditForm, setShowEditForm] = useState(false);
  const [editAccount, setEditAccount] = useState({ 
    id: '', 
    accountName: '', 
    accountType: 'Asset', 
    openingBalance: 0, 
    description: '' 
  });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  
  // Delete confirmation
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState(null);
  
  // Initialize accounts
  const [initializing, setInitializing] = useState(false);
  
  // Fetch accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!currentUser || !activeShopId) return;
      
      setLoading(true);
      setError('');
      
      try {
        const accountsData = await getLedgerAccounts(activeShopId);
        
        if (accountsData.length === 0) {
          // Initialize default accounts
          setInitializing(true);
          await initializeDefaultAccounts(activeShopId);
          const refreshedAccounts = await getLedgerAccounts(activeShopId);
          setAccounts(refreshedAccounts);
        } else {
          setAccounts(accountsData);
        }
        
        // Calculate balances for all accounts in a single pass (optimized)
        const entriesData = await getLedgerEntries(activeShopId);
        const balanceMap = calculateAllAccountBalances(accountsData, entriesData);
        setBalances(balanceMap);
      } catch (error) {
        console.error('Error fetching ledger accounts:', error);
        setError('Failed to load ledger accounts. Please try again.');
      } finally {
        setLoading(false);
        setInitializing(false);
      }
    };
    
    fetchAccounts();
  }, [currentUser, activeShopId]);
  
  // Handle new account form changes
  const handleNewAccountChange = (e) => {
    const { name, value } = e.target;
    setNewAccount(prev => ({
      ...prev,
      [name]: name === 'openingBalance' ? parseFloat(value) || 0 : value
    }));
  };
  
  // Handle edit account form changes
  const handleEditAccountChange = (e) => {
    const { name, value } = e.target;
    setEditAccount(prev => ({
      ...prev,
      [name]: name === 'openingBalance' ? parseFloat(value) || 0 : value
    }));
  };
  
  // Handle add account form submission
  const handleAddAccount = async (e) => {
    e.preventDefault();
    
    if (!currentUser || !activeShopId) return;
    
    // Validate account name
    if (!newAccount.accountName.trim()) {
      setAddError('Account name is required');
      return;
    }
    
    setAddLoading(true);
    setAddError('');
    
    try {
      // Prepare account data
      const accountData = {
        ...newAccount,
        shopId: activeShopId,
        openingBalance: parseFloat(newAccount.openingBalance) || 0
      };
      
      // Add account to database
      const accountId = await addLedgerAccount(accountData);
      
      // Add new account to state
      const newAccountWithId = {
        id: accountId,
        ...accountData
      };
      
      setAccounts(prev => [...prev, newAccountWithId]);
      
      // Calculate balance for new account
      const balance = await calculateAccountBalance(accountId, activeShopId);
      setBalances(prev => ({ ...prev, [accountId]: balance }));
      
      // Reset form and hide it
      setNewAccount({ accountName: '', accountType: 'Asset', openingBalance: 0, description: '' });
      setShowAddForm(false);
    } catch (error) {
      console.error('Error adding account:', error);
      setAddError(error.message || 'Failed to add account. Please try again.');
    } finally {
      setAddLoading(false);
    }
  };
  
  // Handle edit account form submission
  const handleUpdateAccount = async (e) => {
    e.preventDefault();
    
    if (!currentUser || !activeShopId || !editAccount.id) return;
    
    // Validate account name
    if (!editAccount.accountName.trim()) {
      setEditError('Account name is required');
      return;
    }
    
    setEditLoading(true);
    setEditError('');
    
    try {
      // Prepare update data
      const updateData = {
        accountName: editAccount.accountName,
        accountType: editAccount.accountType,
        openingBalance: parseFloat(editAccount.openingBalance) || 0,
        description: editAccount.description
      };
      
      // Update account in database
      await updateLedgerAccount(editAccount.id, updateData);
      
      // Update account in state
      setAccounts(prev => 
        prev.map(acc => 
          acc.id === editAccount.id ? { ...acc, ...updateData } : acc
        )
      );
      
      // Recalculate balance
      const balance = await calculateAccountBalance(editAccount.id, activeShopId);
      setBalances(prev => ({ ...prev, [editAccount.id]: balance }));
      
      // Reset form and hide it
      setEditAccount({ id: '', accountName: '', accountType: 'Asset', openingBalance: 0, description: '' });
      setShowEditForm(false);
    } catch (error) {
      console.error('Error updating account:', error);
      setEditError(error.message || 'Failed to update account. Please try again.');
    } finally {
      setEditLoading(false);
    }
  };
  
  // Handle delete account
  const handleDeleteClick = (account) => {
    setAccountToDelete(account);
    setShowDeleteModal(true);
  };
  
  const confirmDelete = async () => {
    if (!accountToDelete || !activeShopId) return;
    
    try {
      await deleteLedgerAccount(accountToDelete.id, activeShopId);
      
      // Remove account from state
      setAccounts(prev => prev.filter(acc => acc.id !== accountToDelete.id));
      setBalances(prev => {
        const newBalances = { ...prev };
        delete newBalances[accountToDelete.id];
        return newBalances;
      });
      
      setShowDeleteModal(false);
      setAccountToDelete(null);
    } catch (error) {
      console.error('Error deleting account:', error);
      setError(error.message || 'Failed to delete account. Please try again.');
      setShowDeleteModal(false);
    }
  };
  
  // Handle edit button click
  const handleEditClick = (account) => {
    setEditAccount({
      id: account.id,
      accountName: account.accountName,
      accountType: account.accountType,
      openingBalance: account.openingBalance || 0,
      description: account.description || ''
    });
    setShowEditForm(true);
  };
  
  // Group accounts by type
  const accountsByType = {
    Asset: accounts.filter(a => a.accountType === 'Asset'),
    Liability: accounts.filter(a => a.accountType === 'Liability'),
    Income: accounts.filter(a => a.accountType === 'Income'),
    Expense: accounts.filter(a => a.accountType === 'Expense')
  };
  
  const getTypeBadgeVariant = (type) => {
    switch (type) {
      case 'Asset': return 'success';
      case 'Liability': return 'danger';
      case 'Income': return 'primary';
      case 'Expense': return 'warning';
      default: return 'secondary';
    }
  };
  
  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader 
          title="Ledger Accounts" 
          icon="bi-journal-text" 
          subtitle="Manage your chart of accounts and track balances."
        />
        <div className="page-header-actions">
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/ledger-entries')}
          >
            View Entries
          </Button>
          <Button 
            variant="primary" 
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
          >
            Add Account
          </Button>
        </div>
        
        {error && <Alert variant="danger">{error}</Alert>}
        
        {/* Add Account Form */}
        {showAddForm && (
          <Card className="mb-4 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>Add New Account</h5>
                <Button 
                  variant="link" 
                  className="p-0" 
                  onClick={() => {
                    setShowAddForm(false);
                    setNewAccount({ accountName: '', accountType: 'Asset', openingBalance: 0, description: '' });
                    setAddError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              
              {addError && <Alert variant="danger">{addError}</Alert>}
              
              <Form onSubmit={handleAddAccount}>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Account Name *</Form.Label>
                      <Form.Control
                        type="text"
                        name="accountName"
                        value={newAccount.accountName}
                        onChange={handleNewAccountChange}
                        required
                        disabled={addLoading}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Account Type *</Form.Label>
                      <Form.Select
                        name="accountType"
                        value={newAccount.accountType}
                        onChange={handleNewAccountChange}
                        required
                        disabled={addLoading}
                      >
                        <option value="Asset">Asset</option>
                        <option value="Liability">Liability</option>
                        <option value="Income">Income</option>
                        <option value="Expense">Expense</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Opening Balance</Form.Label>
                      <Form.Control
                        type="number"
                        name="openingBalance"
                        value={newAccount.openingBalance}
                        onChange={handleNewAccountChange}
                        step="0.01"
                        disabled={addLoading}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Description (Optional)</Form.Label>
                      <Form.Control
                        type="text"
                        name="description"
                        value={newAccount.description}
                        onChange={handleNewAccountChange}
                        disabled={addLoading}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-end">
                  <Button 
                    variant="primary" 
                    type="submit"
                    disabled={addLoading}
                  >
                    {addLoading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Saving...
                      </>
                    ) : (
                      'Save Account'
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        )}
        
        {/* Edit Account Form */}
        {showEditForm && (
          <Card className="mb-4 shadow-sm">
            <Card.Body>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h5>Edit Account</h5>
                <Button 
                  variant="link" 
                  className="p-0" 
                  onClick={() => {
                    setShowEditForm(false);
                    setEditAccount({ id: '', accountName: '', accountType: 'Asset', openingBalance: 0, description: '' });
                    setEditError('');
                  }}
                >
                  Cancel
                </Button>
              </div>
              
              {editError && <Alert variant="danger">{editError}</Alert>}
              
              <Form onSubmit={handleUpdateAccount}>
                <Row>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Account Name *</Form.Label>
                      <Form.Control
                        type="text"
                        name="accountName"
                        value={editAccount.accountName}
                        onChange={handleEditAccountChange}
                        required
                        disabled={editLoading}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Account Type *</Form.Label>
                      <Form.Select
                        name="accountType"
                        value={editAccount.accountType}
                        onChange={handleEditAccountChange}
                        required
                        disabled={editLoading}
                      >
                        <option value="Asset">Asset</option>
                        <option value="Liability">Liability</option>
                        <option value="Income">Income</option>
                        <option value="Expense">Expense</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={3}>
                    <Form.Group className="mb-3">
                      <Form.Label>Opening Balance</Form.Label>
                      <Form.Control
                        type="number"
                        name="openingBalance"
                        value={editAccount.openingBalance}
                        onChange={handleEditAccountChange}
                        step="0.01"
                        disabled={editLoading}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={12}>
                    <Form.Group className="mb-3">
                      <Form.Label>Description (Optional)</Form.Label>
                      <Form.Control
                        type="text"
                        name="description"
                        value={editAccount.description}
                        onChange={handleEditAccountChange}
                        disabled={editLoading}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex justify-content-end">
                  <Button 
                    variant="primary" 
                    type="submit"
                    disabled={editLoading}
                  >
                    {editLoading ? (
                      <>
                        <Spinner animation="border" size="sm" className="me-1" />
                        Updating...
                      </>
                    ) : (
                      'Update Account'
                    )}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        )}
        
        {/* Accounts by Type */}
        {loading || initializing ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="mt-2">{initializing ? 'Initializing default accounts...' : 'Loading...'}</p>
          </div>
        ) : (
          Object.keys(accountsByType).map(type => (
            accountsByType[type].length > 0 && (
              <Card key={type} className="mb-4 shadow-sm">
                <Card.Header>
                  <h5 className="mb-0">
                    <Badge bg={getTypeBadgeVariant(type)} className="me-2">{type}</Badge>
                    {accountsByType[type].length} {accountsByType[type].length === 1 ? 'Account' : 'Accounts'}
                  </h5>
                </Card.Header>
                <Card.Body>
                  <Table hover responsive>
                    <thead>
                      <tr>
                        <th>Account Name</th>
                        <th>Description</th>
                        <th className="text-end">Opening Balance</th>
                        <th className="text-end">Current Balance</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountsByType[type].map(account => (
                        <tr key={account.id}>
                          <td><strong>{account.accountName}</strong></td>
                          <td>{account.description || '-'}</td>
                          <td className="text-end">{formatCurrency(account.openingBalance || 0)}</td>
                          <td className="text-end">
                            <strong className={balances[account.id] >= 0 ? 'text-success' : 'text-danger'}>
                              {formatCurrency(balances[account.id] || 0)}
                            </strong>
                          </td>
                          <td>
                            <Button 
                              variant="outline-primary" 
                              size="sm"
                              className="me-1"
                              onClick={() => handleEditClick(account)}
                            >
                              Edit
                            </Button>
                            <Button 
                              variant="outline-danger" 
                              size="sm"
                              onClick={() => handleDeleteClick(account)}
                            >
                              Delete
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            )
          ))
        )}
      </Container>
      
      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Confirm Delete</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          Are you sure you want to delete this account? This action cannot be undone.
          {accountToDelete && (
            <div className="mt-3">
              <p><strong>Account Name:</strong> {accountToDelete.accountName}</p>
              <p><strong>Account Type:</strong> {accountToDelete.accountType}</p>
              {accountToDelete.description && (
                <p><strong>Description:</strong> {accountToDelete.description}</p>
              )}
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

export default LedgerAccounts;

