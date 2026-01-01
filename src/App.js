import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { AdminProvider } from './contexts/AdminContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { useLanguage } from './contexts/LanguageContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import PrivateRoute from './components/PrivateRoute';
import AdminPrivateRoute from './components/AdminPrivateRoute';
import GuestPrivateRoute from './components/GuestPrivateRoute';
import StaffPrivateRoute from './components/StaffPrivateRoute';
import StaffManagement from './pages/StaffManagement';
import GuestNewReceipt from './pages/GuestNewReceipt';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import GuestDashboard from './pages/GuestDashboard';
import NewReceipt from './pages/NewReceipt';
import ViewReceipts from './pages/ViewReceipts';
import ViewReceipt from './pages/ViewReceipt';
import EditReceipt from './pages/EditReceipt';
import ReturnProducts from './pages/ReturnProducts';
import ViewStock from './pages/ViewStock';
import AddStockItem from './pages/AddStockItem';
import EditStockItem from './pages/EditStockItem';
import AddStockEntry from './pages/AddStockEntry';
import StockHistory from './pages/StockHistory';
import PurchaseManagement from './pages/PurchaseManagement';
import Employees from './pages/Employees';
import AddEmployee from './pages/AddEmployee';
import EditEmployee from './pages/EditEmployee';
import Attendance from './pages/Attendance';
import MarkAttendance from './pages/MarkAttendance';
import AttendanceReport from './pages/AttendanceReport';
import QRScanner from './pages/QRScanner';
import EmployeeCards from './pages/EmployeeCards';
import Settings from './pages/Settings';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import AdminPendingUsers from './pages/AdminPendingUsers';
import AdminManageUsers from './pages/AdminManageUsers';
import SalesAnalytics from './pages/SalesAnalytics';
import SalaryManagement from './pages/SalaryManagement';
import AddSalaryPayment from './pages/AddSalaryPayment';
import EditSalaryPayment from './pages/EditSalaryPayment';
import SalaryReports from './pages/SalaryReports';
import Expenses from './pages/Expenses';
import AddExpense from './pages/AddExpense';
import EditExpense from './pages/EditExpense';
import ExpenseCategories from './pages/ExpenseCategories';
import ShopProfile from './pages/ShopProfile';
import CustomerInformation from './pages/CustomerInformation';
import SupplierInformation from './pages/SupplierInformation';
import ManagePasswords from './pages/ManagePasswords';
import LedgerAccounts from './pages/LedgerAccounts';
import LedgerEntries from './pages/LedgerEntries';
import AddLedgerEntry from './pages/AddLedgerEntry';
import EditLedgerEntry from './pages/EditLedgerEntry';
import DailyClosing from './pages/DailyClosing';
import AccountingReports from './pages/AccountingReports';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';

