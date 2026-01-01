import React, { useState, useEffect, useCallback } from 'react';
import { Container, Form, Button, Row, Col, Card, Alert, Modal, Table, Spinner } from 'react-bootstrap';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import { Translate, getTranslatedAttr } from '../components/Translate';
import { getStockItemById, updateStockItem } from '../utils/stockUtils';
import { getInventoryCategories, addInventoryCategory, updateInventoryCategory, deleteInventoryCategory } from '../utils/categoryUtils';

const EditStockItem = () => {
  const { id } = useParams();
  const { currentUser, activeShopId } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [quantityUnit, setQuantityUnit] = useState('units'); // Default to units
  const [costPrice, setCostPrice] = useState('');
  const [supplier, setSupplier] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [lowStockAlert, setLowStockAlert] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [itemLoading, setItemLoading] = useState(true);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', description: '' });
  const [editCategory, setEditCategory] = useState({ id: '', name: '', description: '' });
  const [showEditCategoryModal, setShowEditCategoryModal] = useState(false);
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [categoryError, setCategoryError] = useState('');
  const [categorySuccess, setCategorySuccess] = useState('');
  const navigate = useNavigate();

  // Function to generate random 8-digit barcode
  const generateBarcode = () => {
    const randomBarcode = Math.floor(10000000 + Math.random() * 90000000).toString();
    setBarcode(randomBarcode);
    setSku(randomBarcode); // Also update SKU field with the generated barcode
  };

  // Fetch stock item data
  useEffect(() => {
    if (!currentUser || !id || !activeShopId) return;

    getStockItemById(id)
      .then(item => {
        // Check if item belongs to selected branch
        if (item.shopId !== activeShopId) {
          throw new Error('You do not have permission to edit this item');
        }

        // Populate form fields
        setName(item.name || '');
        setDescription(item.description || '');
        setCategory(item.category || '');
        setPrice(item.price?.toString() || '');
        setQuantity(item.quantity?.toString() || '');
        setQuantityUnit(item.quantityUnit || 'units'); // Set quantityUnit from item data or default to units
        setCostPrice(item.costPrice?.toString() || '');
        setSupplier(item.supplier || '');
        setSku(item.sku || '');
        setBarcode(item.barcode || item.sku || ''); // Load existing barcode or SKU
        setLowStockAlert(item.lowStockAlert?.toString() || ''); // Load existing low stock alert
        setExpiryDate(item.expiryDate || '');
      })
      .catch(error => {
        setError('Failed to load item: ' + error.message);
        console.error('Error loading stock item:', error);
      })
      .finally(() => {
        setItemLoading(false);
      });
  }, [id, currentUser, activeShopId]);

  const fetchCategories = useCallback(() => {
    if (!activeShopId) return;
    setCategoriesLoading(true);
    getInventoryCategories(activeShopId)
      .then(setCategories)
      .catch(err => console.error('Failed to load categories', err))
      .finally(() => setCategoriesLoading(false));
  }, [activeShopId]);

  // Fetch categories
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Category management handlers
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!activeShopId || !newCategory.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    setCategoryError('');
    setCategoriesLoading(true);
    try {
      const categoryData = {
        name: newCategory.name.trim(),
        description: newCategory.description.trim(),
        shopId: activeShopId
      };
      await addInventoryCategory(categoryData);
      setCategorySuccess('Category added successfully');
      setNewCategory({ name: '', description: '' });
      fetchCategories();
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (err) {
      setCategoryError(err.message || 'Failed to add category');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleEditCategory = (category) => {
    setEditCategory({ id: category.id, name: category.name, description: category.description || '' });
    setShowEditCategoryModal(true);
  };

  const handleUpdateCategory = async (e) => {
    e.preventDefault();
    if (!editCategory.id || !editCategory.name.trim()) {
      setCategoryError('Category name is required');
      return;
    }
    setCategoryError('');
    setCategoriesLoading(true);
    try {
      await updateInventoryCategory(editCategory.id, {
        name: editCategory.name.trim(),
        description: editCategory.description.trim()
      });
      setCategorySuccess('Category updated successfully');
      setShowEditCategoryModal(false);
      setEditCategory({ id: '', name: '', description: '' });
      fetchCategories();
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (err) {
      setCategoryError(err.message || 'Failed to update category');
    } finally {
      setCategoriesLoading(false);
    }
  };

  const handleDeleteCategory = (category) => {
    setCategoryToDelete(category);
    setShowDeleteCategoryModal(true);
  };

  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setCategoriesLoading(true);
    try {
      await deleteInventoryCategory(categoryToDelete.id);
      setCategorySuccess('Category deleted successfully');
      setShowDeleteCategoryModal(false);
      setCategoryToDelete(null);
      fetchCategories();
      setTimeout(() => setCategorySuccess(''), 3000);
    } catch (err) {
      setCategoryError(err.message || 'Failed to delete category');
    } finally {
      setCategoriesLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    // Validation
    if (!name.trim()) {
      setError('Item name is required');
      setLoading(false);
      return;
    }

    if (isNaN(parseFloat(price)) || parseFloat(price) < 0) {
      setError('Price must be a valid number');
      setLoading(false);
      return;
    }

    if (isNaN(parseFloat(quantity)) || parseFloat(quantity) < 0) {
      setError('Quantity must be a valid number');
      setLoading(false);
      return;
    }

    if (costPrice && (isNaN(parseFloat(costPrice)) || parseFloat(costPrice) < 0)) {
      setError('Cost price must be a valid number');
      setLoading(false);
      return;
    }

    if (lowStockAlert && (isNaN(parseFloat(lowStockAlert)) || parseFloat(lowStockAlert) < 0)) {
      setError('Low stock alert must be a valid number');
      setLoading(false);
      return;
    }

    // Create updated item data
    const itemData = {
      name: name.trim(),
      description: description.trim(),
      category: category.trim(),
      price: parseFloat(price),
      quantity: parseFloat(quantity), // Changed to parseFloat to support decimal values for kg
      quantityUnit: quantityUnit, // Store the unit (kg or units)
      costPrice: costPrice ? parseFloat(costPrice) : null,
      supplier: supplier.trim(),
      sku: sku.trim(),
      barcode: barcode.trim(), // Include barcode in the update
      expiryDate: expiryDate || null,
      lowStockAlert: lowStockAlert ? parseFloat(lowStockAlert) : null // Include low stock alert
    };

    // Update in Firestore
    updateStockItem(id, itemData)
      .then(() => {
        navigate('/stock');
      })
      .catch(error => {
        setError('Failed to update stock item: ' + error.message);
        console.error(error);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  if (itemLoading) {
    return (
      <>
        <MainNavbar />
        <Container className="text-center mt-5">
          <p>Loading item data...</p>
        </Container>
      </>
    );
  }

  if (error && !name) {
    return (
      <>
        <MainNavbar />
        <Container className="mt-4">
          <Alert variant="danger">{error}</Alert>
          <Button
            variant="primary"
            onClick={() => navigate('/stock')}
          >
            Back to Inventory
          </Button>
        </Container>
      </>
    );
  }

  return (
    <>
      <MainNavbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h2><Translate textKey="editStockItem" fallback="Edit Stock Item" /></h2>
          <Button
            variant="outline-secondary"
            onClick={() => navigate('/stock')}
          >
            <Translate textKey="backToInventory" />
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Card>
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="itemNameLabel" /></Form.Label>
                    <Form.Control
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <Form.Label className="mb-0">Category</Form.Label>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-decoration-none"
                        onClick={() => setShowCategoryModal(true)}
                        style={{ fontSize: '0.75rem' }}
                      >
                        <i className="bi bi-pencil-square me-1"></i><Translate textKey="manageCategories" />
                      </Button>
                    </div>
                    <Form.Select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      disabled={categoriesLoading}
                    >
                      <option value="">Select a category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Text className="text-muted">
                      {categoriesLoading ? 'Loading categories...' : categories.length === 0 ? 'No categories yet. Click "Manage Categories" to add.' : ''}
                    </Form.Text>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Description</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Product details, specifications, etc."
                />
              </Form.Group>

              <Row>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="sellingPriceLabel" /></Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="costPriceLabel" /></Form.Label>
                    <Form.Control
                      type="number"
                      step="0.01"
                      min="0"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      placeholder="Optional"
                    />
                  </Form.Group>
                </Col>
                <Col md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="quantityLabel" /></Form.Label>
                    <Row>
                      <Col xs={7}>
                        <Form.Control
                          type="number"
                          min="0"
                          step={quantityUnit === 'kg' ? '0.01' : '1'} // Allow decimals for kg
                          required
                          value={quantity}
                          onChange={(e) => setQuantity(e.target.value)}
                        />
                      </Col>
                      <Col xs={5}>
                        <Form.Select
                          value={quantityUnit}
                          onChange={(e) => setQuantityUnit(e.target.value)}
                        >
                          <option value="units"><Translate textKey="units" /></option>
                          <option value="kg"><Translate textKey="kg" /></option>
                        </Form.Select>
                      </Col>
                    </Row>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Supplier</Form.Label>
                    <Form.Control
                      type="text"
                      value={supplier}
                      onChange={(e) => setSupplier(e.target.value)}
                      placeholder="Optional"
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Barcode</Form.Label>
                    <div className="d-flex">
                      <Form.Control
                        type="text"
                        value={barcode}
                        onChange={(e) => {
                          setBarcode(e.target.value);
                          setSku(e.target.value); // Keep SKU in sync with barcode
                        }}
                        placeholder="Click Generate to create barcode"
                        className="me-2"
                      />
                      <Button
                        variant="outline-primary"
                        onClick={generateBarcode}
                        disabled={loading}
                      >
                        <Translate textKey="generate" />
                      </Button>
                    </div>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Low Stock Alert (Optional)</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.01"
                      value={lowStockAlert}
                      onChange={(e) => setLowStockAlert(e.target.value)}
                      placeholder="Minimum quantity"
                    />
                    <Form.Text className="text-muted">
                      Alert when stock falls below this quantity
                    </Form.Text>
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Expiry Date (Optional)</Form.Label>
                    <Form.Control
                      type="date"
                      value={expiryDate || ''}
                      onChange={(e) => setExpiryDate(e.target.value)}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex mt-4">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                  className="me-2"
                >
                  <Translate textKey="saveChanges" fallback="Save Changes" />
                </Button>
                <Button
                  variant="outline-secondary"
                  onClick={() => navigate('/stock')}
                  disabled={loading}
                >
                  <Translate textKey="cancel" />
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>

        {/* Category Management Modal */}
        <Modal show={showCategoryModal} onHide={() => setShowCategoryModal(false)} size="lg">
          <Modal.Header closeButton>
            <Modal.Title>Manage Inventory Categories</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {categoryError && <Alert variant="danger" dismissible onClose={() => setCategoryError('')}>{categoryError}</Alert>}
            {categorySuccess && <Alert variant="success" dismissible onClose={() => setCategorySuccess('')}>{categorySuccess}</Alert>}

            <Form onSubmit={handleAddCategory} className="mb-4">
              <h6>Add New Category</h6>
              <Row className="g-2">
                <Col md={5}>
                  <Form.Control
                    type="text"
                    placeholder="Category name"
                    value={newCategory.name}
                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                    required
                  />
                </Col>
                <Col md={5}>
                  <Form.Control
                    type="text"
                    placeholder="Description (optional)"
                    value={newCategory.description}
                    onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  />
                </Col>
                <Col md={2}>
                  <Button type="submit" variant="primary" disabled={categoriesLoading}>
                    Add
                  </Button>
                </Col>
              </Row>
            </Form>

            <hr />

            <h6>Existing Categories</h6>
            {categoriesLoading && !categories.length ? (
              <div className="text-center py-3">
                <Spinner animation="border" size="sm" />
              </div>
            ) : categories.length === 0 ? (
              <p className="text-muted">No categories yet. Add one above.</p>
            ) : (
              <Table hover size="sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map(cat => (
                    <tr key={cat.id}>
                      <td>{cat.name}</td>
                      <td>{cat.description || '-'}</td>
                      <td>
                        <Button
                          variant="outline-primary"
                          size="sm"
                          className="me-2"
                          onClick={() => handleEditCategory(cat)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDeleteCategory(cat)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowCategoryModal(false)}>
              Close
            </Button>
          </Modal.Footer>
        </Modal>

        {/* Edit Category Modal */}
        <Modal show={showEditCategoryModal} onHide={() => setShowEditCategoryModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Edit Category</Modal.Title>
          </Modal.Header>
          <Form onSubmit={handleUpdateCategory}>
            <Modal.Body>
              {categoryError && <Alert variant="danger">{categoryError}</Alert>}
              <Form.Group className="mb-3">
                <Form.Label>Category Name</Form.Label>
                <Form.Control
                  type="text"
                  value={editCategory.name}
                  onChange={(e) => setEditCategory({ ...editCategory, name: e.target.value })}
                  required
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                <Form.Control
                  type="text"
                  value={editCategory.description}
                  onChange={(e) => setEditCategory({ ...editCategory, description: e.target.value })}
                />
              </Form.Group>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowEditCategoryModal(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={categoriesLoading}>
                {categoriesLoading ? 'Updating...' : 'Update'}
              </Button>
            </Modal.Footer>
          </Form>
        </Modal>

        {/* Delete Category Confirmation Modal */}
        <Modal show={showDeleteCategoryModal} onHide={() => setShowDeleteCategoryModal(false)}>
          <Modal.Header closeButton>
            <Modal.Title>Delete Category</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Are you sure you want to delete the category <strong>"{categoryToDelete?.name}"</strong>?</p>
            <p className="text-muted small">This will not delete products in this category, but the category will be removed from the dropdown.</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowDeleteCategoryModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmDeleteCategory} disabled={categoriesLoading}>
              {categoriesLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  );
};

export default EditStockItem;