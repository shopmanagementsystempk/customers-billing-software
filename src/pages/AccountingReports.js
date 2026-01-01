import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate, useTranslatedAttribute } from '../utils';
import { getAccountingReport } from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import jsPDF from 'jspdf';

const AccountingReports = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  const getTranslatedAttr = useTranslatedAttribute();

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
        setError(getTranslatedAttr('failedToLoadReport'));
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
      pdf.text(getTranslatedAttr('accountingReport'), margin, yPosition);
      yPosition += lineHeight;

      // Period
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${getTranslatedAttr('period')}: ${formatDisplayDate(startDate)} - ${formatDisplayDate(endDate)}`, margin, yPosition);
      yPosition += lineHeight;
      pdf.text(`${getTranslatedAttr('generated')}: ${formatDisplayDate(new Date().toISOString())}`, margin, yPosition);
      yPosition += sectionSpacing;
      drawLine();
      yPosition += sectionSpacing;

      // Summary Section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(getTranslatedAttr('financialSummary'), margin, yPosition);
      yPosition += lineHeight + 2;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      const summaryData = [
        [getTranslatedAttr('totalIncome'), formatCurrency(reportData.totalsByType.Income)],
        [getTranslatedAttr('totalExpenses'), formatCurrency(reportData.totalsByType.Expense)],
        [getTranslatedAttr('netIncome'), formatCurrency(reportData.netIncome)],
        [getTranslatedAttr('totalAssets'), formatCurrency(reportData.totalsByType.Asset)],
        [getTranslatedAttr('totalLiabilities'), formatCurrency(reportData.totalsByType.Liability)],
        [getTranslatedAttr('totalEquity'), formatCurrency(reportData.totalEquity)]
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
        pdf.text(getTranslatedAttr('paymentMethodBreakdown'), margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('paymentMethod'), margin, yPosition);
        pdf.text(getTranslatedAttr('transactionsCount'), margin + 60, yPosition);
        pdf.text(getTranslatedAttr('totalSales'), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
        drawLine();
        yPosition += 2;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        Object.entries(reportData.paymentMethodBreakdown).forEach(([method, data]) => {
          checkPageBreak(lineHeight + 2);
          const translatedMethod = getTranslatedAttr(method.toLowerCase()) || method;
          pdf.text(translatedMethod, margin, yPosition);
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
        pdf.text(getTranslatedAttr('asset'), margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('account'), margin, yPosition);
        pdf.text(getTranslatedAttr('currentBalance'), pageWidth - margin - 30, yPosition, { align: 'right' });
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
        pdf.text(getTranslatedAttr('totalAssets'), margin, yPosition);
        pdf.text(formatCurrency(reportData.totalsByType.Asset), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight + sectionSpacing;
        checkPageBreak(20);
      }

      // Liabilities Section
      if (reportData.accountsByType.Liability.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('liability'), margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('account'), margin, yPosition);
        pdf.text(getTranslatedAttr('currentBalance'), pageWidth - margin - 30, yPosition, { align: 'right' });
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
        pdf.text(getTranslatedAttr('totalLiabilities'), margin, yPosition);
        pdf.text(formatCurrency(reportData.totalsByType.Liability), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight + sectionSpacing;
        checkPageBreak(20);
      }

      // Income Section
      if (reportData.accountsByType.Income.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('income'), margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('account'), margin, yPosition);
        pdf.text(getTranslatedAttr('currentBalance'), pageWidth - margin - 30, yPosition, { align: 'right' });
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
        pdf.text(getTranslatedAttr('totalIncome'), margin, yPosition);
        pdf.text(formatCurrency(reportData.totalsByType.Income), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight + sectionSpacing;
        checkPageBreak(20);
      }

      // Expenses Section
      if (reportData.accountsByType.Expense.length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('expense'), margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('account'), margin, yPosition);
        pdf.text(getTranslatedAttr('currentBalance'), pageWidth - margin - 30, yPosition, { align: 'right' });
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
        pdf.text(getTranslatedAttr('totalExpenses'), margin, yPosition);
        pdf.text(formatCurrency(reportData.totalsByType.Expense), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
      }

      // Footer
      yPosition = pageHeight - margin;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`${getTranslatedAttr('totalEntries')}: ${reportData.totalEntries}`, margin, yPosition, { align: 'left' });
      pdf.text(`${getTranslatedAttr('page')} ${pdf.internal.pages.length}`, pageWidth - margin, yPosition, { align: 'right' });

      // Save PDF
      const fileName = `Accounting_Report_${startDate}_to_${endDate}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      setError(getTranslatedAttr('failedToGeneratePDF'));
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader
          title={<Translate textKey="accountingReports" />}
          icon="bi-graph-up"
          subtitle={<Translate textKey="accountingReportsSubtitle" />}
        />
        <div className="page-header-actions">
          <Button
            variant="outline-secondary"
            onClick={() => navigate('/ledger-accounts')}
          >
            <Translate textKey="viewAccounts" />
          </Button>
          <Button
            variant="outline-primary"
            onClick={() => navigate('/daily-closing')}
          >
            <Translate textKey="dailyClosing" />
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
                  <Translate textKey="generatingPDF" />...
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-pdf me-2"></i>
                  <Translate textKey="downloadPDF" />
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
                  <Form.Label><Translate textKey="startDate" /></Form.Label>
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
                  <Form.Label><Translate textKey="endDate" /></Form.Label>
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
                  <Translate textKey="thisMonth" />
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
                  <Translate textKey="today" />
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="mt-2"><Translate textKey="generatingReport" /></p>
          </div>
        ) : reportData ? (
          <>
            {/* Summary Cards */}
            <div className="dashboard-stats-grid-v2 mb-4">
              {/* Total Income - Green */}
              <div className="stat-card-v2 stat-card-v2--green slide-in-up">
                <div className="stat-card-v2__value">
                  {formatCurrency(reportData.totalsByType.Income).replace('RS', 'RS ')}
                </div>
                <div className="stat-card-v2__label">
                  <Translate textKey="totalIncome" />
                </div>
                <i className="bi bi-cash-stack stat-card-v2__icon"></i>
              </div>

              {/* Total Expenses - Red */}
              <div className="stat-card-v2 stat-card-v2--red slide-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="stat-card-v2__value">
                  {formatCurrency(reportData.totalsByType.Expense).replace('RS', 'RS ')}
                </div>
                <div className="stat-card-v2__label">
                  <Translate textKey="totalExpenses" />
                </div>
                <i className="bi bi-cart-x stat-card-v2__icon"></i>
              </div>

              {/* Net Income - Teal/Purple */}
              <div className={`stat-card-v2 ${reportData.netIncome >= 0 ? 'stat-card-v2--teal' : 'stat-card-v2--purple'} slide-in-up`} style={{ animationDelay: '0.2s' }}>
                <div className="stat-card-v2__value">
                  {formatCurrency(reportData.netIncome).replace('RS', 'RS ')}
                </div>
                <div className="stat-card-v2__label">
                  <Translate textKey="netIncomePL" />
                </div>
                <i className={`bi ${reportData.netIncome >= 0 ? 'bi-graph-up-arrow' : 'bi-graph-down-arrow'} stat-card-v2__icon`}></i>
              </div>

              {/* Total Assets - Blue */}
              <div className="stat-card-v2 stat-card-v2--blue slide-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="stat-card-v2__value">
                  {formatCurrency(reportData.totalsByType.Asset).replace('RS', 'RS ')}
                </div>
                <div className="stat-card-v2__label">
                  <Translate textKey="totalAssets" />
                </div>
                <i className="bi bi-bank stat-card-v2__icon"></i>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            {Object.keys(reportData.paymentMethodBreakdown).length > 0 && (
              <Card className="mb-4 shadow-sm">
                <Card.Header>
                  <h5 className="mb-0"><Translate textKey="paymentMethodBreakdown" /></h5>
                </Card.Header>
                <Card.Body>
                  <Table hover responsive>
                    <thead>
                      <tr>
                        <th><Translate textKey="paymentMethod" /></th>
                        <th className="text-end"><Translate textKey="transactionsCount" /></th>
                        <th className="text-end"><Translate textKey="totalSales" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(reportData.paymentMethodBreakdown).map(([method, data]) => (
                        <tr key={method}>
                          <td>
                            <Badge bg="secondary">
                              {getTranslatedAttr(method.toLowerCase()) || method}
                            </Badge>
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
                    <h5 className="mb-0"><Translate textKey="asset" /></h5>
                  </Card.Header>
                  <Card.Body>
                    {reportData.accountsByType.Asset.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th><Translate textKey="account" /></th>
                            <th className="text-end"><Translate textKey="currentBalance" /></th>
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
                            <th><Translate textKey="totalAssets" /></th>
                            <th className="text-end text-success">
                              {formatCurrency(reportData.totalsByType.Asset)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    ) : (
                      <Alert variant="info"><Translate textKey="noAssetAccounts" /></Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header>
                    <h5 className="mb-0"><Translate textKey="liability" /></h5>
                  </Card.Header>
                  <Card.Body>
                    {reportData.accountsByType.Liability.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th><Translate textKey="account" /></th>
                            <th className="text-end"><Translate textKey="currentBalance" /></th>
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
                            <th><Translate textKey="totalLiabilities" /></th>
                            <th className="text-end text-danger">
                              {formatCurrency(reportData.totalsByType.Liability)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    ) : (
                      <Alert variant="info"><Translate textKey="noLiabilityAccounts" /></Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            <Row className="mb-4">
              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header>
                    <h5 className="mb-0"><Translate textKey="income" /></h5>
                  </Card.Header>
                  <Card.Body>
                    {reportData.accountsByType.Income.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th><Translate textKey="account" /></th>
                            <th className="text-end"><Translate textKey="currentBalance" /></th>
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
                            <th><Translate textKey="totalIncome" /></th>
                            <th className="text-end text-success">
                              {formatCurrency(reportData.totalsByType.Income)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    ) : (
                      <Alert variant="info"><Translate textKey="noIncomeAccounts" /></Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="shadow-sm h-100">
                  <Card.Header>
                    <h5 className="mb-0"><Translate textKey="expense" /></h5>
                  </Card.Header>
                  <Card.Body>
                    {reportData.accountsByType.Expense.length > 0 ? (
                      <Table hover size="sm">
                        <thead>
                          <tr>
                            <th><Translate textKey="account" /></th>
                            <th className="text-end"><Translate textKey="currentBalance" /></th>
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
                            <th><Translate textKey="totalExpenses" /></th>
                            <th className="text-end text-danger">
                              {formatCurrency(reportData.totalsByType.Expense)}
                            </th>
                          </tr>
                        </tfoot>
                      </Table>
                    ) : (
                      <Alert variant="info"><Translate textKey="noExpenseAccounts" /></Alert>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {/* Financial Summary */}
            <Card className="shadow-sm">
              <Card.Header>
                <h5 className="mb-0"><Translate textKey="financialSummary" /></h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Table hover>
                      <tbody>
                        <tr>
                          <td><strong><Translate textKey="totalIncome" /></strong></td>
                          <td className="text-end text-success">
                            <strong>{formatCurrency(reportData.totalsByType.Income)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td><strong><Translate textKey="totalExpenses" /></strong></td>
                          <td className="text-end text-danger">
                            <strong>{formatCurrency(reportData.totalsByType.Expense)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td><strong><Translate textKey="netIncome" /></strong></td>
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
                          <td><strong><Translate textKey="totalAssets" /></strong></td>
                          <td className="text-end text-info">
                            <strong>{formatCurrency(reportData.totalsByType.Asset)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td><strong><Translate textKey="totalLiabilities" /></strong></td>
                          <td className="text-end text-danger">
                            <strong>{formatCurrency(reportData.totalsByType.Liability)}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td><strong><Translate textKey="totalEquity" /></strong></td>
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
                    <Translate textKey="period" />: {formatDisplayDate(startDate)} - {formatDisplayDate(endDate)} |
                    <Translate textKey="totalEntries" />: {reportData.totalEntries}
                  </small>
                </div>
              </Card.Body>
            </Card>
          </>
        ) : (
          <Alert variant="info">
            <Translate textKey="noDataAvailable" />
          </Alert>
        )}
      </Container>
    </>
  );
};

export default AccountingReports;

