import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Button, Form, Alert, Table, Modal, Badge, Row, Col } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import { collection, setDoc, updateDoc, query, where, getDocs, doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { auth } from '../firebase/config';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { validatePassword } from '../utils/passwordPolicy';
import MainNavbar from '../components/Navbar';
import { Translate, useTranslatedAttribute } from '../utils';
import PageHeader from '../components/PageHeader';
import { formatCurrency } from '../utils/receiptUtils';

const StaffManagement = () => {
  const { currentUser, shopData, activeShopId } = useAuth();
  const getTranslatedAttr = useTranslatedAttribute();
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    permissions: {
      canViewReceipts: false,
      canCreateReceipts: false,
      canEditReceipts: false,
      canDeleteReceipts: false,
      canViewStock: false,
      canEditStock: false,
      canViewEmployees: false,
      canManageEmployees: false,
      canMarkAttendance: false,
      canManageSalary: false,
      canViewAnalytics: false,
      canManageExpenses: false,
      canManageContacts: false,
      canManageLedger: false,
      canManageSettings: false
    }
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [staffSales, setStaffSales] = useState({});

  const fetchStaffList = useCallback(async () => {
    if (!currentUser) return;

    try {
      const q = query(collection(db, 'staff'), where('shopId', '==', activeShopId));
      const querySnapshot = await getDocs(q);
      const staff = [];
      querySnapshot.forEach((doc) => {
        staff.push({ id: doc.id, ...doc.data() });
      });
      setStaffList(staff);
    } catch (error) {
      console.error('Error fetching staff:', error);
      setError(getTranslatedAttr('failedToFetchStaff'));
    } finally {
      setLoading(false);
    }
  }, [currentUser, activeShopId]);

  const fetchStaffSales = useCallback(async () => {
    if (!activeShopId) return;
    try {
      const receiptRef = collection(db, 'receipts');
      const q = query(receiptRef, where('shopId', '==', activeShopId));
      const snapshot = await getDocs(q);
      const salesMap = {};
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const creatorId = data.createdBy || data.userId || null;
        if (!creatorId) return;
        const amount = parseFloat(data.totalAmount || 0);
        salesMap[creatorId] = (salesMap[creatorId] || 0) + amount;
      });
      setStaffSales(salesMap);
    } catch (err) {
      console.error('Error fetching receipts for staff sales:', err);
    }
  }, [activeShopId]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchStaffList();
  }, [fetchStaffList]);

  useEffect(() => {
    fetchStaffSales();
  }, [fetchStaffSales]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith('permission_')) {
      const permissionName = name.replace('permission_', '');
      setFormData(prev => ({
        ...prev,
        permissions: {
          ...prev.permissions,
          [permissionName]: type === 'checkbox' ? checked : value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleEdit = (staff) => {
    setSelectedStaff(staff);
    setFormData({
      name: staff.name,
      email: staff.email,
      password: staff.password || '', // Pre-fill password if available
      permissions: { ...staff.permissions }
    });
    setIsEditMode(true);
    setShowEditModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      // If editing, update existing staff
      if (isEditMode && selectedStaff) {
        // Update staff data in Firestore
        await updateDoc(doc(db, 'staff', selectedStaff.id), {
          name: formData.name,
          permissions: formData.permissions,
          updatedAt: new Date().toISOString()
        });

        setSuccess(getTranslatedAttr('staffMemberUpdated'));
        setShowEditModal(false);
        setIsEditMode(false);
        setSelectedStaff(null);
        fetchStaffList();

        // Reset form
        setFormData({
          name: '',
          email: '',
          password: '',
          permissions: {
            canViewReceipts: false,
            canCreateReceipts: false,
            canEditReceipts: false,
            canDeleteReceipts: false,
            canViewStock: false,
            canEditStock: false,
            canViewEmployees: false,
            canManageEmployees: false,
            canMarkAttendance: false,
            canManageSalary: false,
            canViewAnalytics: false,
            canManageExpenses: false,
            canManageContacts: false,
            canManageLedger: false,
            canManageSettings: false
          }
        });
        return;
      }

      // Validate password for new staff
      const passwordValidation = validatePassword(formData.password);
      if (!passwordValidation.isValid) {
        setError(passwordValidation.message);
        return;
      }

      // Check if email already exists
      const staffQuery = query(collection(db, 'staff'), where('email', '==', formData.email));
      const staffSnapshot = await getDocs(staffQuery);
      const shopsQuery = query(collection(db, 'shops'), where('userEmail', '==', formData.email));
      const shopsSnapshot = await getDocs(shopsQuery);

      if (!staffSnapshot.empty || !shopsSnapshot.empty) {
        setError(getTranslatedAttr('emailAlreadyRegistered'));
        return;
      }

      // Create Firebase Auth account for staff
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const staffUserId = userCredential.user.uid;

      // Store staff data in Firestore using the UID as document ID
      await setDoc(doc(db, 'staff', staffUserId), {
        name: formData.name,
        email: formData.email,
        password: formData.password, // Store password for admin viewing
        shopId: activeShopId,
        permissions: formData.permissions,
        createdAt: new Date().toISOString(),
        status: 'active',
        accountType: 'staff'
      });

      // Note: Firebase Auth automatically signs in the newly created staff account
      // We need to redirect the shop owner to login page to re-authenticate

      // Close the modal first
      setShowModal(false);

      // Redirect to login immediately
      window.location.href = '/login';
    } catch (error) {
      console.error('Error creating staff:', error);
      setError(error.message || getTranslatedAttr('failedToCreateStaff'));
    }
  };

  const handleDelete = async () => {
    if (!selectedStaff) return;

    try {
      await deleteDoc(doc(db, 'staff', selectedStaff.id));
      setSuccess('Staff account deleted successfully');
      setShowDeleteModal(false);
      setSelectedStaff(null);
      fetchStaffList();
    } catch (error) {
      console.error('Error deleting staff:', error);
      setError(getTranslatedAttr('failedToDeleteStaff'));
    }
  };

  const getPermissionCount = (permissions) => {
    return Object.values(permissions).filter(Boolean).length;
  };

  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader
          title={<Translate textKey="staffManagement" />}
          icon="bi-people"
          subtitle={<Translate textKey="staffManagementSubtitle" />}
        />
        <div className="page-header-actions">
          <Button variant="primary" onClick={() => {
            setFormData({
              name: '',
              email: '',
              password: '',
              permissions: {
                canViewReceipts: false,
                canCreateReceipts: false,
                canEditReceipts: false,
                canDeleteReceipts: false,
                canViewStock: false,
                canEditStock: false,
                canViewEmployees: false,
                canManageEmployees: false,
                canMarkAttendance: false,
                canManageSalary: false,
                canViewAnalytics: false,
                canManageExpenses: false,
                canManageContacts: false,
                canManageLedger: false,
                canManageSettings: false
              }
            });
            setShowModal(true);
          }}>
            + <Translate textKey="addStaff" />
          </Button>
        </div>

        {error && <Alert variant="danger" dismissible onClose={() => setError('')}>{error}</Alert>}
        {success && <Alert variant="success" dismissible onClose={() => setSuccess('')}>{success}</Alert>}

        <Card>
          <Card.Body>
            {loading ? (
              <div className="text-center py-4"><Translate textKey="loading" /></div>
            ) : staffList.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <Translate textKey="noStaffMembers" />
              </div>
            ) : (
              <Table responsive striped hover>
                <thead>
                  <tr>
                    <th><Translate textKey="name" /></th>
                    <th><Translate textKey="email" /></th>
                    <th><Translate textKey="permissions" /></th>
                    <th><Translate textKey="staffSales" /></th>
                    <th><Translate textKey="status" /></th>
                    <th><Translate textKey="action" /></th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((staff) => (
                    <tr key={staff.id}>
                      <td>{staff.name}</td>
                      <td>{staff.email}</td>
                      <td>
                        <Badge bg="info">{getPermissionCount(staff.permissions)} <Translate textKey="permissions" /></Badge>
                      </td>
                      <td>{formatCurrency(staffSales[staff.id] || 0)}</td>
                      <td>
                        <Badge bg={staff.status === 'active' ? 'success' : 'secondary'}>
                          {staff.status}
                        </Badge>
                      </td>
                      <td>
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => handleEdit(staff)}
                          className="me-2"
                        >
                          <Translate textKey="edit" />
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => {
                            setSelectedStaff(staff);
                            setShowDeleteModal(true);
                          }}
                        >
                          <Translate textKey="delete" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card.Body>
        </Card>

        {/* Add Staff Modal */}
        <Modal show={showModal} onHide={() => {
          setShowModal(false);
          setFormData({
            name: '',
            email: '',
            password: '',
            permissions: {
              canViewReceipts: false,
              canCreateReceipts: false,
              canEditReceipts: false,
              canDeleteReceipts: false,
              canViewStock: false,
              canEditStock: false,
              canViewEmployees: false,
              canManageEmployees: false,
              canMarkAttendance: false,
              canManageSalary: false,
              canViewAnalytics: false,
              canManageExpenses: false,
              canManageContacts: false,
              canManageLedger: false,
              canManageSettings: false
            }
          });
        }} size="lg">
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="addStaffMember" /></Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="name" /></Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="email" /></Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  autoComplete="off"
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="password" /></Form.Label>
                <Form.Control
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  autoComplete="new-password"
                />
                <Form.Text className="text-muted">
                  <Translate textKey="passwordHelp" />
                </Form.Text>
              </Form.Group>

              <hr />
              <h5><Translate textKey="permissions" /></h5>

              <Row>
                <Col md={6}>
                  <Form.Check
                    type="checkbox"
                    id="permission_ViewReceipts"
                    name="permission_canViewReceipts"
                    label={<Translate textKey="viewReceipts" />}
                    checked={formData.permissions.canViewReceipts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_CreateReceipts"
                    name="permission_canCreateReceipts"
                    label={<Translate textKey="createReceipts" />}
                    checked={formData.permissions.canCreateReceipts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_EditReceipts"
                    name="permission_canEditReceipts"
                    label={<Translate textKey="editReceipts" />}
                    checked={formData.permissions.canEditReceipts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_DeleteReceipts"
                    name="permission_canDeleteReceipts"
                    label={<Translate textKey="deleteReceipts" />}
                    checked={formData.permissions.canDeleteReceipts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_ViewStock"
                    name="permission_canViewStock"
                    label={<Translate textKey="viewStock" />}
                    checked={formData.permissions.canViewStock}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_EditStock"
                    name="permission_canEditStock"
                    label={<Translate textKey="editStock" />}
                    checked={formData.permissions.canEditStock}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_ManageLedger"
                    name="permission_canManageLedger"
                    label={<Translate textKey="manageLedger" />}
                    checked={formData.permissions.canManageLedger}
                    onChange={handleInputChange}
                  />
                </Col>
                <Col md={6}>
                  <Form.Check
                    type="checkbox"
                    id="permission_ViewEmployees"
                    name="permission_canViewEmployees"
                    label={<Translate textKey="viewEmployees" />}
                    checked={formData.permissions.canViewEmployees}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_ManageEmployees"
                    name="permission_canManageEmployees"
                    label={<Translate textKey="manageEmployees" />}
                    checked={formData.permissions.canManageEmployees}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_MarkAttendance"
                    name="permission_canMarkAttendance"
                    label={<Translate textKey="markAttendance" />}
                    checked={formData.permissions.canMarkAttendance}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_ManageSalary"
                    name="permission_canManageSalary"
                    label={<Translate textKey="manageSalary" />}
                    checked={formData.permissions.canManageSalary}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_ViewAnalytics"
                    name="permission_canViewAnalytics"
                    label={<Translate textKey="viewAnalytics" />}
                    checked={formData.permissions.canViewAnalytics}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_ManageExpenses"
                    name="permission_canManageExpenses"
                    label={<Translate textKey="manageExpenses" />}
                    checked={formData.permissions.canManageExpenses}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_ManageContacts"
                    name="permission_canManageContacts"
                    label={<Translate textKey="manageContacts" />}
                    checked={formData.permissions.canManageContacts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="permission_ManageSettings"
                    name="permission_canManageSettings"
                    label={<Translate textKey="manageSettings" />}
                    checked={formData.permissions.canManageSettings}
                    onChange={handleInputChange}
                  />
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowModal(false)}>
                <Translate textKey="cancel" />
              </Button>
              <Button variant="primary" type="submit">
                <Translate textKey="createStaffAccount" />
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Edit Staff Modal */}
        <Modal show={showEditModal} onHide={() => {
          setShowEditModal(false);
          setIsEditMode(false);
          setSelectedStaff(null);
        }} size="lg">
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="editStaffMember" /></Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="name" /></Form.Label>
                <Form.Control
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  required
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="email" /></Form.Label>
                <Form.Control
                  type="email"
                  name="email"
                  value={formData.email}
                  disabled
                />
                <Form.Text className="text-muted">
                  <Translate textKey="emailCannotBeChanged" />
                </Form.Text>
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label><Translate textKey="password" /></Form.Label>
                <Form.Control
                  type="text"
                  name="password"
                  value={formData.password || 'Not Available'}
                  readOnly
                  disabled
                />
                <Form.Text className="text-muted">
                  Note: Password can only be viewed here. To change it, the staff must use the forgot password feature or staff settings.
                </Form.Text>
              </Form.Group>

              <hr />
              <h5><Translate textKey="permissions" /></h5>

              <Row>
                <Col md={6}>
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ViewReceipts"
                    name="permission_canViewReceipts"
                    label={<Translate textKey="viewReceipts" />}
                    checked={formData.permissions.canViewReceipts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_CreateReceipts"
                    name="permission_canCreateReceipts"
                    label={<Translate textKey="createReceipts" />}
                    checked={formData.permissions.canCreateReceipts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_EditReceipts"
                    name="permission_canEditReceipts"
                    label={<Translate textKey="editReceipts" />}
                    checked={formData.permissions.canEditReceipts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_DeleteReceipts"
                    name="permission_canDeleteReceipts"
                    label={<Translate textKey="deleteReceipts" />}
                    checked={formData.permissions.canDeleteReceipts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ViewStock"
                    name="permission_canViewStock"
                    label={<Translate textKey="viewStock" />}
                    checked={formData.permissions.canViewStock}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_EditStock"
                    name="permission_canEditStock"
                    label={<Translate textKey="editStock" />}
                    checked={formData.permissions.canEditStock}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ManageLedger"
                    name="permission_canManageLedger"
                    label={<Translate textKey="manageLedger" />}
                    checked={formData.permissions.canManageLedger}
                    onChange={handleInputChange}
                  />
                </Col>
                <Col md={6}>
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ViewEmployees"
                    name="permission_canViewEmployees"
                    label={<Translate textKey="viewEmployees" />}
                    checked={formData.permissions.canViewEmployees}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ManageEmployees"
                    name="permission_canManageEmployees"
                    label={<Translate textKey="manageEmployees" />}
                    checked={formData.permissions.canManageEmployees}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_MarkAttendance"
                    name="permission_canMarkAttendance"
                    label={<Translate textKey="markAttendance" />}
                    checked={formData.permissions.canMarkAttendance}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ManageSalary"
                    name="permission_canManageSalary"
                    label={<Translate textKey="manageSalary" />}
                    checked={formData.permissions.canManageSalary}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ViewAnalytics"
                    name="permission_canViewAnalytics"
                    label={<Translate textKey="viewAnalytics" />}
                    checked={formData.permissions.canViewAnalytics}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ManageExpenses"
                    name="permission_canManageExpenses"
                    label={<Translate textKey="manageExpenses" />}
                    checked={formData.permissions.canManageExpenses}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ManageContacts"
                    name="permission_canManageContacts"
                    label={<Translate textKey="manageContacts" />}
                    checked={formData.permissions.canManageContacts}
                    onChange={handleInputChange}
                  />
                  <Form.Check
                    type="checkbox"
                    id="edit-permission_ManageSettings"
                    name="permission_canManageSettings"
                    label={<Translate textKey="manageSettings" />}
                    checked={formData.permissions.canManageSettings}
                    onChange={handleInputChange}
                  />
                </Col>
              </Row>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => {
                setShowEditModal(false);
                setIsEditMode(false);
                setSelectedStaff(null);
              }}>
                <Translate textKey="cancel" />
              </Button>
              <Button variant="primary" type="submit">
                <Translate textKey="updateStaffMember" />
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title><Translate textKey="confirmDelete" /></Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Translate textKey="confirmDeleteStaff" values={{ staffName: selectedStaff?.name }} />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  );
};

export default StaffManagement;