// Wrapper component to apply RTL class based on language
function AppContent() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isRTL = language === 'ur';

  console.log('AppContent rendering, language:', language, 'theme:', theme);

  return (
    <Router>
      <div className={`App ${isRTL ? 'rtl' : ''}`} data-theme={theme}>
        <Routes>
          {/* User Routes */}
          <Route path="/login" element={
            <ErrorBoundary>
              <Login />
            </ErrorBoundary>
          } />
          <Route path="/register" element={
            <ErrorBoundary>
              <Register />
            </ErrorBoundary>
          } />
          <Route path="/dashboard" element={
            <ErrorBoundary>
              <StaffPrivateRoute>
                <Dashboard />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/new-receipt" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canCreateReceipts">
                <NewReceipt />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/receipts" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canViewReceipts">
                <ViewReceipts />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/receipt/:id" element={
            <ErrorBoundary>
              <PrivateRoute>
                <ViewReceipt />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/edit-receipt/:id" element={
            <ErrorBoundary>
              <PrivateRoute>
                <EditReceipt />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/return-products/:id" element={
            <ErrorBoundary>
              <PrivateRoute>
                <ReturnProducts />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          {/* Sales Analytics Route */}
          <Route path="/sales-analytics" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canViewAnalytics">
                <SalesAnalytics />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          {/* Stock Management Routes */}
          <Route path="/stock" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canViewStock">
                <ViewStock />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/add-stock" element={
            <ErrorBoundary>
              <PrivateRoute>
                <AddStockItem />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/add-stock-entry" element={
            <ErrorBoundary>
              <PrivateRoute>
                <AddStockEntry />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/edit-stock/:id" element={
            <ErrorBoundary>
              <PrivateRoute>
                <EditStockItem />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/stock-history" element={
            <ErrorBoundary>
              <PrivateRoute>
                <StockHistory />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/purchase-management" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canViewStock">
                <PurchaseManagement />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          {/* Employee Management Routes */}
          <Route path="/employees" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canViewEmployees">
                <Employees />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/add-employee" element={
            <ErrorBoundary>
              <PrivateRoute>
                <AddEmployee />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/edit-employee/:id" element={
            <ErrorBoundary>
              <PrivateRoute>
                <EditEmployee />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          {/* Salary Management Routes */}
          <Route path="/salary-management" element={
            <ErrorBoundary>
              <PrivateRoute>
                <SalaryManagement />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/add-salary-payment" element={
            <ErrorBoundary>
              <PrivateRoute>
                <AddSalaryPayment />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/edit-salary-payment/:id" element={
            <ErrorBoundary>
              <PrivateRoute>
                <EditSalaryPayment />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/salary-reports" element={
            <ErrorBoundary>
              <PrivateRoute>
                <SalaryReports />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          {/* Attendance Management Routes */}
          <Route path="/attendance" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canMarkAttendance">
                <Attendance />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/mark-attendance" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canMarkAttendance">
                <MarkAttendance />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/attendance-report" element={
            <ErrorBoundary>
              <PrivateRoute>
                <AttendanceReport />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/qr-scanner" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canMarkAttendance">
                <QRScanner />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/employee-cards" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canMarkAttendance">
                <EmployeeCards />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />

          {/* Expense Management Routes */}
          <Route path="/expenses" element={
            <ErrorBoundary>
              <StaffPrivateRoute permission="canManageExpenses">
                <Expenses />
              </StaffPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/add-expense" element={
            <ErrorBoundary>
              <PrivateRoute>
                <AddExpense />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/edit-expense/:id" element={
            <ErrorBoundary>
              <PrivateRoute>
                <EditExpense />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/expense-categories" element={
            <ErrorBoundary>
              <PrivateRoute>
                <ExpenseCategories />
              </PrivateRoute>
            </ErrorBoundary>
          } />

          {/* Guest Routes */}
          <Route path="/guest-dashboard" element={
            <ErrorBoundary>
              <GuestPrivateRoute>
                <GuestDashboard />
              </GuestPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/guest-new-receipt" element={
            <ErrorBoundary>
              <GuestPrivateRoute>
                <GuestNewReceipt />
              </GuestPrivateRoute>
            </ErrorBoundary>
          } />

          {/* Settings Route */}
          <Route path="/settings" element={
            <ErrorBoundary>
              <PrivateRoute>
                <Settings />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/manage-passwords" element={
            <ErrorBoundary>
              <PrivateRoute>
                <ManagePasswords />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/shop-profile" element={
            <ErrorBoundary>
              <PrivateRoute>
                <ShopProfile />
              </PrivateRoute>
            </ErrorBoundary>
          } />

          {/* Contacts Routes */}
          <Route path="/customer-information" element={
            <ErrorBoundary>
              <PrivateRoute>
                <CustomerInformation />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/supplier-information" element={
            <ErrorBoundary>
              <PrivateRoute>
                <SupplierInformation />
              </PrivateRoute>
            </ErrorBoundary>
          } />

          {/* Staff Management Route */}
          <Route path="/staff-management" element={
            <ErrorBoundary>
              <PrivateRoute>
                <StaffManagement />
              </PrivateRoute>
            </ErrorBoundary>
          } />

          {/* Ledger Routes */}
          <Route path="/ledger-accounts" element={
            <ErrorBoundary>
              <PrivateRoute>
                <LedgerAccounts />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/ledger-entries" element={
            <ErrorBoundary>
              <PrivateRoute>
                <LedgerEntries />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/add-ledger-entry" element={
            <ErrorBoundary>
              <PrivateRoute>
                <AddLedgerEntry />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/edit-ledger-entry/:id" element={
            <ErrorBoundary>
              <PrivateRoute>
                <EditLedgerEntry />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/daily-closing" element={
            <ErrorBoundary>
              <PrivateRoute>
                <DailyClosing />
              </PrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/accounting-reports" element={
            <ErrorBoundary>
              <PrivateRoute>
                <AccountingReports />
              </PrivateRoute>
            </ErrorBoundary>
          } />

          {/* Admin Routes */}
          <Route path="/admin/login" element={
            <ErrorBoundary>
              <AdminLogin />
            </ErrorBoundary>
          } />
          <Route path="/admin/dashboard" element={
            <ErrorBoundary>
              <AdminPrivateRoute>
                <AdminDashboard />
              </AdminPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/admin/pending-users" element={
            <ErrorBoundary>
              <AdminPrivateRoute>
                <AdminPendingUsers />
              </AdminPrivateRoute>
            </ErrorBoundary>
          } />
          <Route path="/admin/users" element={
            <ErrorBoundary>
              <AdminPrivateRoute>
                <AdminManageUsers />
              </AdminPrivateRoute>
            </ErrorBoundary>
          } />

          <Route path="/" element={<Navigate replace to="/login" />} />
          <Route path="/admin" element={<Navigate replace to="/admin/login" />} />
        </Routes>
      </div>
    </Router>
  );
}

function App() {
  console.log('App component rendering');

  return (
    <ErrorBoundary>
      <AuthProvider>
        <AdminProvider>
          <LanguageProvider>
            <ThemeProvider>
              <AppContent />
            </ThemeProvider>
          </LanguageProvider>
        </AdminProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
