import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate, useTranslatedAttribute } from '../utils';
import { getLedgerAccounts, getLedgerEntries } from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import jsPDF from 'jspdf';

const BalanceSheet = () => {
  const { currentUser, activeShopId, shopData } = useAuth();
  const navigate = useNavigate();
  const getTranslatedAttr = useTranslatedAttribute();

  const [asOfDate, setAsOfDate] = useState(new Date().toISOString().split('T')[0]);
  const [balanceData, setBalanceData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  useEffect(() => {
    const fetchBalanceSheet = async () => {
      if (!currentUser || !activeShopId) return;

      setLoading(true);
      setError('');

      try {
        const data = await generateBalanceSheet(activeShopId, asOfDate);
        setBalanceData(data);
      } catch (err) {
        console.error('Error fetching balance sheet:', err);
        setError(getTranslatedAttr('failedToLoadBalanceSheet') || 'Failed to load balance sheet.');
      } finally {
        setLoading(false);
      }
    };

    fetchBalanceSheet();
  }, [currentUser, activeShopId, asOfDate]);

  const generateBalanceSheet = async (shopId, date) => {
    const accounts = await getLedgerAccounts(shopId);
    const entries = await getLedgerEntries(shopId, {});
    
    // Filter entries up to the selected date
    const filteredEntries = entries.filter(entry => entry.entryDate <= date);

    // Calculate balances for each account
    const accountBalances = {};
    accounts.forEach(acc => {
      accountBalances[acc.id] = {
        ...acc,
        balance: parseFloat(acc.openingBalance || 0)
      };
    });

    // Apply all entries to calculate current balances
    filteredEntries.forEach(entry => {
      const amount = parseFloat(entry.amount || 0);
      
      // Debit increases Assets/Expenses, decreases Liabilities/Income/Equity
      if (entry.debitAccountId && accountBalances[entry.debitAccountId]) {
        const acc = accountBalances[entry.debitAccountId];
        if (acc.accountType === 'Asset' || acc.accountType === 'Expense') {
          acc.balance += amount;
        } else {
          acc.balance -= amount;
        }
      }
      
      // Credit increases Liabilities/Income/Equity, decreases Assets/Expenses
      if (entry.creditAccountId && accountBalances[entry.creditAccountId]) {
        const acc = accountBalances[entry.creditAccountId];
        if (acc.accountType === 'Liability' || acc.accountType === 'Income' || acc.accountType === 'Equity') {
          acc.balance += amount;
        } else {
          acc.balance -= amount;
        }
      }
    });

    // Group accounts by type
    const assets = Object.values(accountBalances).filter(a => a.accountType === 'Asset' && a.balance !== 0);
    const liabilities = Object.values(accountBalances).filter(a => a.accountType === 'Liability' && a.balance !== 0);
    const equity = Object.values(accountBalances).filter(a => a.accountType === 'Equity' && a.balance !== 0);
    const income = Object.values(accountBalances).filter(a => a.accountType === 'Income');
    const expenses = Object.values(accountBalances).filter(a => a.accountType === 'Expense');

    // Calculate totals
    const totalAssets = assets.reduce((sum, a) => sum + a.balance, 0);
    const totalLiabilities = liabilities.reduce((sum, a) => sum + a.balance, 0);
    const totalEquity = equity.reduce((sum, a) => sum + a.balance, 0);
    
    // Calculate Net Income (Revenue - Expenses)
    const totalIncome = income.reduce((sum, a) => sum + a.balance, 0);
    const totalExpenses = expenses.reduce((sum, a) => sum + a.balance, 0);
    const netIncome = totalIncome - totalExpenses;

    // Total Liabilities + Equity + Net Income should equal Total Assets
    const totalLiabilitiesAndEquity = totalLiabilities + totalEquity + netIncome;

    return {
      date: asOfDate,
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      netIncome,
      totalLiabilitiesAndEquity
    };
  };

  const handleDateChange = (e) => {
    setAsOfDate(e.target.value);
  };


  const generatePDFReport = () => {
    if (!balanceData) return;

    setGeneratingPDF(true);
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 15;
      let yPosition = margin;
      const lineHeight = 7;

      // Title
      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text(getTranslatedAttr('balanceSheet') || 'Balance Sheet', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += lineHeight;

      // Shop name
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'normal');
      pdf.text(shopData?.shopName || 'Shop', pageWidth / 2, yPosition, { align: 'center' });
      yPosition += lineHeight;

      // Date
      pdf.setFontSize(10);
      pdf.text(`As of: ${formatDisplayDate(balanceData.date)}`, pageWidth / 2, yPosition, { align: 'center' });
      yPosition += lineHeight * 2;

      // Assets Section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text(getTranslatedAttr('assets') || 'Assets', margin, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      balanceData.assets.forEach(asset => {
        pdf.text(asset.accountName, margin + 5, yPosition);
        pdf.text(formatCurrency(asset.balance), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += lineHeight;
      });

      pdf.setFont('helvetica', 'bold');
      pdf.text(getTranslatedAttr('totalAssets') || 'Total Assets', margin, yPosition);
      pdf.text(formatCurrency(balanceData.totalAssets), pageWidth - margin, yPosition, { align: 'right' });
      yPosition += lineHeight * 2;

      // Liabilities Section
      pdf.setFontSize(14);
      pdf.text(getTranslatedAttr('liabilities') || 'Liabilities', margin, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      balanceData.liabilities.forEach(liability => {
        pdf.text(liability.accountName, margin + 5, yPosition);
        pdf.text(formatCurrency(liability.balance), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += lineHeight;
      });

      pdf.setFont('helvetica', 'bold');
      pdf.text(getTranslatedAttr('totalLiabilities') || 'Total Liabilities', margin, yPosition);
      pdf.text(formatCurrency(balanceData.totalLiabilities), pageWidth - margin, yPosition, { align: 'right' });
      yPosition += lineHeight * 2;

      // Equity Section
      pdf.setFontSize(14);
      pdf.text(getTranslatedAttr('equity') || 'Equity', margin, yPosition);
      yPosition += lineHeight;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      balanceData.equity.forEach(eq => {
        pdf.text(eq.accountName, margin + 5, yPosition);
        pdf.text(formatCurrency(eq.balance), pageWidth - margin, yPosition, { align: 'right' });
        yPosition += lineHeight;
      });

      // Net Income
      pdf.text(getTranslatedAttr('netIncome') || 'Net Income (Retained Earnings)', margin + 5, yPosition);
      pdf.text(formatCurrency(balanceData.netIncome), pageWidth - margin, yPosition, { align: 'right' });
      yPosition += lineHeight;

      pdf.setFont('helvetica', 'bold');
      pdf.text(getTranslatedAttr('totalEquity') || 'Total Equity', margin, yPosition);
      pdf.text(formatCurrency(balanceData.totalEquity + balanceData.netIncome), pageWidth - margin, yPosition, { align: 'right' });
      yPosition += lineHeight * 2;

      // Total Liabilities & Equity
      pdf.setFontSize(12);
      pdf.text(getTranslatedAttr('totalLiabilitiesAndEquity') || 'Total Liabilities & Equity', margin, yPosition);
      pdf.text(formatCurrency(balanceData.totalLiabilitiesAndEquity), pageWidth - margin, yPosition, { align: 'right' });

      // Save PDF
      const fileName = `Balance_Sheet_${balanceData.date.replace(/-/g, '_')}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error('Error generating PDF:', err);
      setError(getTranslatedAttr('failedToGeneratePDF') || 'Failed to generate PDF.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  return (
    <>
      <MainNavbar />
      <Container className="pb-4">
        <PageHeader
          title={<Translate textKey="balanceSheet" fallback="Balance Sheet" />}
          icon="bi-file-earmark-spreadsheet"
          subtitle={<Translate textKey="balanceSheetSubtitle" fallback="View your financial position at a specific date" />}
        />
        <div className="page-header-actions">
          <Button
            variant="outline-secondary"
            onClick={() => navigate('/ledger-accounts')}
          >
            <Translate textKey="viewAccounts" fallback="View Accounts" />
          </Button>
          {balanceData && (
            <Button
              variant="success"
              onClick={generatePDFReport}
              disabled={generatingPDF}
            >
              {generatingPDF ? (
                <>
                  <Spinner animation="border" size="sm" className="me-2" />
                  <Translate textKey="generatingPDF" fallback="Generating..." />
                </>
              ) : (
                <>
                  <i className="bi bi-file-earmark-pdf me-2"></i>
                  <Translate textKey="downloadPDF" fallback="Download PDF" />
                </>
              )}
            </Button>
          )}
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {/* Date Selector */}
        <Card className="mb-4 shadow-sm">
          <Card.Body>
            <Row>
              <Col md={4}>
                <Form.Group>
                  <Form.Label><Translate textKey="asOfDate" fallback="As of Date" /></Form.Label>
                  <Form.Control
                    type="date"
                    value={asOfDate}
                    onChange={handleDateChange}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>

        {loading ? (
          <div className="text-center py-4">
            <Spinner animation="border" />
            <p className="mt-2"><Translate textKey="loadingBalanceSheet" fallback="Loading balance sheet..." /></p>
          </div>
        ) : balanceData ? (
          <Row>
            {/* Assets */}
            <Col md={6}>
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-primary text-white">
                  <h5 className="mb-0"><Translate textKey="assets" fallback="Assets" /></h5>
                </Card.Header>
                <Card.Body>
                  {balanceData.assets.length > 0 ? (
                    <Table hover responsive>
                      <thead>
                        <tr>
                          <th><Translate textKey="account" fallback="Account" /></th>
                          <th className="text-end"><Translate textKey="balance" fallback="Balance" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceData.assets.map(asset => (
                          <tr key={asset.id}>
                            <td>{asset.accountName}</td>
                            <td className="text-end">{formatCurrency(asset.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="table-primary">
                          <th><Translate textKey="totalAssets" fallback="Total Assets" /></th>
                          <th className="text-end">{formatCurrency(balanceData.totalAssets)}</th>
                        </tr>
                      </tfoot>
                    </Table>
                  ) : (
                    <Alert variant="info"><Translate textKey="noAssets" fallback="No assets recorded" /></Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>

            {/* Liabilities & Equity */}
            <Col md={6}>
              {/* Liabilities */}
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-danger text-white">
                  <h5 className="mb-0"><Translate textKey="liabilities" fallback="Liabilities" /></h5>
                </Card.Header>
                <Card.Body>
                  {balanceData.liabilities.length > 0 ? (
                    <Table hover responsive>
                      <thead>
                        <tr>
                          <th><Translate textKey="account" fallback="Account" /></th>
                          <th className="text-end"><Translate textKey="balance" fallback="Balance" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceData.liabilities.map(liability => (
                          <tr key={liability.id}>
                            <td>{liability.accountName}</td>
                            <td className="text-end">{formatCurrency(liability.balance)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="table-danger">
                          <th><Translate textKey="totalLiabilities" fallback="Total Liabilities" /></th>
                          <th className="text-end">{formatCurrency(balanceData.totalLiabilities)}</th>
                        </tr>
                      </tfoot>
                    </Table>
                  ) : (
                    <Alert variant="info"><Translate textKey="noLiabilities" fallback="No liabilities recorded" /></Alert>
                  )}
                </Card.Body>
              </Card>

              {/* Equity */}
              <Card className="mb-4 shadow-sm">
                <Card.Header className="bg-success text-white">
                  <h5 className="mb-0"><Translate textKey="equity" fallback="Equity" /></h5>
                </Card.Header>
                <Card.Body>
                  <Table hover responsive>
                    <thead>
                      <tr>
                        <th><Translate textKey="account" fallback="Account" /></th>
                        <th className="text-end"><Translate textKey="balance" fallback="Balance" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {balanceData.equity.map(eq => (
                        <tr key={eq.id}>
                          <td>{eq.accountName}</td>
                          <td className="text-end">{formatCurrency(eq.balance)}</td>
                        </tr>
                      ))}
                      <tr>
                        <td><Translate textKey="netIncome" fallback="Net Income (Retained Earnings)" /></td>
                        <td className={`text-end ${balanceData.netIncome >= 0 ? 'text-success' : 'text-danger'}`}>
                          {formatCurrency(balanceData.netIncome)}
                        </td>
                      </tr>
                    </tbody>
                    <tfoot>
                      <tr className="table-success">
                        <th><Translate textKey="totalEquity" fallback="Total Equity" /></th>
                        <th className="text-end">{formatCurrency(balanceData.totalEquity + balanceData.netIncome)}</th>
                      </tr>
                    </tfoot>
                  </Table>
                </Card.Body>
              </Card>
            </Col>

            {/* Summary */}
            <Col md={12}>
              <Card className="shadow-sm">
                <Card.Body>
                  <Row>
                    <Col md={6}>
                      <div className="d-flex justify-content-between align-items-center p-3 bg-primary text-white rounded">
                        <h5 className="mb-0"><Translate textKey="totalAssets" fallback="Total Assets" /></h5>
                        <h4 className="mb-0">{formatCurrency(balanceData.totalAssets)}</h4>
                      </div>
                    </Col>
                    <Col md={6}>
                      <div className="d-flex justify-content-between align-items-center p-3 bg-secondary text-white rounded">
                        <h5 className="mb-0"><Translate textKey="totalLiabilitiesAndEquity" fallback="Total Liabilities & Equity" /></h5>
                        <h4 className="mb-0">{formatCurrency(balanceData.totalLiabilitiesAndEquity)}</h4>
                      </div>
                    </Col>
                  </Row>
                  {Math.abs(balanceData.totalAssets - balanceData.totalLiabilitiesAndEquity) > 0.01 && (
                    <Alert variant="warning" className="mt-3">
                      <i className="bi bi-exclamation-triangle me-2"></i>
                      <Translate textKey="balanceSheetImbalance" fallback="Balance sheet is not balanced. Please review your entries." />
                    </Alert>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        ) : (
          <Alert variant="info">
            <Translate textKey="noDataAvailable" fallback="No data available for the selected date." />
          </Alert>
        )}
      </Container>
    </>
  );
};

export default BalanceSheet;
