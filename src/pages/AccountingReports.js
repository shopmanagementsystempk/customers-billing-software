import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate } from '../utils';
import { getAccountingReport } from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import jsPDF from 'jspdf';

const AccountingReports = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);
  
  // Fetch accounting report data
  useEffect(() => {
    const fetchReportData = async () => {
      if (!currentUser || !activeShopId) return;
      
      setLoading(true);
      setError('');
      
      try {
        const data = await getAccountingReport(activeShopId, startDate, endDate);
        setReportData(data);
      } catch (error) {
        console.error('Error fetching accounting report:', error);
        setError('Failed to load accounting report. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchReportData();
  }, [currentUser, activeShopId, startDate, endDate]);
  
  const handleDateChange = (e) => {
    const { name, value } = e.target;
    if (name === 'startDate') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  // Generate PDF report
  const generatePDFReport = () => {
    if (!reportData) return;

    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 15;
      let yPosition = margin;
      const lineHeight = 7;
      const sectionSpacing = 10;

      // Helper function to add a new page if needed
      const checkPageBreak = (requiredHeight) => {
        if (yPosition + requiredHeight > pageHeight - margin) {
          pdf.addPage();
          yPosition = margin;
          return true;
        }
        return false;
      };

      // Helper function to draw a line
      const drawLine = () => {
        pdf.setLineWidth(0.5);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 3;
      };

      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Accounting Report', margin, yPosition);
      yPosition += lineHeight;

      // Period
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Period: ${formatDisplayDate(startDate)} to ${formatDisplayDate(endDate)}`, margin, yPosition);
      yPosition += lineHeight;
      pdf.text(`Generated: ${formatDisplayDate(new Date().toISOString())}`, margin, yPosition);
      yPosition += sectionSpacing;
      drawLine();
      yPosition += sectionSpacing;

      // Summary Section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Financial Summary', margin, yPosition);
      yPosition += lineHeight + 2;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      
      const summaryData = [
        ['Total Income', formatCurrency(reportData.totalsByType.Income)],
        ['Total Expenses', formatCurrency(reportData.totalsByType.Expense)],
        ['Net Income', formatCurrency(reportData.netIncome)],
        ['Total Assets', formatCurrency(reportData.totalsByType.Asset)],
        ['Total Liabilities', formatCurrency(reportData.totalsByType.Liability)],
        ['Total Equity', formatCurrency(reportData.totalEquity)]
      ];

      summaryData.forEach(([label, value]) => {
        pdf.setFont('helvetica', 'normal');
        pdf.text(label + ':', margin, yPosition);
        pdf.setFont('helvetica', 'bold');
        pdf.text(value, pageWidth - margin - 50, yPosition, { align: 'right' });
        yPosition += lineHeight;
      });

      yPosition += sectionSpacing;
      checkPageBreak(20);

      // Payment Method Breakdown
      if (Object.keys(reportData.paymentMethodBreakdown).length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Payment Method Breakdown', margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Payment Method', margin, yPosition);
        pdf.text('Transactions', margin + 60, yPosition);
        pdf.text('Total Sales', pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
        drawLine();
        yPosition += 2;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        Object.entries(reportData.paymentMethodBreakdown).forEach(([method, data]) => {
          checkPageBreak(lineHeight + 2);
          pdf.text(method, margin, yPosition);
          pdf.text(data.count.toString(), margin + 60, yPosition);
          pdf.text(formatCurrency(data.total), pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += lineHeight;
        });

        yPosition += sectionSpacing;
        checkPageBreak(20);
      }

      // Assets Section
      if (reportData.accountsByType.Asset.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Assets', margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Account Name', margin, yPosition);
        pdf.text('Balance', pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
        drawLine();
        yPosition += 2;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        reportData.accountsByType.Asset.forEach(account => {
          checkPageBreak(lineHeight + 2);
          const balance = reportData.accountBalances[account.id] || 0;
          pdf.text(account.accountName, margin, yPosition);
          pdf.text(formatCurrency(balance), pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += lineHeight;
        });

        // Total
        pdf.setFont('helvetica', 'bold');
        pdf.text('Total Assets', margin, yPosition);
        pdf.text(formatCurrency(reportData.totalsByType.Asset), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight + sectionSpacing;
        checkPageBreak(20);
      }

      // Liabilities Section
      if (reportData.accountsByType.Liability.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Liabilities', margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Account Name', margin, yPosition);
        pdf.text('Balance', pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
        drawLine();
        yPosition += 2;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        reportData.accountsByType.Liability.forEach(account => {
          checkPageBreak(lineHeight + 2);
          const balance = reportData.accountBalances[account.id] || 0;
          pdf.text(account.accountName, margin, yPosition);
          pdf.text(formatCurrency(balance), pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += lineHeight;
        });

        // Total
        pdf.setFont('helvetica', 'bold');
        pdf.text('Total Liabilities', margin, yPosition);
        pdf.text(formatCurrency(reportData.totalsByType.Liability), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight + sectionSpacing;
        checkPageBreak(20);
      }

      // Income Section
      if (reportData.accountsByType.Income.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Income', margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Account Name', margin, yPosition);
        pdf.text('Balance', pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
        drawLine();
        yPosition += 2;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        reportData.accountsByType.Income.forEach(account => {
          checkPageBreak(lineHeight + 2);
          const balance = reportData.accountBalances[account.id] || 0;
          pdf.text(account.accountName, margin, yPosition);
          pdf.text(formatCurrency(balance), pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += lineHeight;
        });

        // Total
        pdf.setFont('helvetica', 'bold');
        pdf.text('Total Income', margin, yPosition);
        pdf.text(formatCurrency(reportData.totalsByType.Income), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight + sectionSpacing;
        checkPageBreak(20);
      }

      // Expenses Section
      if (reportData.accountsByType.Expense.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Expenses', margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text('Account Name', margin, yPosition);
        pdf.text('Balance', pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
        drawLine();
        yPosition += 2;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        reportData.accountsByType.Expense.forEach(account => {
          checkPageBreak(lineHeight + 2);
          const balance = reportData.accountBalances[account.id] || 0;
          pdf.text(account.accountName, margin, yPosition);
          pdf.text(formatCurrency(balance), pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += lineHeight;
        });

        // Total
        pdf.setFont('helvetica', 'bold');
        pdf.text('Total Expenses', margin, yPosition);
        pdf.text(formatCurrency(reportData.totalsByType.Expense), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
      }

      // Footer
      yPosition = pageHeight - margin;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`Total Entries: ${reportData.totalEntries}`, margin, yPosition, { align: 'left' });
      pdf.text(`Page ${pdf.internal.pages.length}`, pageWidth - margin, yPosition, { align: 'right' });

      // Save PDF
      const fileName = `Accounting_Report_${startDate}_to_${endDate}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError('Failed to generate PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };
  
  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader 
          title="Accounting Reports" 
          icon="bi-graph-up" 
          subtitle="Comprehensive financial reports and accounting statements."
        />
        <div className="page-header-actions">
          <Button 
            variant="outline-secondary" 
            onClick={() => navigate('/ledger-accounts')}
          >
            View Accounts
          </Button>
          <Button 
            variant="outline-primary" 
            onClick={() => navigate('/daily-closing')}
          >
            Daily Closing
          </Button>
          {reportData && (
            <Button 
              variant="success" 
              onClick={generatePDFReport}
              disabled={generatingPDF || !reportData}
            >
              {generatingPDF ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-pdf me-2"></i>
                  Download PDF
                </>
              )}
            </Button>
          )}
        </div>
        
        {error && <Alert variant="danger">{error}</Alert>}
        
        {/* Date Range Selector */}
        <Card className="mb-4 shadow-sm">
          <Card.Body>
            <Row>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control 
                    type="date" 
                    name="startDate"
                    value={startDate}
                    onChange={handleDateChange}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>End Date</Form.Label>
                  <Form.Control 
                    type="date" 
                    name="endDate"
                    value={endDate}
                    onChange={handleDateChange}
                  />
                </Form.Group>
              </Col>
              <Col md={4} className="d-flex align-items-end">
                <Button 
                  variant="primary" 
                  onClick={() => {
                    const today = new Date();
                    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                    setStartDate(firstDay.toISOString().split('T')[0]);
                    setEndDate(today.toISOString().split('T')[0]);
                  }}
                >
                  This Month
                </Button>
                <Button 
                  variant="outline-primary" 
                  className="ms-2"
                  onClick={() => {
                    const today = new Date();
                    setStartDate(today.toISOString().split('T')[0]);
                    setEndDate(today.toISOString().split('T')[0]);
                  }}
                >
                  Today
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="mt-2">Generating accounting report...</p>
          </div>
        ) : reportData ? (
          <>
            {/* Summary Cards */}
            <Row className="mb-4 g-3">
              <Col md={6} lg={3}>
                <Card className="shadow-sm h-100 border-success">
                  <Card.Body className="text-center">
                    <h6 className="text-muted">Total Income</h6>
                    <h3 className="text-success">{formatCurrency(reportData.totalsByType.Income)}</h3>
                    <small className="text-muted">
                      {reportData.accountsByType.Income.length} accounts
                    </small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6} lg={3}>
                <Card className="shadow-sm h-100 border-danger">
                  <Card.Body className="text-center">
                    <h6 className="text-muted">Total Expenses</h6>
                    <h3 className="text-danger">{formatCurrency(reportData.totalsByType.Expense)}</h3>
                    <small className="text-muted">
                      {reportData.accountsByType.Expense.length} accounts
                    </small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6} lg={3}>
                <Card className="shadow-sm h-100 border-primary">
                  <Card.Body className="text-center">
                    <h6 className="text-muted">Net Income</h6>
                    <h3 className={reportData.netIncome >= 0 ? 'text-success' : 'text-danger'}>
                      {formatCurrency(reportData.netIncome)}
                    </h3>
                    <small className="text-muted">Profit/Loss</small>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6} lg={3}>
                <Card className="shadow-sm h-100 border-info">
                  <Card.Body className="text-center">
                    <h6 className="text-muted">Total Assets</h6>
                    <h3 className="text-info">{formatCurrency(reportData.totalsByType.Asset)}</h3>
                    <small className="text-muted">
                      {reportData.accountsByType.Asset.length} accounts
                    </small>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            
            {/* Payment Method Breakdown */}
            {Object.keys(reportData.paymentMethodBreakdown).length > 0 && (
              <Card className="mb-4 shadow-sm">
                <Card.Header>
                  <h5 className="mb-0">Payment Method Breakdown</h5>
                </Card.Header>
                <Card.Body>
                  <Table hover responsive>
                    <thead>
                      <tr>
                        <th>Payment Method</th>
                        <th className="text-end">Transactions</th>
                        <th className="text-end">Total Sales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportData.paymentMethodBreakdown).map(([method, data]) => (
                        <tr key={method}>
                          <td>
                            <Badge bg="secondary">{method}</Badge>
                          </td>
                          <td className="text-end">{data.count}</td>
                          <td className="text-end">
                            <strong>{formatCurrency(data.total)}</strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            )}
            
            {/* Account Balances by Type */}
            <Row className="mb-4">
              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header>
                    <h5 className="mb-0">Assets</h5>
                  </Card.Header>
                  <Card.Body>
                    {reportData.accountsByType.Asset.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th className="text-end">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.accountsByType.Asset.map(account => (
                            <tr key={account.id}>
                              <td>{account.accountName}</td>
                              <td className="text-end">
                                <strong className={reportData.accountBalances[account.id] >= 0 ? 'text-success' : 'text-danger'}>
                                  {formatCurrency(reportData.accountBalances[account.id] || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th>Total Assets</th>
                            <th className="text-end text-success">
                              {formatCurrency(reportData.totalsByType.Asset)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    ) : (
                      <Alert variant="info">No asset accounts</Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header>
                    <h5 className="mb-0">Liabilities</h5>
                  </Card.Header>
                  <Card.Body>
                    {reportData.accountsByType.Liability.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th className="text-end">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.accountsByType.Liability.map(account => (
                            <tr key={account.id}>
                              <td>{account.accountName}</td>
                              <td className="text-end">
                                <strong className={reportData.accountBalances[account.id] >= 0 ? 'text-danger' : 'text-success'}>
                                  {formatCurrency(reportData.accountBalances[account.id] || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th>Total Liabilities</th>
                            <th className="text-end text-danger">
                              {formatCurrency(reportData.totalsByType.Liability)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    ) : (
                      <Alert variant="info">No liability accounts</Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            
            <Row className="mb-4">
              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header>
                    <h5 className="mb-0">Income</h5>
                  </Card.Header>
                  <Card.Body>
                    {reportData.accountsByType.Income.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th className="text-end">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.accountsByType.Income.map(account => (
                            <tr key={account.id}>
                              <td>{account.accountName}</td>
                              <td className="text-end">
                                <strong className="text-success">
                                  {formatCurrency(reportData.accountBalances[account.id] || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th>Total Income</th>
                            <th className="text-end text-success">
                              {formatCurrency(reportData.totalsByType.Income)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    ) : (
                      <Alert variant="info">No income accounts</Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header>
                    <h5 className="mb-0">Expenses</h5>
                  </Card.Header>
                  <Card.Body>
                    {reportData.accountsByType.Expense.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th className="text-end">Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reportData.accountsByType.Expense.map(account => (
                            <tr key={account.id}>
                              <td>{account.accountName}</td>
                              <td className="text-end">
                                <strong className="text-danger">
                                  {formatCurrency(reportData.accountBalances[account.id] || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr>
                            <th>Total Expenses</th>
                            <th className="text-end text-danger">
                              {formatCurrency(reportData.totalsByType.Expense)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    ) : (
                      <Alert variant="info">No expense accounts</Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            
            {/* Financial Summary */}
            <Card className="shadow-sm">
              <Card.Header>
                <h5 className="mb-0">Financial Summary</h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Table hover>
                      <tbody>
                        <tr>
                          <td><strong>Total Income</strong></td>
                          <td className="text-end text-success">
                            <strong>{formatCurrency(reportData.totalsByType.Income)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Total Expenses</strong></td>
                          <td className="text-end text-danger">
                            <strong>{formatCurrency(reportData.totalsByType.Expense)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Net Income</strong></td>
                          <td className={`text-end ${reportData.netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                            <strong className="fs-5">{formatCurrency(reportData.netIncome)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </Col>
                  <Col md={6}>
                    <Table hover>
                      <tbody>
                        <tr>
                          <td><strong>Total Assets</strong></td>
                          <td className="text-end text-info">
                            <strong>{formatCurrency(reportData.totalsByType.Asset)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Total Liabilities</strong></td>
                          <td className="text-end text-danger">
                            <strong>{formatCurrency(reportData.totalsByType.Liability)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td><strong>Total Equity</strong></td>
                          <td className={`text-end ${reportData.totalEquity >= 0 ? 'text-success' : 'text-danger'}`}>
                            <strong className="fs-5">{formatCurrency(reportData.totalEquity)}</strong>
                          </td>
                        </tr>
                      </tbody>
                    </Table>
                  </Col>
                </Row>
                <hr />
                <div className="text-center">
                  <small className="text-muted">
                    Report Period: {formatDisplayDate(startDate)} to {formatDisplayDate(endDate)} | 
                    Total Entries: {reportData.totalEntries}
                  </small>
                </div>
              </Card.Body>
            </Card>
          </>
        ) : (
          <Alert variant="info">
            No data available for the selected period.
          </Alert>
        )}
      </Container>
    </>
  );
};

export default AccountingReports;

