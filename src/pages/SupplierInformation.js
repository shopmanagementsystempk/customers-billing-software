import React, { useState, useEffect, useCallback } from 'react';
import { Container, Card, Table, Button, Form, Modal, Alert, Spinner, Row, Col, InputGroup } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { db } from '../firebase/config';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore';
import { Translate, useTranslatedAttribute } from '../utils';

const SupplierInformation = () => {
  const { currentUser, activeShopId } = useAuth();
  const getTranslatedAttr = useTranslatedAttribute();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    company: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    contactPerson: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState(null);

  const fetchSuppliers = useCallback(async () => {
    if (!activeShopId) return;

    setLoading(true);
    try {
      const suppliersRef = collection(db, 'suppliers');
      const q = query(
        suppliersRef,
        where('shopId', '==', activeShopId)
      );
      const querySnapshot = await getDocs(q);
      const suppliersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by name in JavaScript to avoid Firestore index requirement
      suppliersData.sort((a, b) => {
        const nameA = (a.name || '').toLowerCase();
        const nameB = (b.name || '').toLowerCase();
        return nameA.localeCompare(nameB);
      });
      setSuppliers(suppliersData);
    } catch (err) {
      console.error('Error fetching suppliers:', err);
      setError(getTranslatedAttr('failedToLoadSuppliers'));
    } finally {
      setLoading(false);
    }
  }, [activeShopId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

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
      setError(getTranslatedAttr('supplierNameRequired'));
      return;
    }

    if (!activeShopId) {
      setError('Shop ID is missing');
      return;
    }

    try {
      const supplierData = {
        ...formData,
        shopId: activeShopId,
        createdAt: editingSupplier ? editingSupplier.createdAt : new Date(),
        updatedAt: new Date()
      };

      if (editingSupplier) {
        const supplierRef = doc(db, 'suppliers', editingSupplier.id);
        await updateDoc(supplierRef, supplierData);
        setSuccess(getTranslatedAttr('supplierUpdatedSuccess'));
      } else {
        await addDoc(collection(db, 'suppliers'), supplierData);
        setSuccess(getTranslatedAttr('supplierAddedSuccess'));
      }

      setShowModal(false);
      resetForm();
      fetchSuppliers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error saving supplier:', err);
      setError(getTranslatedAttr('failedToSaveSupplier') + ': ' + err.message);
    }
  };

  const handleEdit = (supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name || '',
      company: supplier.company || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      city: supplier.city || '',
      contactPerson: supplier.contactPerson || '',
      notes: supplier.notes || ''
    });
    setShowModal(true);
  };

  const handleDelete = (supplier) => {
    setSupplierToDelete(supplier);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!supplierToDelete) return;

    try {
      await deleteDoc(doc(db, 'suppliers', supplierToDelete.id));
      setSuccess(getTranslatedAttr('supplierDeletedSuccess'));
      setShowDeleteModal(false);
      setSupplierToDelete(null);
      fetchSuppliers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error deleting supplier:', err);
      setError(getTranslatedAttr('failedToDeleteSupplier') + ': ' + err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      company: '',
      phone: '',
      email: '',
      address: '',
      city: '',
      contactPerson: '',
      notes: ''
    });
    setEditingSupplier(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const filteredSuppliers = suppliers.filter(supplier =>
    supplier.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    supplier.phone?.includes(searchTerm) ||
    supplier.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <MainNavbar />
      <Container className="pos-content">
        <PageHeader
          title={<Translate textKey="supplierInformation" />}
          icon="bi-truck"
          subtitle={<Translate textKey="manageSuppliersSubtitle" />}
        >
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="totalSuppliers" /></span>
            <span className="hero-metrics__value">{suppliers.length}</span>
          </div>
        </PageHeader>

        <div className="page-header-actions mb-3">
          <Button variant="primary" onClick={() => { resetForm(); setShowModal(true); }}>
            <i className="bi bi-plus-circle me-2"></i><Translate textKey="addNewSupplier" />
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
                    placeholder={getTranslatedAttr('searchSupplierPlaceholder')}
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
            ) : filteredSuppliers.length === 0 ? (
              <div className="text-center py-4">
                <i className="bi bi-truck" style={{ fontSize: '3rem', color: '#ccc' }}></i>
                <p className="text-muted mt-3">
                  {searchTerm ? getTranslatedAttr('noReceiptsMatch') : <Translate textKey="noDataFound" />}
                </p>
              </div>
            ) : (
              <Table responsive hover>
                <thead>
                  <tr>
                    <th><Translate textKey="name" /></th>
                    <th><Translate textKey="company" /></th>
                    <th><Translate textKey="contactPerson" /></th>
                    <th><Translate textKey="phone" /></th>
                    <th><Translate textKey="email" /></th>
                    <th><Translate textKey="city" /></th>
                    <th><Translate textKey="action" /></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.map(supplier => (
                    <tr key={supplier.id}>
                      <td>{supplier.name}</td>
                      <td>{supplier.company || '-'}</td>
                      <td>{supplier.contactPerson || '-'}</td>
                      <td>{supplier.phone || '-'}</td>
                      <td>{supplier.email || '-'}</td>
                      <td>{supplier.city || '-'}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => handleEdit(supplier)}
                        >
                          <i className="bi bi-pencil"></i> <Translate textKey="edit" />
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(supplier)}
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
            <Modal.Title>{editingSupplier ? <Translate textKey="editSupplier" /> : <Translate textKey="addNewSupplier" />}</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleSubmit}>
            <Modal.Body>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="supplierName" /> *</Form.Label>
                    <Form.Control
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      placeholder="Supplier name"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="company" /></Form.Label>
                    <Form.Control
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      placeholder="Company name"
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="contactPerson" /></Form.Label>
                    <Form.Control
                      type="text"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleInputChange}
                      placeholder="Contact person name"
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
                  placeholder="Additional notes about the supplier"
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={handleCloseModal}>
                <Translate textKey="cancel" />
              </Button>
              <Button variant="primary" type="submit">
                {editingSupplier ? <Translate textKey="save" /> : <Translate textKey="add" />}
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
            <p><Translate textKey="confirmDeleteSupplier" values={{ name: supplierToDelete?.name }} /></p>
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
    </>
  );
};

export default SupplierInformation;

