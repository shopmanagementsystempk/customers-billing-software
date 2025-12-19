import React, { useState, useEffect, useCallback } from 'react';
import { Container, Table, Card, Badge, Alert, Spinner, Button, Modal, Form, Row, Col } from 'react-bootstrap';
import { useAdmin } from '../contexts/AdminContext';
import AdminNavbar from '../components/AdminNavbar';

// Simple mock data for direct use
const MOCK_USERS = [
  {
    id: 'mock-user-1',
    shopName: 'Active Shop',
    email: 'activeshop@example.com',
    address: '123 Active Street',
    phoneNumber: '123-456-7890',
    status: 'approved',
    createdAt: new Date().toISOString()
  },
  {
    id: 'mock-user-2',
    shopName: 'Pending Shop',
    email: 'pendingshop@example.com',
    address: '456 Pending Avenue',
    phoneNumber: '098-765-4321',
    status: 'pending',
    createdAt: new Date(Date.now() - 86400000).toISOString() // 1 day ago
  },
  {
    id: 'mock-user-3',
    shopName: 'Frozen Shop',
    email: 'frozenshop@example.com',
    address: '789 Frozen Lane',
    phoneNumber: '555-123-4567',
    status: 'frozen',
    createdAt: new Date(Date.now() - 172800000).toISOString() // 2 days ago
  },
  {
    id: 'mock-user-4',
    shopName: 'Rejected Shop',
    email: 'rejectedshop@example.com',
    address: '321 Rejected Road',
    phoneNumber: '111-222-3333',
    status: 'rejected',
    createdAt: new Date(Date.now() - 259200000).toISOString() // 3 days ago
  }
];

const initialNewUserState = {
  shopName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phoneNumber: '',
  address: '',
  status: 'approved'
};

