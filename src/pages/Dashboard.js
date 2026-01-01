import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Stack, Spinner } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate } from '../utils';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import { getDailySalesAndProfit } from '../utils/salesUtils';
import { getLedgerStatistics } from '../utils/ledgerUtils';
import { getExpensesByDateRange } from '../utils/expenseUtils';

const Dashboard = () => {
  const { currentUser, shopData, isStaff, staffData, activeShopId } = useAuth();
  const [receiptCount, setReceiptCount] = useState(0);
  const [recentReceipts, setRecentReceipts] = useState([]);
  const [employeeCount, setEmployeeCount] = useState(0);
  const [todayAttendance, setTodayAttendance] = useState({ present: 0, absent: 0, total: 0 });
  const [todaySales, setTodaySales] = useState(null);
  const [purchaseDue, setPurchaseDue] = useState(0);
  const [salesDue, setSalesDue] = useState(0);
  const [todayExpenseTotal, setTodayExpenseTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [salesLoading, setSalesLoading] = useState(true);
  const navigate = useNavigate();

  // Use data directly for now
  const translatedShopData = shopData;
  const translatedReceipts = recentReceipts;
  const translatedAttendance = todayAttendance;
  const staffPermissionCount = staffData?.permissions
    ? Object.values(staffData.permissions).filter(Boolean).length
    : 0;

  // Fetch daily sales and profit data
  useEffect(() => {
    if (!currentUser || !activeShopId) return;

    setSalesLoading(true);

    // Adding error handling and more informative console messages
    getDailySalesAndProfit(activeShopId)
      .then(data => {
        setTodaySales(data);
      })
      .catch(error => {
        // Log error but don't show to user to avoid cluttering the UI
        console.error("Error fetching daily sales data:", error.message || error);
      })
      .finally(() => {
        setSalesLoading(false);
      });

    // Fetch Ledger and Expense Data
    const fetchAdditionalData = async () => {
      try {
        // Fetch Ledger Stats for Dues
        const lStats = await getLedgerStatistics(activeShopId);
        if (lStats && lStats.totalsByType) {
          // Purchase Due is Liability (Accounts Payable)
          setPurchaseDue(lStats.totalsByType.Liability || 0);

          // Sales Due is specific Asset (Accounts Receivable)
          const receivableAcc = lStats.accountsByType.Asset.find(a =>
            a.accountName === 'Accounts Receivable' || a.accountName === 'Receivables'
          );
          if (receivableAcc) {
            setSalesDue(lStats.accountBalances[receivableAcc.id] || 0);
          }
        }

        // Fetch Today's Expenses
        const today = new Date().toISOString().split('T')[0];
        const expenses = await getExpensesByDateRange(activeShopId, today, today);
        const total = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
        setTodayExpenseTotal(total);
      } catch (error) {
        console.error("Error fetching dashboard additional data:", error);
      }
    };

    fetchAdditionalData();
  }, [currentUser, activeShopId]);

  useEffect(() => {
    // Convert to non-async function
    const fetchDashboardData = () => {
      if (!currentUser || !activeShopId) return;

      try {
        // Create a simple query without ordering
        const receiptRef = collection(db, 'receipts');
        const receiptQuery = query(
          receiptRef,
          where("shopId", "==", activeShopId)
        );

        getDocs(receiptQuery)
          .then(receiptSnapshot => {
            // Set the count
            setReceiptCount(receiptSnapshot.size);

            // Get all receipts and sort them client-side
            const receipts = receiptSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));

            // Sort receipts by timestamp
            receipts.sort((a, b) => {
              return new Date(b.timestamp) - new Date(a.timestamp);
            });

            // Get just the first 5
            setRecentReceipts(receipts.slice(0, 5));
          })
          .catch(error => {
            console.error("Error fetching dashboard data:", error);
          });

        // Fetch employee count
        const employeesRef = collection(db, 'employees');
        const employeesQuery = query(
          employeesRef,
          where("shopId", "==", activeShopId)
        );

        getDocs(employeesQuery)
          .then(employeeSnapshot => {
            setEmployeeCount(employeeSnapshot.size);

            // Fetch today's attendance
            const today = new Date().toISOString().split('T')[0];
            const attendanceRef = collection(db, 'attendance');
            const attendanceQuery = query(
              attendanceRef,
              where("shopId", "==", activeShopId),
              where("date", "==", today)
            );

            return getDocs(attendanceQuery);
          })
          .then(attendanceSnapshot => {
            const attendanceRecords = attendanceSnapshot.docs.map(doc => ({
              ...doc.data()
            }));

            const presentCount = attendanceRecords.filter(record =>
              record.status === 'present' || record.status === 'half-day'
            ).length;

            const absentCount = attendanceRecords.filter(record =>
              record.status === 'absent' || record.status === 'leave'
            ).length;

            setTodayAttendance({
              present: presentCount,
              absent: absentCount,
              total: attendanceRecords.length
            });
          })
          .catch(error => {
            console.error("Error fetching employee data:", error);
          })
          .finally(() => {
            setLoading(false);
          });
      } catch (error) {
        console.error("Error setting up queries:", error);
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [currentUser, activeShopId]);

  // Show staff-specific dashboard if user is staff
  if (isStaff && staffData) {
    return (
      <>
        <MainNavbar />
        <Container className="pos-content">
          <PageHeader
            title={<Translate textKey="staffDashboard" fallback="Staff Dashboard" />}
            icon="bi-person-badge"
            subtitle={
              <>
                <Translate textKey="welcomeBack" fallback="Welcome back" /> {staffData.name || currentUser?.email || ''}. <Translate textKey="accessSnapshot" fallback="Here's a snapshot of your access." />
              </>
            }
          >
            <div className="hero-metrics__item">
              <span className="hero-metrics__label"><Translate textKey="shop" fallback="Shop" /></span>
              <span className="hero-metrics__value">{shopData?.shopName || '—'}</span>
            </div>
            <div className="hero-metrics__item">
              <span className="hero-metrics__label"><Translate textKey="permissions" fallback="Permissions" /></span>
              <span className="hero-metrics__value">{staffPermissionCount}</span>
            </div>
            <div className="hero-metrics__item">
              <span className="hero-metrics__label"><Translate textKey="role" fallback="Role" /></span>
              <span className="hero-metrics__value">{staffData.role || <Translate textKey="teamMember" fallback="Team Member" />}</span>
            </div>
            <div className="hero-metrics__item">
              <span className="hero-metrics__label"><Translate textKey="attendance" fallback="Attendance" /></span>
              <span className="hero-metrics__value">
                {translatedAttendance.present}/{translatedAttendance.total}
              </span>
            </div>
          </PageHeader>
          <div className="page-header-actions">
            {staffData.permissions?.canCreateReceipts && (
              <Button variant="primary" onClick={() => navigate('/new-receipt')}>
                <i className="bi bi-plus-lg me-1"></i>
                <Translate textKey="newReceipt" />
              </Button>
            )}
            {staffData.permissions?.canViewReceipts && (
              <Button variant="outline-primary" onClick={() => navigate('/receipts')}>
                <Translate textKey="receipts" />
              </Button>
            )}
          </div>

          {shopData && (
            <Card className="pos-card dashboard-section slide-in-up">
              <Card.Body>
                <div className="pos-card__header">
                  <div>
                    <h5 className="mb-1 d-flex align-items-center gap-2">
                      <i className="bi bi-shop text-primary"></i>
                      {shopData.shopName}
                    </h5>
                    <p className="text-muted mb-0"><Translate textKey="storeOverviewRef" fallback="Store overview for your reference." /></p>
                  </div>
                  <span className="pos-badge"><Translate textKey="shopInfo" fallback="Shop Info" /></span>
                </div>
                <Row className="g-4">
                  <Col md={4}>
                    <div className="d-flex flex-column">
                      <span className="text-uppercase text-muted fw-semibold small"><Translate textKey="address" fallback="Address" /></span>
                      <span className="fw-semibold text-primary mt-1">{shopData.address || <Translate textKey="notSet" fallback="Not provided" />}</span>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="d-flex flex-column">
                      <span className="text-uppercase text-muted fw-semibold small"><Translate textKey="phone" fallback="Phone" /></span>
                      <span className="fw-semibold text-primary mt-1">
                        {Array.isArray(shopData.phoneNumbers) && shopData.phoneNumbers.length > 0
                          ? shopData.phoneNumbers.join(', ')
                          : shopData.phoneNumber || '-'}
                      </span>
                    </div>
                  </Col>
                  <Col md={4}>
                    <div className="d-flex flex-column">
                      <span className="text-uppercase text-muted fw-semibold small"><Translate textKey="reportingTo" fallback="Reporting To" /></span>
                      <span className="fw-semibold text-primary mt-1">{shopData.ownerName || shopData.shopName}</span>
                    </div>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          )}

          <Row className="g-4">
            <Col xs={12} md={6} lg={4}>
              <Card className="h-100 dashboard-card slide-in-up">
                <Card.Header className="d-flex align-items-center">
                  <i className="bi bi-receipt me-2"></i>
                  <span><Translate textKey="newReceipt" fallback="New Receipt" /></span>
                </Card.Header>
                <Card.Body className="d-flex flex-column">
                  <div className="text-center mb-4">
                    <div className="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                      <i className="bi bi-receipt text-primary fs-1"></i>
                    </div>
                    <h6 className="text-muted mb-3">
                      <Translate textKey="newReceiptDesc" fallback="Create new receipts for customers" />
                    </h6>
                  </div>
                  <div className="mt-auto">
                    <Button
                      variant="primary"
                      onClick={() => navigate('/new-receipt')}
                      className="w-100"
                    >
                      <i className="bi bi-plus me-1"></i>
                      <Translate textKey="createNewReceipt" fallback="Create Receipt" />
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {staffData.permissions?.canViewReceipts && (
              <Col xs={12} md={6} lg={4}>
                <Card className="h-100 dashboard-card slide-in-up">
                  <Card.Header className="d-flex align-items-center">
                    <i className="bi bi-list-ul me-2"></i>
                    <span><Translate textKey="receipts" fallback="View Receipts" /></span>
                  </Card.Header>
                  <Card.Body className="d-flex flex-column">
                    <div className="text-center mb-4">
                      <div className="bg-success bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                        <i className="bi bi-list-ul text-success fs-1"></i>
                      </div>
                      <h6 className="text-muted mb-3">
                        <Translate textKey="viewReceiptsDesc" fallback="View and manage existing receipts" />
                      </h6>
                    </div>
                    <div className="mt-auto">
                      <Button
                        variant="success"
                        onClick={() => navigate('/receipts')}
                        className="w-100"
                      >
                        <i className="bi bi-eye me-1"></i>
                        <Translate textKey="viewReceipts" fallback="View Receipts" />
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            )}

            {staffData.permissions?.canMarkAttendance && (
              <Col xs={12} md={6} lg={4}>
                <Card className="h-100 dashboard-card slide-in-up">
                  <Card.Header className="d-flex align-items-center">
                    <i className="bi bi-calendar-check me-2"></i>
                    <span><Translate textKey="markAttendance" fallback="Mark Attendance" /></span>
                  </Card.Header>
                  <Card.Body className="d-flex flex-column">
                    <div className="text-center mb-4">
                      <div className="bg-warning bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                        <i className="bi bi-calendar-check text-warning fs-1"></i>
                      </div>
                      <h6 className="text-muted mb-3">
                        <Translate textKey="markAttendanceDesc" fallback="Mark employee attendance" />
                      </h6>
                    </div>
                    <div className="mt-auto">
                      <Button
                        variant="warning"
                        onClick={() => navigate('/mark-attendance')}
                        className="w-100"
                      >
                        <i className="bi bi-check-circle me-1"></i>
                        <Translate textKey="markAttendance" fallback="Mark Attendance" />
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            )}
          </Row>
        </Container>
      </>
    );
  }

  return (
    <>
      <MainNavbar />
      <Container className="pos-content">
        <PageHeader
          title={<Translate textKey="storeDashboard" fallback="Store Dashboard" />}
          icon="bi-speedometer2"
          subtitle={
            <>
              <Translate textKey="storeDashboardSubtitle" fallback="Real-time monitoring and control for" /> {translatedShopData?.shopName || <Translate textKey="yourStore" fallback="your store" />}.
            </>
          }
        >
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="todaysSales" fallback="Today's Sales" /></span>
            <span className="hero-metrics__value">
              {salesLoading ? '—' : todaySales ? formatCurrency(todaySales.sales) : formatCurrency(0)}
            </span>
          </div>
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="receipts" fallback="Receipts" /></span>
            <span className="hero-metrics__value">{receiptCount}</span>
          </div>
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="teamMember" fallback="Team" /></span>
            <span className="hero-metrics__value">{employeeCount}</span>
          </div>
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="attendance" fallback="Attendance" /></span>
            <span className="hero-metrics__value">
              {translatedAttendance.present}/{translatedAttendance.total}
            </span>
          </div>
        </PageHeader>

        <div className="dashboard-stats-grid-v2">
          {/* Purchase Due - Purple */}
          <div className="stat-card-v2 stat-card-v2--purple slide-in-up" onClick={() => navigate('/ledger-accounts')}>
            <div className="stat-card-v2__value">
              {formatCurrency(purchaseDue).replace('RS', 'RS ')}
            </div>
            <div className="stat-card-v2__label">
              <Translate textKey="purchaseDue" fallback="Purchase Due" />
            </div>
            <i className="bi bi-box-seam stat-card-v2__icon"></i>
          </div>

          {/* Sales Due - Red */}
          <div className="stat-card-v2 stat-card-v2--red slide-in-up" style={{ animationDelay: '0.1s' }} onClick={() => navigate('/ledger-accounts')}>
            <div className="stat-card-v2__value">
              {formatCurrency(salesDue).replace('RS', 'RS ')}
            </div>
            <div className="stat-card-v2__label">
              <Translate textKey="salesDue" fallback="Sales Due" />
            </div>
            <i className="bi bi-calendar3 stat-card-v2__icon"></i>
          </div>

          {/* Sales - Green */}
          <div className="stat-card-v2 stat-card-v2--green slide-in-up" style={{ animationDelay: '0.2s' }} onClick={() => navigate('/sales-analytics')}>
            <div className="stat-card-v2__value">
              {salesLoading ? '—' : todaySales ? formatCurrency(todaySales.sales).replace('RS', 'RS ') : formatCurrency(0).replace('RS', 'RS ')}
            </div>
            <div className="stat-card-v2__label">
              <Translate textKey="sales" fallback="Sales" />
            </div>
            <i className="bi bi-file-earmark-text stat-card-v2__icon"></i>
          </div>

          {/* Expense - Blue */}
          <div className="stat-card-v2 stat-card-v2--blue slide-in-up" style={{ animationDelay: '0.3s' }} onClick={() => navigate('/expenses')}>
            <div className="stat-card-v2__value">
              {formatCurrency(todayExpenseTotal).replace('RS', 'RS ')}
            </div>
            <div className="stat-card-v2__label">
              <Translate textKey="expense" fallback="Expense" />
            </div>
            <i className="bi bi-wallet2 stat-card-v2__icon"></i>
          </div>
        </div>

        {shopData && (
          <Card className="pos-card dashboard-section slide-in-up">
            <Card.Body>
              <div className="pos-card__header">
                <div>
                  <h5 className="mb-1 d-flex align-items-center gap-2">
                    <i className="bi bi-shop text-primary"></i>
                    {translatedShopData.shopName}
                  </h5>
                  <p className="text-muted mb-0"><Translate textKey="storeOverviewDesc" fallback="Centralized overview for your store profile." /></p>
                </div>
                <span className="pos-badge"><Translate textKey="storeOverview" fallback="Store Overview" /></span>
              </div>
              <Row className="g-4">
                <Col md={4}>
                  <div className="d-flex flex-column">
                    <span className="text-uppercase text-muted fw-semibold small"><Translate textKey="address" fallback="Address" /></span>
                    <span className="fw-semibold text-primary mt-1">{translatedShopData.address || <Translate textKey="notSet" fallback="Not set" />}</span>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="d-flex flex-column">
                    <span className="text-uppercase text-muted fw-semibold small"><Translate textKey="phone" fallback="Phone" /></span>
                    <span className="fw-semibold text-primary mt-1">{translatedShopData.phoneNumber || '-'}</span>
                  </div>
                </Col>
                <Col md={4}>
                  <div className="d-flex flex-column">
                    <span className="text-uppercase text-muted fw-semibold small"><Translate textKey="owner" fallback="Owner" /></span>
                    <span className="fw-semibold text-primary mt-1">{currentUser?.email}</span>
                  </div>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        )}

        <Card className="pos-card dashboard-section slide-in-up">
          <Card.Body>
            <div className="pos-card__header">
              <div>
                <h5 className="mb-1 d-flex align-items-center gap-2">
                  <i className="bi bi-graph-up-arrow text-primary"></i>
                  <Translate textKey="todaysPerformance" fallback="Today's Performance" />
                </h5>
                <p className="text-muted mb-0"><Translate textKey="todaysPerformanceDesc" fallback="Sales, profit and activity for the current day." /></p>
              </div>
              <Button variant="primary" size="sm" onClick={() => navigate('/sales-analytics')}>
                <Translate textKey="viewAnalytics" fallback="View Analytics" />
              </Button>
            </div>
            {salesLoading ? (
              <div className="text-center py-4">
                <Spinner animation="border" />
                <p className="text-muted mt-3 mb-0"><Translate textKey="loadingSalesData" fallback="Loading sales data..." /></p>
              </div>
            ) : todaySales ? (
              <div className="dashboard-stats-grid-v2 mt-3">
                {/* Daily Sales - Green */}
                <div className="stat-card-v2 stat-card-v2--green slide-in-up" onClick={() => navigate('/sales-analytics')}>
                  <div className="stat-card-v2__value">
                    {formatCurrency(todaySales.sales).replace('RS', 'RS ')}
                  </div>
                  <div className="stat-card-v2__label">
                    <Translate textKey="sales" fallback="Sales" />
                  </div>
                  <i className="bi bi-cart-check stat-card-v2__icon"></i>
                </div>

                {/* Daily Profit - Teal */}
                <div className="stat-card-v2 stat-card-v2--teal slide-in-up" style={{ animationDelay: '0.1s' }} onClick={() => navigate('/sales-analytics')}>
                  <div className="stat-card-v2__value">
                    {formatCurrency(todaySales.profit).replace('RS', 'RS ')}
                  </div>
                  <div className="stat-card-v2__label">
                    <Translate textKey="profit" fallback="Profit" />
                  </div>
                  <i className="bi bi-graph-up-arrow stat-card-v2__icon"></i>
                </div>

                {/* Average Ticket - Orange */}
                <div className="stat-card-v2 stat-card-v2--orange slide-in-up" style={{ animationDelay: '0.2s' }} onClick={() => navigate('/sales-analytics')}>
                  <div className="stat-card-v2__value">
                    {todaySales.transactionCount > 0
                      ? formatCurrency(todaySales.sales / todaySales.transactionCount).replace('RS', 'RS ')
                      : formatCurrency(0).replace('RS', 'RS ')}
                  </div>
                  <div className="stat-card-v2__label">
                    <Translate textKey="averageTicket" fallback="Average Ticket" />
                  </div>
                  <i className="bi bi-tag stat-card-v2__icon"></i>
                </div>

                {/* Attendance - Indigo */}
                <div className="stat-card-v2 stat-card-v2--indigo slide-in-up" style={{ animationDelay: '0.3s' }} onClick={() => navigate('/employees')}>
                  <div className="stat-card-v2__value">
                    {translatedAttendance.present}/{translatedAttendance.total}
                  </div>
                  <div className="stat-card-v2__label">
                    <Translate textKey="attendance" fallback="Attendance" />
                  </div>
                  <i className="bi bi-person-check stat-card-v2__icon"></i>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <i className="bi bi-graph-down text-muted fs-1"></i>
                <p className="text-muted mt-3 mb-0"><Translate textKey="noSalesRecorded" fallback="No sales recorded for today yet." /></p>
              </div>
            )}
          </Card.Body>
        </Card>

        <Row className="g-4">
          <Col xs={12} md={6} lg={4}>
            <Card className="h-100 dashboard-card slide-in-up">
              <Card.Header className="d-flex align-items-center">
                <i className="bi bi-receipt me-2"></i>
                <span><Translate textKey="receipts" fallback="Receipts" /></span>
              </Card.Header>
              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-4">
                  <div className="bg-primary bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-receipt text-primary fs-1"></i>
                  </div>
                  <h2 className="text-primary fw-bold mb-2">{receiptCount}</h2>
                  <p className="text-muted mb-0">
                    <Translate textKey="totalReceiptsGenerated" fallback="Total receipts generated" />
                  </p>
                </div>
                <div className="mt-auto">
                  <Stack direction="horizontal" gap={2} className="d-flex flex-wrap stack-on-mobile">
                    <Button
                      variant="primary"
                      onClick={() => navigate('/receipts')}
                      className="flex-grow-1"
                    >
                      <i className="bi bi-eye me-1"></i>
                      <Translate textKey="view" fallback="View" />
                    </Button>
                    <Button
                      variant="success"
                      onClick={() => navigate('/new-receipt')}
                      className="flex-grow-1"
                    >
                      <i className="bi bi-plus me-1"></i>
                      <Translate textKey="add" fallback="Add" />
                    </Button>
                  </Stack>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} md={6} lg={4}>
            <Card className="h-100 dashboard-card slide-in-up">
              <Card.Header className="d-flex align-items-center">
                <i className="bi bi-people me-2"></i>
                <span><Translate textKey="employees" fallback="Employees" /></span>
              </Card.Header>
              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-4">
                  <div className="bg-success bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-people text-success fs-1"></i>
                  </div>
                  <h2 className="text-success fw-bold mb-2">{employeeCount}</h2>
                  <p className="text-muted mb-0">
                    <Translate textKey="totalEmployees" fallback="Total employees" />
                  </p>

                  {todayAttendance.total > 0 && (
                    <div className="mt-3 p-3 bg-light rounded-3">
                      <h6 className="text-primary mb-2"><i className="bi bi-calendar-check me-1"></i><Translate textKey="todaysAttendance" fallback="Today's Attendance" /></h6>
                      <div className="row text-center">
                        <div className="col-6">
                          <div className="text-success fw-bold fs-5">{translatedAttendance.present}</div>
                          <small className="text-muted"><Translate textKey="present" fallback="Present" /></small>
                        </div>
                        <div className="col-6">
                          <div className="text-danger fw-bold fs-5">{translatedAttendance.absent}</div>
                          <small className="text-muted"><Translate textKey="absent" fallback="Absent" /></small>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-auto">
                  <Stack direction="horizontal" gap={2} className="d-flex flex-wrap stack-on-mobile">
                    <Button
                      variant="primary"
                      onClick={() => navigate('/employees')}
                      className="flex-grow-1"
                    >
                      <i className="bi bi-eye me-1"></i>
                      <Translate textKey="viewEmployees" fallback="View Employees" />
                    </Button>
                    <Button
                      variant="success"
                      onClick={() => navigate('/mark-attendance')}
                      className="flex-grow-1"
                    >
                      <i className="bi bi-check-circle me-1"></i>
                      <Translate textKey="markAttendance" fallback="Mark Attendance" />
                    </Button>
                  </Stack>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* New Salary Management Card */}
          <Col xs={12} md={6} lg={4}>
            <Card className="h-100 dashboard-card slide-in-up">
              <Card.Header className="d-flex align-items-center">
                <i className="bi bi-cash-coin me-2"></i>
                <span><Translate textKey="salaryManagement" fallback="Salary Management" /></span>
              </Card.Header>
              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-4">
                  <div className="bg-warning bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-cash-coin text-warning fs-1"></i>
                  </div>
                  <h6 className="text-muted mb-3">
                    <Translate textKey="salaryManagementDesc" fallback="Manage employee salary payments and generate detailed reports." />
                  </h6>
                </div>
                <div className="mt-auto">
                  <Stack direction="horizontal" gap={2} className="d-flex flex-wrap stack-on-mobile">
                    <Button
                      variant="primary"
                      onClick={() => navigate('/salary-management')}
                      className="flex-grow-1"
                    >
                      <i className="bi bi-gear me-1"></i>
                      <Translate textKey="manageSalaries" fallback="Manage Salaries" />
                    </Button>
                    <Button
                      variant="success"
                      onClick={() => navigate('/add-salary-payment')}
                      className="flex-grow-1"
                    >
                      <i className="bi bi-plus me-1"></i>
                      <Translate textKey="addPayment" fallback="Add Payment" />
                    </Button>
                  </Stack>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* Expense Management Card */}
          <Col xs={12} md={6} lg={4}>
            <Card className="h-100 dashboard-card slide-in-up">
              <Card.Header className="d-flex align-items-center">
                <i className="bi bi-graph-down me-2"></i>
                <span><Translate textKey="expenseManagement" fallback="Expense Management" /></span>
              </Card.Header>
              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-4">
                  <div className="bg-info bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-graph-down text-info fs-1"></i>
                  </div>
                  <h6 className="text-muted mb-3">
                    <Translate textKey="expenseManagementDescription" fallback="Track and manage business expenses, categorize spending, and monitor trends." />
                  </h6>
                </div>
                <div className="mt-auto">
                  <Stack direction="horizontal" gap={2} className="d-flex flex-wrap stack-on-mobile">
                    <Button
                      variant="primary"
                      onClick={() => navigate('/expenses')}
                      className="flex-grow-1"
                    >
                      <i className="bi bi-eye me-1"></i>
                      <Translate textKey="viewExpenses" fallback="View Expenses" />
                    </Button>
                    <Button
                      variant="success"
                      onClick={() => navigate('/add-expense')}
                      className="flex-grow-1"
                    >
                      <i className="bi bi-plus me-1"></i>
                      <Translate textKey="addExpense" fallback="Add Expense" />
                    </Button>
                  </Stack>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} md={6} lg={4}>
            <Card className="h-100 dashboard-card slide-in-up">
              <Card.Header className="d-flex align-items-center">
                <i className="bi bi-graph-up me-2"></i>
                <span><Translate textKey="salesAndProfit" fallback="Sales & Profit" /></span>
              </Card.Header>
              <Card.Body className="d-flex flex-column">
                <div className="text-center mb-4">
                  <div className="bg-danger bg-opacity-10 rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-graph-up text-danger fs-1"></i>
                  </div>
                  <h6 className="text-muted mb-3">
                    <Translate textKey="salesAnalyticsDescription" fallback="View detailed sales and profit analytics on daily, monthly and yearly basis." />
                  </h6>
                </div>
                <div className="mt-auto">
                  <Button
                    variant="primary"
                    onClick={() => navigate('/sales-analytics')}
                    className="w-100"
                  >
                    <i className="bi bi-bar-chart me-1"></i>
                    <Translate textKey="viewAnalytics" fallback="View Analytics" />
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>

          <Col xs={12} lg={4}>
            <Card className="h-100 dashboard-card slide-in-up">
              <Card.Header className="d-flex align-items-center">
                <i className="bi bi-clock-history me-2"></i>
                <span><Translate textKey="recentReceipts" fallback="Recent Receipts" /></span>
              </Card.Header>
              <Card.Body>
                {recentReceipts.length > 0 ? (
                  <div className="table-responsive small-table">
                    <table className="table table-sm table-hover">
                      <thead>
                        <tr>
                          <th><Translate textKey="date" fallback="Date" /></th>
                          <th><Translate textKey="receiptId" fallback="Receipt ID" /></th>
                          <th><Translate textKey="total" fallback="Total" /></th>
                          <th><Translate textKey="action" fallback="Action" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {translatedReceipts.map(receipt => (
                          <tr key={receipt.id}>
                            <td>{formatDisplayDate(receipt.timestamp)}</td>
                            <td className="text-truncate" style={{ maxWidth: "80px" }}>{receipt.id.substring(0, 8)}</td>
                            <td>RS{receipt.totalAmount}</td>
                            <td>
                              <Button
                                size="sm"
                                variant="outline-primary"
                                onClick={() => navigate(`/receipt/${receipt.id}`)}
                              >
                                <Translate textKey="view" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-center mt-4">
                    {loading ? <Translate textKey="loading" fallback="Loading..." /> : <Translate textKey="noReceiptsYet" fallback="No receipts yet. Start creating receipts!" />}
                  </p>
                )}
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      <style jsx="true">{`
        @media (max-width: 576px) {
          .table-responsive.small-table {
            font-size: 0.875rem;
          }
          .table-responsive.small-table td, 
          .table-responsive.small-table th {
            padding: 0.3rem;
          }
          .table-responsive.small-table .text-truncate {
            max-width: 60px;
          }
        }
        @media (max-width: 400px) {
          .table-responsive.small-table {
            font-size: 0.8rem;
          }
          .table-responsive.small-table td, 
          .table-responsive.small-table th {
            padding: 0.25rem;
          }
          .table-responsive.small-table .text-truncate {
            max-width: 50px;
          }
        }
        .summary-box { height: 180px; display: flex; flex-direction: column; justify-content: center; }
      `}</style>
    </>
  );
};

export default Dashboard;