import React, { useState, useEffect } from 'react';
import { Navbar, Nav, Container, Button, Offcanvas, Collapse, Form, InputGroup, Modal, Dropdown } from 'react-bootstrap';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import LanguageToggle from './LanguageToggle';
import Translate from './Translate';
import '../styles/sidebar.css';

const MainNavbar = () => {
  const {
    currentUser,
    logout,
    shopData,
    staffData,
    isStaff,
    isGuest,
    branches,
    activeBranchId,
    primaryShopId,
    selectBranch,
    addBranch,
    deleteBranch
  } = useAuth();
  const { language } = useLanguage();
  const { theme, setTheme, themeOptions } = useTheme();
  const navigate = useNavigate();
  const [showSidebar, setShowSidebar] = useState(false);
  const location = useLocation();
  const [newBranchName, setNewBranchName] = useState('');
  const [branchError, setBranchError] = useState('');
  const [addingBranch, setAddingBranch] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [deletingBranch, setDeletingBranch] = useState(false);

  // Check if we're on an expenses page to auto-open the menu
  const isExpensesPage = location.pathname === '/expenses' || location.pathname === '/add-expense' || location.pathname === '/expense-categories';
  const [expensesOpen, setExpensesOpen] = useState(isExpensesPage);
  const [expensesOpenMobile, setExpensesOpenMobile] = useState(isExpensesPage);

  // Check if we're on an attendance page to auto-open the menu
  const isAttendancePage = location.pathname === '/attendance' || location.pathname === '/mark-attendance' || location.pathname === '/attendance-report';
  const [attendanceOpen, setAttendanceOpen] = useState(isAttendancePage);
  const [attendanceOpenMobile, setAttendanceOpenMobile] = useState(isAttendancePage);

  // Check if we're on an employees page to auto-open the menu
  const isEmployeesPage = location.pathname === '/employees' || location.pathname === '/add-employee';
  const [employeesOpen, setEmployeesOpen] = useState(isEmployeesPage);
  const [employeesOpenMobile, setEmployeesOpenMobile] = useState(isEmployeesPage);

  // Check if we're on a contacts page to auto-open the menu
  const isContactsPage = location.pathname === '/customer-information' || location.pathname === '/supplier-information';
  const [contactsOpen, setContactsOpen] = useState(isContactsPage);
  const [contactsOpenMobile, setContactsOpenMobile] = useState(isContactsPage);

  // Check if we're on a ledger page to auto-open the menu
  const isLedgerPage = location.pathname === '/ledger-accounts' || location.pathname === '/ledger-entries' || location.pathname === '/add-ledger-entry' || location.pathname === '/daily-closing' || location.pathname === '/accounting-reports' || location.pathname.startsWith('/edit-ledger-entry');
  const [ledgerOpen, setLedgerOpen] = useState(isLedgerPage);
  const [ledgerOpenMobile, setLedgerOpenMobile] = useState(isLedgerPage);

  // Auto-open expenses menu when on expenses pages
  useEffect(() => {
    if (isExpensesPage) {
      setExpensesOpen(true);
      setExpensesOpenMobile(true);
    }
  }, [isExpensesPage]);

  // Auto-open attendance menu when on attendance pages
  useEffect(() => {
    if (isAttendancePage) {
      setAttendanceOpen(true);
      setAttendanceOpenMobile(true);
    }
  }, [isAttendancePage]);

  // Auto-open employees menu when on employees pages
  useEffect(() => {
    if (isEmployeesPage) {
      setEmployeesOpen(true);
      setEmployeesOpenMobile(true);
    }
  }, [isEmployeesPage]);

  // Auto-open contacts menu when on contacts pages
  useEffect(() => {
    if (isContactsPage) {
      setContactsOpen(true);
      setContactsOpenMobile(true);
    }
  }, [isContactsPage]);

  // Auto-open ledger menu when on ledger pages
  useEffect(() => {
    if (isLedgerPage) {
      setLedgerOpen(true);
      setLedgerOpenMobile(true);
    }
  }, [isLedgerPage]);

  const handleLogout = () => {
    logout()
      .then(() => {
        navigate('/login');
      })
      .catch(error => {
        console.error('Failed to log out', error);
      });
  };

  // Helper function to check if staff has permission
  const hasPermission = (permission) => {
    if (!isStaff || !staffData) return true; // Shop owners have all permissions
    return staffData.permissions && staffData.permissions[permission];
  };
  const isActive = (path) => location.pathname === path;

  const userDisplayName = staffData?.name || shopData?.ownerName || currentUser?.displayName || currentUser?.email || 'User';
  let userRoleLabel = 'Super Admin';
  if (isGuest) {
    userRoleLabel = 'Guest User';
  } else if (isStaff) {
    userRoleLabel = staffData?.role || 'Staff Member';
  }

  const defaultGoogleIconStyle = {
    background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
    color: '#ffffff'
  };

  const googleIconPalette = {
    dashboard: {
      background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
      color: '#ffffff'
    },
    point_of_sale: {
      background: 'linear-gradient(135deg, #EA4335 0%, #FBBC05 100%)',
      color: '#ffffff'
    },
    receipt_long: {
      background: 'linear-gradient(135deg, #34A853 0%, #0F9D58 100%)',
      color: '#ffffff'
    },
    query_stats: {
      background: 'linear-gradient(135deg, #A142F4 0%, #4285F4 100%)',
      color: '#ffffff'
    },
    inventory_2: {
      background: 'linear-gradient(135deg, #F2994A 0%, #F2C94C 100%)',
      color: '#0b1f4e'
    },
    groups: {
      background: 'linear-gradient(135deg, #34A853 0%, #B8E986 100%)',
      color: '#0b1f4e'
    },
    group_add: {
      background: 'linear-gradient(135deg, #1B74E4 0%, #54C6FF 100%)',
      color: '#ffffff'
    },
    payments: {
      background: 'linear-gradient(135deg, #FBBC05 0%, #FEEA84 100%)',
      color: '#0b1f4e'
    },
    add_card: {
      background: 'linear-gradient(135deg, #EA4335 0%, #FF8A65 100%)',
      color: '#ffffff'
    },
    category: {
      background: 'linear-gradient(135deg, #8E2DE2 0%, #4A00E0 100%)',
      color: '#ffffff'
    },
    event_available: {
      background: 'linear-gradient(135deg, #34A853 0%, #0F9D58 100%)',
      color: '#ffffff'
    },
    how_to_reg: {
      background: 'linear-gradient(135deg, #0F9D58 0%, #4285F4 100%)',
      color: '#ffffff'
    },
    assignment: {
      background: 'linear-gradient(135deg, #4285F4 0%, #34A853 100%)',
      color: '#ffffff'
    },
    settings: {
      background: 'linear-gradient(135deg, #5C6BC0 0%, #1A237E 100%)',
      color: '#ffffff'
    },
    admin_panel_settings: {
      background: 'linear-gradient(135deg, #F44336 0%, #E91E63 100%)',
      color: '#ffffff'
    },
    shopping_bag: {
      background: 'linear-gradient(135deg, #FF5F6D 0%, #FFC371 100%)',
      color: '#ffffff'
    },
    badge: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: '#ffffff'
    },
    contacts: {
      background: 'linear-gradient(135deg, #2196F3 0%, #21CBF3 100%)',
      color: '#ffffff'
    },
    account_balance: {
      background: 'linear-gradient(135deg, #9C27B0 0%, #673AB7 100%)',
      color: '#ffffff'
    }
  };

  const renderNavItem = (path, iconKey, label, closeSidebar = false) => {
    const iconStyle = googleIconPalette[iconKey] || defaultGoogleIconStyle;
    return (
      <Nav.Link
        as={Link}
        to={path}
        className={`sidebar-link ${isActive(path) ? 'active' : ''}`}
        onClick={() => {
          if (closeSidebar) {
            setShowSidebar(false);
          }
        }}
      >
        <span className="sidebar-icon" style={iconStyle}>
          <span className="material-icons-outlined google-icon">{iconKey}</span>
        </span>
        <span className="sidebar-text">{label}</span>
      </Nav.Link>
    );
  };

  const renderSubNavItem = (path, label, closeSidebar = false, indent = true) => {
    return (
      <Nav.Link
        as={Link}
        to={path}
        className={`sidebar-link ${isActive(path) ? 'active' : ''} ${indent ? 'sidebar-sub-item' : ''}`}
        onClick={() => {
          if (closeSidebar) {
            setShowSidebar(false);
          }
        }}
      >
        <span className="sidebar-text">{label}</span>
      </Nav.Link>
    );
  };

  const renderExpensesMenu = (closeSidebar = false, isMobile = false) => {
    const isOpen = isMobile ? expensesOpenMobile : expensesOpen;
    const setIsOpen = isMobile ? setExpensesOpenMobile : setExpensesOpen;
    const iconStyle = googleIconPalette['payments'] || defaultGoogleIconStyle;
    const isExpensesActive = isActive('/expenses') || isActive('/add-expense') || isActive('/expense-categories');

    return (
      <>
        <div
          className={`sidebar-link ${isExpensesActive ? 'active' : ''}`}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="sidebar-icon" style={iconStyle}>
            <span className="material-icons-outlined google-icon">payments</span>
          </span>
          <span className="sidebar-text"><Translate textKey="expenses" fallback="Expenses" /></span>
          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} ms-auto`} style={{ fontSize: '0.8rem' }}></i>
        </div>
        <Collapse in={isOpen}>
          <div className="sidebar-submenu">
            {!isStaff && (
              renderSubNavItem('/add-expense', <Translate textKey="addExpense" fallback="Add Expense" />, closeSidebar)
            )}
            {renderSubNavItem('/expenses', <Translate textKey="viewExpenses" fallback="View Expenses" />, closeSidebar)}
            {!isStaff && (
              renderSubNavItem('/expense-categories', <Translate textKey="expenseCategories" fallback="Expense Categories" />, closeSidebar)
            )}
          </div>
        </Collapse>
      </>
    );
  };

  const renderAttendanceMenu = (closeSidebar = false, isMobile = false) => {
    const isOpen = isMobile ? attendanceOpenMobile : attendanceOpen;
    const setIsOpen = isMobile ? setAttendanceOpenMobile : setAttendanceOpen;
    const iconStyle = googleIconPalette['event_available'] || defaultGoogleIconStyle;
    const isAttendanceActive = isActive('/attendance') || isActive('/mark-attendance') || isActive('/attendance-report');

    return (
      <>
        <div
          className={`sidebar-link ${isAttendanceActive ? 'active' : ''}`}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="sidebar-icon" style={iconStyle}>
            <span className="material-icons-outlined google-icon">event_available</span>
          </span>
          <span className="sidebar-text"><Translate textKey="attendance" fallback="Attendance" /></span>
          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} ms-auto`} style={{ fontSize: '0.8rem' }}></i>
        </div>
        <Collapse in={isOpen}>
          <div className="sidebar-submenu">
            {renderSubNavItem('/attendance', <Translate textKey="viewAttendance" />, closeSidebar)}
            {renderSubNavItem('/mark-attendance', <Translate textKey="markAttendance" />, closeSidebar)}
            {!isStaff && (
              renderSubNavItem('/attendance-report', <Translate textKey="attendanceReport" />, closeSidebar)
            )}
          </div>
        </Collapse>
      </>
    );
  };

  const renderEmployeesMenu = (closeSidebar = false, isMobile = false) => {
    const isOpen = isMobile ? employeesOpenMobile : employeesOpen;
    const setIsOpen = isMobile ? setEmployeesOpenMobile : setEmployeesOpen;
    const iconStyle = googleIconPalette['groups'] || defaultGoogleIconStyle;
    const isEmployeesActive = isActive('/employees') || isActive('/add-employee');

    return (
      <>
        <div
          className={`sidebar-link ${isEmployeesActive ? 'active' : ''}`}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="sidebar-icon" style={iconStyle}>
            <span className="material-icons-outlined google-icon">groups</span>
          </span>
          <span className="sidebar-text"><Translate textKey="employees" fallback="Employees" /></span>
          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} ms-auto`} style={{ fontSize: '0.8rem' }}></i>
        </div>
        <Collapse in={isOpen}>
          <div className="sidebar-submenu">
            {renderSubNavItem('/employees', <Translate textKey="viewEmployees" />, closeSidebar)}
            {!isStaff && (
              renderSubNavItem('/add-employee', <Translate textKey="addEmployee" />, closeSidebar)
            )}
          </div>
        </Collapse>
      </>
    );
  };

  const renderContactsMenu = (closeSidebar = false, isMobile = false) => {
    const isOpen = isMobile ? contactsOpenMobile : contactsOpen;
    const setIsOpen = isMobile ? setContactsOpenMobile : setContactsOpen;
    const iconStyle = googleIconPalette['contacts'] || defaultGoogleIconStyle;
    const isContactsActive = isActive('/customer-information') || isActive('/supplier-information');

    return (
      <>
        <div
          className={`sidebar-link ${isContactsActive ? 'active' : ''}`}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="sidebar-icon" style={iconStyle}>
            <span className="material-icons-outlined google-icon">contacts</span>
          </span>
          <span className="sidebar-text"><Translate textKey="contacts" fallback="Contacts" /></span>
          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} ms-auto`} style={{ fontSize: '0.8rem' }}></i>
        </div>
        <Collapse in={isOpen}>
          <div className="sidebar-submenu">
            {renderSubNavItem('/customer-information', <Translate textKey="customerInformation" fallback="Customer Information" />, closeSidebar)}
            {renderSubNavItem('/supplier-information', <Translate textKey="supplierInformation" fallback="Supplier Information" />, closeSidebar)}
          </div>
        </Collapse>
      </>
    );
  };

  const renderLedgerMenu = (closeSidebar = false, isMobile = false) => {
    const isOpen = isMobile ? ledgerOpenMobile : ledgerOpen;
    const setIsOpen = isMobile ? setLedgerOpenMobile : setLedgerOpen;
    const iconStyle = googleIconPalette['account_balance'] || defaultGoogleIconStyle;
    const isLedgerActive = isActive('/ledger-accounts') || isActive('/ledger-entries') || isActive('/add-ledger-entry') || isActive('/daily-closing') || isActive('/accounting-reports') || location.pathname.startsWith('/edit-ledger-entry');

    return (
      <>
        <div
          className={`sidebar-link ${isLedgerActive ? 'active' : ''}`}
          style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className="sidebar-icon" style={iconStyle}>
            <span className="material-icons-outlined google-icon">account_balance</span>
          </span>
          <span className="sidebar-text"><Translate textKey="ledger" fallback="Ledger" /></span>
          <i className={`bi ${isOpen ? 'bi-chevron-down' : 'bi-chevron-right'} ms-auto`} style={{ fontSize: '0.8rem' }}></i>
        </div>
        <Collapse in={isOpen}>
          <div className="sidebar-submenu">
            {renderSubNavItem('/ledger-accounts', <Translate textKey="ledgerAccounts" fallback="Accounts" />, closeSidebar)}
            {renderSubNavItem('/ledger-entries', <Translate textKey="ledgerEntries" fallback="Entries" />, closeSidebar)}
            {renderSubNavItem('/daily-closing', <Translate textKey="dailyClosing" fallback="Daily Closing" />, closeSidebar)}
            {renderSubNavItem('/accounting-reports', <Translate textKey="reports" fallback="Reports" />, closeSidebar)}
            {!isStaff && (
              renderSubNavItem('/add-ledger-entry', <Translate textKey="add" fallback="Add Entry" />, closeSidebar)
            )}
          </div>
        </Collapse>
      </>
    );
  };

  const handleAddBranch = async (e) => {
    e.preventDefault();
    setBranchError('');
    if (!newBranchName.trim()) return;

    try {
      setAddingBranch(true);
      await addBranch(newBranchName.trim());
      setNewBranchName('');
    } catch (error) {
      setBranchError(error.message || 'Failed to add branch');
    } finally {
      setAddingBranch(false);
    }
  };

  const handleDeleteClick = (branch) => {
    setBranchToDelete(branch);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!branchToDelete) return;

    try {
      setDeletingBranch(true);
      setBranchError('');
      await deleteBranch(branchToDelete.id);
      setShowDeleteModal(false);
      setBranchToDelete(null);
    } catch (error) {
      setBranchError(error.message || 'Failed to delete branch');
    } finally {
      setDeletingBranch(false);
    }
  };

  const renderBranchManager = (closeSidebar = false) => (
    <>
      <div className="sidebar-branch-manager mb-3">
        <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap">
          <div className="sidebar-branch-title">
            <i className="bi bi-diagram-3 me-2"></i>
            Branch
          </div>
          <span className="text-muted small ms-auto ms-md-0">{branches?.length || 0} total</span>
        </div>
        <Form.Select
          size="sm"
          value={activeBranchId || ''}
          onChange={(e) => {
            selectBranch(e.target.value);
            if (closeSidebar) setShowSidebar(false);
          }}
        >
          {(branches || []).length === 0 ? (
            <option value="">No branches</option>
          ) : (
            (branches || []).map(branch => (
              <option key={branch.id} value={branch.id}>
                {branch.name || 'Unnamed branch'}
              </option>
            ))
          )}
        </Form.Select>
        {!isStaff && !isGuest && (
          <div className="mt-3 px-1">
            <small className="text-muted fw-bold d-block mb-2">THEME</small>
            <div className="theme-grid">
              {themeOptions.map((opt) => (
                <div
                  key={opt.id}
                  className={`theme-swatch ${theme === opt.id ? 'active' : ''}`}
                  style={{ backgroundColor: opt.color }}
                  onClick={() => setTheme(opt.id)}
                  title={opt.name}
                />
              ))}
            </div>
          </div>
        )}

        {!isStaff && !isGuest && (branches || []).length > 0 && (
          <div className="mt-2">
            {(branches || []).map(branch => {
              const isMainBranch = branch.id === primaryShopId;
              const isActive = branch.id === activeBranchId;
              return (
                <div
                  key={branch.id}
                  className={`d-flex justify-content-between align-items-center mb-1 p-1 rounded ${isActive ? 'bg-light' : ''}`}
                  style={{ fontSize: '0.85rem' }}
                >
                  <span className="text-truncate flex-grow-1 me-2" style={{ maxWidth: '70%', minWidth: 0 }}>
                    {branch.name || 'Unnamed branch'}
                    {isMainBranch && <span className="text-muted ms-1">(Main)</span>}
                  </span>
                  {!isMainBranch && (
                    <Button
                      variant="link"
                      size="sm"
                      className="text-danger p-0 flex-shrink-0"
                      style={{ fontSize: '0.75rem', minWidth: '32px', minHeight: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onClick={() => handleDeleteClick(branch)}
                      title="Delete branch"
                    >
                      <i className="bi bi-trash"></i>
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {!isStaff && !isGuest && (
          <Form onSubmit={handleAddBranch} className="mt-2">
            <InputGroup size="sm" className="flex-nowrap">
              <Form.Control
                type="text"
                placeholder="New branch name"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="flex-grow-1"
                style={{ minWidth: 0 }}
              />
              <Button
                type="submit"
                variant="primary"
                disabled={addingBranch || !newBranchName.trim()}
                className="flex-shrink-0"
              >
                {addingBranch ? 'Adding...' : 'Add'}
              </Button>
            </InputGroup>
          </Form>
        )}
        {branchError && <div className="text-danger small mt-1">{branchError}</div>}
      </div>
      <Modal show={showDeleteModal} onHide={() => {
        setShowDeleteModal(false);
        setBranchToDelete(null);
        setBranchError('');
      }} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Branch</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {branchError && <div className="alert alert-danger mb-2">{branchError}</div>}
          <p>Are you sure you want to delete the branch <strong>"{branchToDelete?.name || 'Unnamed branch'}"</strong>?</p>
          <p className="text-muted small mb-0">This action cannot be undone. All data associated with this branch will remain, but you won't be able to access it through this branch.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteModal(false);
              setBranchToDelete(null);
              setBranchError('');
            }}
            disabled={deletingBranch}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirmDelete}
            disabled={deletingBranch}
          >
            {deletingBranch ? 'Deleting...' : 'Delete Branch'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );

  return (
    <>
      {/* Mobile Top Bar with Menu Button */}
      <Navbar bg="primary" variant="dark" className="mobile-top-navbar d-lg-none">
        <Container fluid className="mobile-top-navbar__container">
          <Navbar.Brand
            as={Link}
            to={currentUser ? '/dashboard' : '/login'}
            className="mobile-top-navbar__brand"
            title={shopData ? shopData.shopName : 'Shop Billing System'}
          >
            <span className="mobile-top-navbar__shop">
              {shopData ? shopData.shopName : 'Shop Billing System'}
            </span>
            {currentUser && (
              <span className="mobile-top-navbar__meta">
                {userRoleLabel}
              </span>
            )}
          </Navbar.Brand>
          <div className="mobile-top-navbar__actions">
            {!isStaff && !isGuest && (
              <Dropdown align="end" className="me-2">
                <Dropdown.Toggle variant="light" className="theme-toggle-btn border-0 p-1 bg-transparent">
                  <i className="bi bi-palette text-white fs-5"></i>
                </Dropdown.Toggle>
                <Dropdown.Menu className="theme-dropdown-menu">
                  <Dropdown.Header>Select Theme</Dropdown.Header>
                  <div className="theme-grid">
                    {themeOptions.map((opt) => (
                      <div
                        key={opt.id}
                        className={`theme-swatch ${theme === opt.id ? 'active' : ''}`}
                        style={{ backgroundColor: opt.color }}
                        onClick={() => setTheme(opt.id)}
                        title={opt.name}
                      />
                    ))}
                  </div>
                </Dropdown.Menu>
              </Dropdown>
            )}
            {currentUser && (
              <LanguageToggle
                isCompact
                variant="outline-light"
                className="mobile-top-navbar__lang"
                aria-label="Toggle language"
              />
            )}
            <Button
              variant="light"
              className="mobile-top-navbar__menu"
              onClick={() => setShowSidebar(true)}
              aria-label="Open menu"
            >
              <i className="bi bi-list"></i>
            </Button>
          </div>
        </Container>
      </Navbar>

      {/* Mobile Offcanvas Sidebar */}
      <Offcanvas show={showSidebar} onHide={() => setShowSidebar(false)} placement="start" className="app-mobile-sidebar">
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>
            {shopData ? shopData.shopName : 'Shop Billing System'}
          </Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {currentUser && (
            <div className="sidebar-user-card mb-4">
              <div className="sidebar-user-icon">
                <i className="bi bi-person-fill"></i>
              </div>
              <div>
                <div className="sidebar-user-name">{userDisplayName}</div>
                <div className="sidebar-user-role">{userRoleLabel}</div>
              </div>
            </div>
          )}
          {currentUser && renderBranchManager(true)}
          <Nav className="flex-column sidebar-nav">
            {currentUser ? (
              <>
                {renderNavItem('/dashboard', 'dashboard', <Translate textKey="dashboard" />, true)}
                {hasPermission('canCreateReceipts') && (
                  renderNavItem('/new-receipt', 'point_of_sale', <Translate textKey="newReceipt" />, true)
                )}
                {hasPermission('canViewReceipts') && (
                  renderNavItem('/receipts', 'receipt_long', <Translate textKey="receipts" />, true)
                )}
                {hasPermission('canViewAnalytics') && (
                  renderNavItem('/sales-analytics', 'query_stats', <Translate textKey="salesAnalytics" fallback="Profit and Loss" />, true)
                )}
                {hasPermission('canViewStock') && (
                  <>
                    {renderNavItem('/stock', 'inventory_2', <Translate textKey="inventory" />, true)}
                    {renderNavItem('/purchase-management', 'shopping_bag', <Translate textKey="purchaseManagement" fallback="Purchase Management" />, true)}
                  </>
                )}
                {hasPermission('canViewEmployees') && (
                  renderEmployeesMenu(true, true)
                )}
                {hasPermission('canManageExpenses') && (
                  renderExpensesMenu(true, true)
                )}
                {hasPermission('canMarkAttendance') && (
                  renderAttendanceMenu(true, true)
                )}
                {renderContactsMenu(true, true)}
                {renderLedgerMenu(true, true)}
                {!isStaff && !isGuest && (
                  renderNavItem('/settings', 'settings', <Translate textKey="settings" />, true)
                )}
                {!isStaff && !isGuest && (
                  renderNavItem('/manage-passwords', 'lock_reset', <Translate textKey="managePasswords" fallback="Manage Passwords" />, true)
                )}
                {!isStaff && !isGuest && (
                  renderNavItem('/shop-profile', 'badge', <Translate textKey="shopProfile" fallback="Shop Profile" />, true)
                )}
                {!isStaff && !isGuest && (
                  renderNavItem('/staff-management', 'admin_panel_settings', <Translate textKey="staffManagement" fallback="Staff Management" />, true)
                )}
                <div className="d-flex mt-3">
                  <LanguageToggle />
                  <Button
                    variant="outline-danger"
                    className="ms-2"
                    onClick={() => { handleLogout(); setShowSidebar(false); }}
                  >
                    <Translate textKey="logout" />
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Nav.Link as={Link} to="/login" onClick={() => setShowSidebar(false)}><Translate textKey="login" /></Nav.Link>
                <Nav.Link as={Link} to="/register" onClick={() => setShowSidebar(false)}><Translate textKey="register" /></Nav.Link>
                <LanguageToggle />
              </>
            )}
          </Nav>
        </Offcanvas.Body>
      </Offcanvas>

      {/* Desktop fixed sidebar */}
      <div className="app-sidebar d-none d-lg-block">
        <div className="sidebar-top">
          <Link to="/dashboard" className="sidebar-logo text-decoration-none">
            {shopData ? shopData.shopName : 'Shop Billing System'}
          </Link>
          {currentUser && (
            <div className="sidebar-user-meta">
              <div className="sidebar-user-name">{userDisplayName}</div>
              <div className="sidebar-user-role">{userRoleLabel}</div>
            </div>
          )}
        </div>
        {currentUser && renderBranchManager(false)}
        <Nav className="flex-column sidebar-nav">
          {currentUser && (
            <>
              {renderNavItem('/dashboard', 'dashboard', <Translate textKey="dashboard" />)}
              {hasPermission('canCreateReceipts') && (
                renderNavItem('/new-receipt', 'point_of_sale', <Translate textKey="newReceipt" />)
              )}
              {hasPermission('canViewReceipts') && (
                renderNavItem('/receipts', 'receipt_long', <Translate textKey="receipts" />)
              )}
              {hasPermission('canViewAnalytics') && (
                renderNavItem('/sales-analytics', 'query_stats', <Translate textKey="salesAnalytics" fallback="Profit and Loss" />)
              )}
              {hasPermission('canViewStock') && (
                <>
                  {renderNavItem('/stock', 'inventory_2', <Translate textKey="inventory" />)}
                  {renderNavItem('/purchase-management', 'shopping_bag', <Translate textKey="purchaseManagement" fallback="Purchase Management" />)}
                </>
              )}
              {hasPermission('canViewEmployees') && (
                renderEmployeesMenu(false, false)
              )}
              {hasPermission('canManageExpenses') && (
                renderExpensesMenu(false, false)
              )}
              {hasPermission('canMarkAttendance') && (
                renderAttendanceMenu(false, false)
              )}
              {renderContactsMenu(false, false)}
              {renderLedgerMenu(false, false)}
              {!isStaff && !isGuest && (
                renderNavItem('/settings', 'settings', <Translate textKey="settings" />)
              )}
              {!isStaff && !isGuest && (
                renderNavItem('/manage-passwords', 'lock_reset', <Translate textKey="managePasswords" fallback="Manage Passwords" />)
              )}
              {!isStaff && !isGuest && (
                renderNavItem('/shop-profile', 'badge', <Translate textKey="shopProfile" fallback="Shop Profile" />)
              )}
              {!isStaff && !isGuest && (
                renderNavItem('/staff-management', 'admin_panel_settings', <Translate textKey="staffManagement" fallback="Staff Management" />)
              )}
            </>
          )}
        </Nav>
        <div className="sidebar-footer">
          {currentUser ? (
            <>
              <LanguageToggle />
              <Button variant="outline-danger" className="ms-2" onClick={handleLogout}>
                <Translate textKey="logout" />
              </Button>
            </>
          ) : (
            <>
              <Nav.Link as={Link} to="/login"><Translate textKey="login" /></Nav.Link>
              <Nav.Link as={Link} to="/register"><Translate textKey="register" /></Nav.Link>
              <LanguageToggle />
            </>
          )}
        </div>
      </div>

      {/* Spacer so page content doesn't slide under the fixed sidebar on desktop */}
      <div className="d-none d-lg-block" style={{ width: '280px' }} />
    </>
  );
};

export default MainNavbar;