const AdminManageUsers = () => {
  const { getAllUsers, toggleUserFreeze, createShopAccount } = useAdmin();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUserData, setNewUserData] = useState(initialNewUserState);
  const [createModalError, setCreateModalError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [creatingUser, setCreatingUser] = useState(false);

  // Get status badge
  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return <Badge bg="success">Active</Badge>;
      case 'pending':
        return <Badge bg="warning">Pending</Badge>;
      case 'rejected':
        return <Badge bg="danger">Rejected</Badge>;
      case 'frozen':
        return <Badge bg="secondary">Frozen</Badge>;
      default:
        return <Badge bg="info">{status}</Badge>;
    }
  };

  // Enhanced fetch users function to include email data
  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      console.log("Fetching all users...");
      
      // Get users from context
      const fetchedUsers = await getAllUsers();
      console.log("Fetched users from context:", fetchedUsers);
      
      // Get user auth data with email
      // Since we can't directly call Firebase Admin SDK from client,
      // we need to ensure emails are stored in Firestore during registration
      // For now, we'll use the current approach and enhance with user emails
      
      // Map the email from auth data if available, or use existing email field
      const usersWithEmail = fetchedUsers.map(user => {
        // If user already has email field, use it
        if (user.email) {
          return user;
        }
        
        // Otherwise, check if we have email in auth object or set to "Email not available"
        return {
          ...user,
          email: user.userEmail || "Email not available" // Add this fallback
        };
      });
      
      setUsers(usersWithEmail);
    } catch (error) {
      console.error("Error fetching users:", error);
      setError('Failed to load users. Using mock data instead.');
      // Fall back to mock data on any error
      setUsers(MOCK_USERS);
    } finally {
      setLoading(false);
    }
  }, [getAllUsers]);

  // Load users on component mount
  useEffect(() => {
    console.log("Component mounted, fetching users...");
    fetchUsers();
  }, [fetchUsers]);

  // Handle freeze/unfreeze user
  const handleToggleFreeze = async (userId, currentStatus) => {
    try {
      setActionLoading(prev => ({ ...prev, [userId]: true }));
      const shouldFreeze = currentStatus !== 'frozen';
      await toggleUserFreeze(userId, shouldFreeze);
      
      // Update local state
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === userId 
            ? { ...user, status: shouldFreeze ? 'frozen' : 'approved' } 
            : user
        )
      );
    } catch (error) {
      console.error('Error toggling user freeze status:', error);
      setError(`Failed to ${currentStatus === 'frozen' ? 'unfreeze' : 'freeze'} user. Please try again.`);
    } finally {
      setActionLoading(prev => ({ ...prev, [userId]: false }));
    }
  };

  // For content padding with sidebar
  const contentStyle = {
    marginLeft: '280px',
    padding: '32px',
    transition: 'all 0.3s',
    minHeight: '100vh',
    backgroundColor: '#f5f7fb'
  };

  // For mobile view
  const mobileContentStyle = {
    padding: '24px',
    backgroundColor: '#f5f7fb'
  };

  const handleCreateInputChange = (e) => {
    const { name, value } = e.target;
    setNewUserData(prev => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
    setCreateModalError('');
    setNewUserData({ ...initialNewUserState });
    setShowCreateModal(true);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateModalError('');
    setNewUserData({ ...initialNewUserState });
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreateModalError('');
    if (newUserData.password !== newUserData.confirmPassword) {
      setCreateModalError('Passwords do not match');
      return;
    }

    try {
      setCreatingUser(true);
      await createShopAccount({
        shopName: newUserData.shopName.trim(),
        email: newUserData.email.trim().toLowerCase(),
        password: newUserData.password,
        phoneNumber: newUserData.phoneNumber.trim(),
        address: newUserData.address.trim(),
        status: newUserData.status
      });

      setCreateSuccess('User account created successfully.');
      closeCreateModal();
      await fetchUsers();
    } catch (createError) {
      setCreateModalError(createError.message || 'Failed to create account. Please try again.');
    } finally {
      setCreatingUser(false);
    }
  };

  const renderCreateSuccessAlert = () =>
    createSuccess ? (
      <Alert variant="success" dismissible onClose={() => setCreateSuccess('')}>
        {createSuccess}
      </Alert>
    ) : null;

  return (
    <>
      <AdminNavbar />
      <div className="d-none d-lg-block" style={contentStyle}>
        <Container fluid>
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
            <div>
              <h2 className="mb-1">Manage Users</h2>
              <p className="text-muted mb-0">Approve, freeze, or create new shop accounts</p>
            </div>
            <Button variant="primary" onClick={openCreateModal}>
              <i className="bi bi-plus-circle me-2"></i>
              Create User
            </Button>
          </div>

          {renderCreateSuccessAlert()}
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Card className="border-0 shadow-sm">
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" role="status" variant="primary">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                  <p className="mt-3">Loading users...</p>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <pre>{JSON.stringify({ usersCount: users.length }, null, 2)}</pre>
                  </div>
                  
                  <div className="table-responsive">
                    <Table hover>
                      <thead>
                        <tr>
                          <th>Shop Name</th>
                          <th>Email</th>
                          <th>Password</th>
                          <th>Address</th>
                          <th>Phone</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {users.map((user) => (
                          <tr key={user.id}>
                            <td>{user.shopName}</td>
                            <td>{user.email}</td>
                            <td>{user.password || '—'}</td>
                            <td>{user.address || 'N/A'}</td>
                            <td>{user.phoneNumber || 'N/A'}</td>
                            <td>{getStatusBadge(user.status)}</td>
                            <td>
                              {user.status !== 'pending' && user.status !== 'rejected' && (
                                <Button
                                  variant={user.status === 'frozen' ? 'outline-success' : 'outline-secondary'}
                                  size="sm"
                                  onClick={() => handleToggleFreeze(user.id, user.status)}
                                  disabled={actionLoading[user.id]}
                                >
                                  {actionLoading[user.id] ? (
                                    <Spinner
                                      as="span"
                                      animation="border"
                                      size="sm"
                                      role="status"
                                      aria-hidden="true"
                                    />
                                  ) : (
                                    user.status === 'frozen' ? 'Unfreeze' : 'Freeze'
                                  )}
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>
      
      {/* Mobile view */}
      <div className="d-block d-lg-none" style={mobileContentStyle}>
        <Container fluid>
          <div className="d-flex flex-column gap-2 mb-4">
            <div>
              <h2 className="mb-1">Manage Users</h2>
              <p className="text-muted mb-0">Administer shop accounts on the go</p>
            </div>
            <Button variant="primary" onClick={openCreateModal}>
              <i className="bi bi-plus-circle me-2"></i>
              Create User
            </Button>
          </div>

          {renderCreateSuccessAlert()}
          {error && <Alert variant="danger">{error}</Alert>}
          
          <Card className="border-0 shadow-sm">
            <Card.Body>
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" role="status" variant="primary">
                    <span className="visually-hidden">Loading...</span>
                  </Spinner>
                  <p className="mt-3">Loading users...</p>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <pre>{JSON.stringify({ usersCount: users.length }, null, 2)}</pre>
                  </div>
                  
                  {users.map((user) => (
                    <Card key={user.id} className="mb-3">
                      <Card.Body>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h5>{user.shopName}</h5>
                          {getStatusBadge(user.status)}
                        </div>
                        <p className="mb-1">{user.email}</p>
                        <p className="mb-1"><strong>Password:</strong> {user.password || '—'}</p>
                        <p className="mb-1">{user.address || 'No address'}</p>
                        <p className="mb-1">{user.phoneNumber || 'No phone'}</p>
                        
                        {user.status !== 'pending' && user.status !== 'rejected' && (
                          <Button
                            variant={user.status === 'frozen' ? 'outline-success' : 'outline-secondary'}
                            size="sm"
                            onClick={() => handleToggleFreeze(user.id, user.status)}
                            disabled={actionLoading[user.id]}
                            className="mt-2"
                          >
                            {actionLoading[user.id] ? (
                              <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                              />
                            ) : (
                              user.status === 'frozen' ? 'Unfreeze' : 'Freeze'
                            )}
                          </Button>
                        )}
                      </Card.Body>
                    </Card>
                  ))}
                </>
              )}
            </Card.Body>
          </Card>
        </Container>
      </div>

      <Modal show={showCreateModal} onHide={closeCreateModal} size="lg" centered>
        <Form onSubmit={handleCreateUser}>
          <Modal.Header closeButton>
            <Modal.Title>Create New Shop Account</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {createModalError && <Alert variant="danger">{createModalError}</Alert>}
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Shop Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="shopName"
                    value={newUserData.shopName}
                    onChange={handleCreateInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Email</Form.Label>
                  <Form.Control
                    type="email"
                    name="email"
                    value={newUserData.email}
                    onChange={handleCreateInputChange}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="password"
                    value={newUserData.password}
                    onChange={handleCreateInputChange}
                    autoComplete="new-password"
                    required
                    minLength={8}
                  />
                  <Form.Text className="text-muted">
                    Must include uppercase, lowercase, number, and special character.
                  </Form.Text>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Confirm Password</Form.Label>
                  <Form.Control
                    type="password"
                    name="confirmPassword"
                    value={newUserData.confirmPassword}
                    onChange={handleCreateInputChange}
                    autoComplete="new-password"
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Phone Number</Form.Label>
                  <Form.Control
                    type="text"
                    name="phoneNumber"
                    value={newUserData.phoneNumber}
                    onChange={handleCreateInputChange}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label>Account Status</Form.Label>
                  <Form.Select
                    name="status"
                    value={newUserData.status}
                    onChange={handleCreateInputChange}
                  >
                    <option value="approved">Approved (Active)</option>
                    <option value="pending">Pending Approval</option>
                    <option value="frozen">Frozen</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label>Address</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    name="address"
                    value={newUserData.address}
                    onChange={handleCreateInputChange}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" onClick={closeCreateModal}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={creatingUser}>
              {creatingUser ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    className="me-2"
                  />
                  Creating...
                </>
              ) : (
                'Create Account'
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default AdminManageUsers; 