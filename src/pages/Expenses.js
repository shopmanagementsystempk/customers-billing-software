import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate, translations } from '../utils';
import { getShopExpenseRecords, deleteExpense, getExpenseCategories, getExpenseStatistics } from '../utils/expenseUtils';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import './Expenses.css';

const Expenses = () => {
  const { currentUser, activeShopId } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });

  // Fetch expenses and categories
  useEffect(() => {
    const fetchData = async () => {
      if (!currentUser || !activeShopId) return;

      setLoading(true);
      setError('');

      try {
        // Fetch expense categories
        const categoriesData = await getExpenseCategories(activeShopId);
        setCategories(categoriesData);

        // Fetch all expenses
        const expensesData = await getShopExpenseRecords(activeShopId);
        setExpenses(expensesData);

        // Fetch expense statistics
        const statsData = await getExpenseStatistics(activeShopId);
        setStatistics(statsData);
      } catch (error) {
        console.error('Error fetching expense data:', error);
        setError('Failed to load expense data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentUser, activeShopId]);

  // Handle category filter change
  const handleCategoryChange = (e) => {
    setSelectedCategory(e.target.value);
  };

  // Handle search term change
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle date range change
  const handleDateRangeChange = (e) => {
    const { name, value } = e.target;
    setDateRange(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Filter expenses based on selected category, search term, and date range
  const filteredExpenses = expenses.filter(expense => {
    // Category filter
    const categoryMatch = selectedCategory === 'all' || expense.categoryId === selectedCategory;

    // Search term filter (search in description and notes)
    const searchMatch = searchTerm === '' ||
      (expense.description && expense.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (expense.notes && expense.notes.toLowerCase().includes(searchTerm.toLowerCase()));

    // Date range filter
    const startDateMatch = !dateRange.startDate || expense.expenseDate >= dateRange.startDate;
    const endDateMatch = !dateRange.endDate || expense.expenseDate <= dateRange.endDate;

    return categoryMatch && searchMatch && startDateMatch && endDateMatch;
  });

  // Calculate total of filtered expenses
  const filteredTotal = filteredExpenses.reduce(
    (total, expense) => total + (parseFloat(expense.amount) || 0),
    0
  );

  // Handle delete expense
  const handleDeleteClick = (expense) => {
    setExpenseToDelete(expense);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;

    try {
      await deleteExpense(expenseToDelete.id);

      // Update expenses list
      setExpenses(expenses.filter(exp => exp.id !== expenseToDelete.id));

      // Update statistics
      const statsData = await getExpenseStatistics(activeShopId);
      setStatistics(statsData);

      setShowDeleteModal(false);
      setExpenseToDelete(null);
    } catch (error) {
      console.error('Error deleting expense:', error);
      setError('Failed to delete expense. Please try again.');
    }
  };

  // Get category name by ID
  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : (translations[language]?.uncategorized || 'Uncategorized');
  };

  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader
          title="Expenses"
          icon="bi-wallet2"
          subtitle="Track day-to-day spending, filter by category, and stay on top of costs."
        />
        <div className="page-header-actions">
          <Button
            variant="primary"
            onClick={() => navigate('/add-expense')}
          >
            <Translate textKey="addExpense" fallback="Add Expense" />
          </Button>
          <Button
            variant="outline-primary"
            onClick={() => navigate('/expense-categories')}
          >
            <Translate textKey="manageCategories" fallback="Manage Categories" />
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {/* Statistics Cards */}
        {statistics && (
          <div className="dashboard-stats-grid-v2 mb-4">
            {/* Total Expenses This Month - Red */}
            <div className="stat-card-v2 stat-card-v2--red slide-in-up">
              <div className="stat-card-v2__value">
                {formatCurrency(statistics.totalCurrentMonth).replace('RS', 'RS ')}
              </div>
              <div className="stat-card-v2__label">
                <Translate textKey="totalExpensesThisMonth" fallback="Total Expenses This Month" />
              </div>
              <i className="bi bi-calendar-month stat-card-v2__icon"></i>
            </div>

            {/* Total Expenses All Time - Purple */}
            <div className="stat-card-v2 stat-card-v2--purple slide-in-up" style={{ animationDelay: '0.1s' }}>
              <div className="stat-card-v2__value">
                {formatCurrency(statistics.totalAllTime).replace('RS', 'RS ')}
              </div>
              <div className="stat-card-v2__label">
                <Translate textKey="totalExpensesAllTime" fallback="Total Expenses All Time" />
              </div>
              <i className="bi bi-history stat-card-v2__icon"></i>
            </div>

            {/* Average Per Expense - Orange */}
            <div className="stat-card-v2 stat-card-v2--orange slide-in-up" style={{ animationDelay: '0.2s' }}>
              <div className="stat-card-v2__value">
                {statistics.recordCount > 0
                  ? formatCurrency(statistics.totalAllTime / statistics.recordCount).replace('RS', 'RS ')
                  : formatCurrency(0).replace('RS', 'RS ')
                }
              </div>
              <div className="stat-card-v2__label">
                <Translate textKey="averageMonthlyExpense" fallback="Average Expense" />
              </div>
              <i className="bi bi-calculator stat-card-v2__icon"></i>
            </div>

            {/* Filtered Total - Blue */}
            <div className="stat-card-v2 stat-card-v2--blue slide-in-up" style={{ animationDelay: '0.3s' }}>
              <div className="stat-card-v2__value">
                {formatCurrency(filteredTotal).replace('RS', 'RS ')}
              </div>
              <div className="stat-card-v2__label">
                <Translate textKey="filteredTotal" fallback="Filtered Total" />
              </div>
              <i className="bi bi-funnel stat-card-v2__icon"></i>
            </div>
          </div>
        )}

        {/* Filters */}
        <Card className="mb-4 shadow-sm">
          <Card.Body>
            <h5><Translate textKey="filters" fallback="Filters" /></h5>
            <Row className="g-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label><Translate textKey="category" fallback="Category" /></Form.Label>
                  <Form.Select
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                  >
                    <option value="all"><Translate textKey="allCategories" fallback="All Categories" /></option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label><Translate textKey="search" fallback="Search" /></Form.Label>
                  <Form.Control
                    type="text"
                    placeholder="Search in description or notes"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label><Translate textKey="startDate" fallback="Start Date" /></Form.Label>
                  <Form.Control
                    type="date"
                    name="startDate"
                    value={dateRange.startDate}
                    onChange={handleDateRangeChange}
                  />
                </Form.Group>
              </Col>
              <Col md={2}>
                <Form.Group>
                  <Form.Label><Translate textKey="endDate" fallback="End Date" /></Form.Label>
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

        {/* Expenses Table */}
        <Card className="shadow-sm">
          <Card.Body>
            <h5><Translate textKey="expensesList" fallback="Expenses List" /></h5>
            {loading ? (
              <div className="text-center py-4">
                <Spinner animation="border" />
                <p className="mt-2"><Translate textKey="loading" fallback="Loading..." /></p>
              </div>
            ) : filteredExpenses.length > 0 ? (
              <div className="table-responsive">
                <Table hover className="expense-table">
                  <thead>
                    <tr>
                      <th><Translate textKey="date" fallback="Date" /></th>
                      <th><Translate textKey="category" fallback="Category" /></th>
                      <th><Translate textKey="description" fallback="Description" /></th>
                      <th><Translate textKey="amount" fallback="Amount" /></th>
                      <th><Translate textKey="actions" fallback="Actions" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExpenses.map(expense => (
                      <tr key={expense.id}>
                        <td>{formatDisplayDate(expense.expenseDate)}</td>
                        <td>{getCategoryName(expense.categoryId)}</td>
                        <td>
                          <div>{expense.description}</div>
                          {expense.notes && (
                            <small className="text-muted">{expense.notes}</small>
                          )}
                        </td>
                        <td className="text-end">{formatCurrency(expense.amount)}</td>
                        <td>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-1"
                            onClick={() => navigate(`/edit-expense/${expense.id}`)}
                          >
                            <Translate textKey="edit" fallback="Edit" />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDeleteClick(expense)}
                          >
                            <Translate textKey="delete" fallback="Delete" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <Alert variant="info">
                <Translate textKey="noExpensesFound" fallback="No expenses found matching your filters." />
              </Alert>
            )}
          </Card.Body>
        </Card>
      </Container>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title><Translate textKey="confirmDelete" fallback="Confirm Delete" /></Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Translate
            textKey="confirmDeleteExpenseMessage"
            fallback="Are you sure you want to delete this expense? This action cannot be undone."
          />
          {expenseToDelete && (
            <div className="mt-3">
              <p><strong><Translate textKey="description" fallback="Description" />:</strong> {expenseToDelete.description}</p>
              <p><strong><Translate textKey="amount" fallback="Amount" />:</strong> {formatCurrency(expenseToDelete.amount)}</p>
              <p><strong><Translate textKey="date" fallback="Date" />:</strong> {formatDisplayDate(expenseToDelete.expenseDate)}</p>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            <Translate textKey="cancel" fallback="Cancel" />
          </Button>
          <Button variant="danger" onClick={confirmDelete}>
            <Translate textKey="delete" fallback="Delete" />
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

export default Expenses;