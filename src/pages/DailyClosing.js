import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Table, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { Translate, useTranslatedAttribute } from '../utils';
import { getDailyClosing } from '../utils/ledgerUtils';
import { formatCurrency } from '../utils/receiptUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import jsPDF from 'jspdf';

const DailyClosing = () => {
  const { currentUser, activeShopId } = useAuth();
  const navigate = useNavigate();
  const getTranslatedAttr = useTranslatedAttribute();

  const [closingDate, setClosingDate] = useState(new Date().toISOString().split('T')[0]);
  const [closingData, setClosingData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Fetch daily closing data
  useEffect(() => {
    const fetchClosingData = async () => {
      if (!currentUser || !activeShopId) return;

      setLoading(true);
      setError('');

      try {
        const data = await getDailyClosing(activeShopId, closingDate);
        setClosingData(data);
      } catch (error) {
        console.error('Error fetching daily closing:', error);
        setError(getTranslatedAttr('failedToLoadDailyClosing') || 'Failed to load daily closing data.');
      } finally {
        setLoading(false);
      }
    };

    fetchClosingData();
  }, [currentUser, activeShopId, closingDate]);

  const handleDateChange = (e) => {
    setClosingDate(e.target.value);
  };

  // Generate PDF report
  const generatePDFReport = () => {
    if (!closingData) return;

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
      pdf.text(getTranslatedAttr('reconciliationReport'), margin, yPosition);
      yPosition += lineHeight;

      // Date and generation info
      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${getTranslatedAttr('date')}: ${formatDisplayDate(closingData.date)}`, margin, yPosition);
      yPosition += lineHeight;
      pdf.text(`${getTranslatedAttr('generated')}: ${formatDisplayDate(new Date().toISOString())}`, margin, yPosition);
      yPosition += sectionSpacing;
      drawLine();
      yPosition += sectionSpacing;

      // Summary Section
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Daily Summary', margin, yPosition);
      yPosition += lineHeight + 2;

      pdf.setFontSize(10);
      pdf.setFont('helvetica', 'normal');

      const summaryData = [
        [getTranslatedAttr('totalSales'), formatCurrency(closingData.salesTotal), closingData.salesCount + ' ' + getTranslatedAttr('transactionsCount')],
        [getTranslatedAttr('refunds'), formatCurrency(closingData.refundsTotal), closingData.refundsCount + ' ' + getTranslatedAttr('refunds')],
        [getTranslatedAttr('voids'), formatCurrency(closingData.voidsTotal), closingData.voidsCount + ' ' + getTranslatedAttr('voids')],
        [getTranslatedAttr('lessDiscounts'), formatCurrency(closingData.discountsTotal), ''],
        [getTranslatedAttr('netSales'), formatCurrency(closingData.netSales), '']
      ];

      summaryData.forEach(([label, value, detail]) => {
        pdf.setFont('helvetica', 'normal');
        pdf.text(label + ':', margin, yPosition);
        pdf.setFont('helvetica', 'bold');
        pdf.text(value, pageWidth - margin - 50, yPosition, { align: 'right' });
        if (detail) {
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(8);
          pdf.text(detail, margin + 5, yPosition + 4);
          pdf.setFontSize(10);
        }
        yPosition += lineHeight + (detail ? 2 : 0);
      });

      yPosition += sectionSpacing;
      checkPageBreak(20);

      // Payment Method Breakdown
      if (Object.keys(closingData.paymentMethodTotals).length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('paymentMethodBreakdown'), margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('paymentMethod'), margin, yPosition);
        pdf.text(getTranslatedAttr('netAmount'), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
        drawLine();
        yPosition += 2;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        Object.entries(closingData.paymentMethodTotals).forEach(([method, amount]) => {
          checkPageBreak(lineHeight + 2);
          pdf.text(method, margin, yPosition);
          const amountText = formatCurrency(amount);
          pdf.text(amountText, pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += lineHeight;
        });

        yPosition += sectionSpacing;
        checkPageBreak(20);
      }

      // Transaction Summary
      if (Object.keys(closingData.transactionTypeTotals).length > 0) {
        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('transactionSummary'), margin, yPosition);
        yPosition += lineHeight + 2;

        // Table header
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'bold');
        pdf.text(getTranslatedAttr('accountType'), margin, yPosition);
        pdf.text(getTranslatedAttr('count'), margin + 80, yPosition);
        pdf.text(getTranslatedAttr('total'), pageWidth - margin - 30, yPosition, { align: 'right' });
        yPosition += lineHeight;
        drawLine();
        yPosition += 2;

        // Table rows
        pdf.setFont('helvetica', 'normal');
        Object.entries(closingData.transactionTypeTotals).forEach(([type, data]) => {
          checkPageBreak(lineHeight + 2);
          pdf.text(type, margin, yPosition);
          pdf.text(data.count.toString(), margin + 80, yPosition);
          pdf.text(formatCurrency(Math.abs(data.total)), pageWidth - margin - 30, yPosition, { align: 'right' });
          yPosition += lineHeight;
        });

        yPosition += sectionSpacing;
      }

      // Daily Summary Box
      checkPageBreak(30);
      pdf.setLineWidth(1);
      pdf.rect(margin, yPosition, pageWidth - (margin * 2), 25);
      yPosition += 8;

      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.text(getTranslatedAttr('dailyClosingSummary'), margin + 5, yPosition);
      yPosition += lineHeight + 2;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`${getTranslatedAttr('totalEntries')}: ${closingData.totalEntries}`, margin + 5, yPosition);
      yPosition += lineHeight;
      pdf.text(`${getTranslatedAttr('grossSales')}: ${formatCurrency(closingData.salesTotal)}`, margin + 5, yPosition);
      yPosition += lineHeight;
      pdf.text(`${getTranslatedAttr('lessRefunds')} (${formatCurrency(closingData.refundsTotal)}) + ${getTranslatedAttr('lessVoids')} (${formatCurrency(closingData.voidsTotal)}) + ${getTranslatedAttr('lessDiscounts')} (${formatCurrency(closingData.discountsTotal)})`, margin + 5, yPosition);
      yPosition += lineHeight;
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${getTranslatedAttr('netSales')}: ${formatCurrency(closingData.netSales)}`, margin + 5, yPosition);

      // Footer
      yPosition = pageHeight - margin;
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.text(`${getTranslatedAttr('reportDate')}: ${formatDisplayDate(closingData.date)}`, margin, yPosition, { align: 'left' });
      pdf.text(`${getTranslatedAttr('page')} ${pdf.internal.pages.length}`, pageWidth - margin, yPosition, { align: 'right' });

      // Save PDF
      const fileName = `Daily_Closing_${closingData.date.replace(/-/g, '_')}.pdf`;
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
          title={<Translate textKey="dailyClosing" />}
          icon="bi-cash-stack"
          subtitle={<Translate textKey="dailyClosingSubtitle" />}
        />
        <div className="page-header-actions">
          <Button
            variant="outline-secondary"
            onClick={() => navigate('/ledger-entries')}
          >
            <Translate textKey="viewEntries" />
          </Button>
          {closingData && (
            <Button
              variant="success"
              onClick={generatePDFReport}
              disabled={generatingPDF || !closingData}
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

        {/* Date Selector */}
        <Card className="mb-4 shadow-sm">
          <Card.Body>
            <Row>
              <Col md={4}>
                <Form.Group>
                  <Form.Label><Translate textKey="selectDate" /></Form.Label>
                  <Form.Control
                    type="date"
                    value={closingDate}
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
            <p className="mt-2">Loading daily closing data...</p>
          </div>
        ) : closingData ? (
          <>
            {/* Summary Cards */}
            <div className="dashboard-stats-grid-v2 mb-4">
              {/* Total Sales - Blue */}
              <div className="stat-card-v2 stat-card-v2--blue slide-in-up">
                <div className="stat-card-v2__value">
                  {formatCurrency(closingData.salesTotal).replace('RS', 'RS ')}
                </div>
                <div className="stat-card-v2__label">
                  Total Sales
                </div>
                <i className="bi bi-cart-check stat-card-v2__icon"></i>
              </div>

              {/* Refunds - Red */}
              <div className="stat-card-v2 stat-card-v2--red slide-in-up" style={{ animationDelay: '0.1s' }}>
                <div className="stat-card-v2__value">
                  {formatCurrency(closingData.refundsTotal).replace('RS', 'RS ')}
                </div>
                <div className="stat-card-v2__label">
                  Refunds
                </div>
                <i className="bi bi-arrow-counterclockwise stat-card-v2__icon"></i>
              </div>

              {/* Voids - Orange */}
              <div className="stat-card-v2 stat-card-v2--orange slide-in-up" style={{ animationDelay: '0.2s' }}>
                <div className="stat-card-v2__value">
                  {formatCurrency(closingData.voidsTotal).replace('RS', 'RS ')}
                </div>
                <div className="stat-card-v2__label">
                  Voids
                </div>
                <i className="bi bi-x-circle stat-card-v2__icon"></i>
              </div>

              {/* Net Sales - Green */}
              <div className="stat-card-v2 stat-card-v2--green slide-in-up" style={{ animationDelay: '0.3s' }}>
                <div className="stat-card-v2__value">
                  {formatCurrency(closingData.netSales).replace('RS', 'RS ')}
                </div>
                <div className="stat-card-v2__label">
                  Net Sales
                </div>
                <i className="bi bi-check-all stat-card-v2__icon"></i>
              </div>
            </div>

            {/* Payment Method Breakdown */}
            <Card className="mb-4 shadow-sm">
              <Card.Header>
                <h5 className="mb-0"><Translate textKey="paymentMethodBreakdown" /></h5>
              </Card.Header>
              <Card.Body>
                {Object.keys(closingData.paymentMethodTotals).length > 0 ? (
                  <Table hover responsive>
                    <thead>
                      <tr>
                        <th><Translate textKey="paymentMethod" /></th>
                        <th className="text-end"><Translate textKey="netAmount" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(closingData.paymentMethodTotals).map(([method, amount]) => (
                        <tr key={method}>
                          <td>
                            <Badge bg="secondary" className="me-2">{method}</Badge>
                          </td>
                          <td className="text-end">
                            <strong className={amount >= 0 ? 'text-success' : 'text-danger'}>
                              {formatCurrency(amount)}
                            </strong>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                ) : (
                  <Alert variant="info">No payment method data available for this date.</Alert>
                )}
              </Card.Body>
            </Card>

            {/* Transaction Summary */}
            <Card className="mb-4 shadow-sm">
              <Card.Header>
                <h5 className="mb-0"><Translate textKey="transactionSummary" /></h5>
              </Card.Header>
              <Card.Body>
                <Row>
                  <Col md={6}>
                    <Table hover>
                      <thead>
                        <tr>
                          <th><Translate textKey="accountType" /></th>
                          <th className="text-end"><Translate textKey="count" /></th>
                          <th className="text-end"><Translate textKey="total" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(closingData.transactionTypeTotals).map(([type, data]) => (
                          <tr key={type}>
                            <td>
                              <Badge bg={
                                type === 'Sale' ? 'success' :
                                  type === 'Refund' ? 'danger' :
                                    type === 'Void' ? 'warning' :
                                      type === 'Discount' ? 'info' :
                                        'secondary'
                              }>
                                {type}
                              </Badge>
                            </td>
                            <td className="text-end">{data.count}</td>
                            <td className="text-end">
                              {formatCurrency(Math.abs(data.total))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </Col>
                  <Col md={6}>
                    <Card className="bg-light">
                      <Card.Body>
                        <h6><Translate textKey="dailySummary" /></h6>
                        <hr />
                        <div className="d-flex justify-content-between mb-2">
                          <span><Translate textKey="totalEntries" />:</span>
                          <strong>{closingData.totalEntries}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><Translate textKey="lessDiscounts" />:</span>
                          <strong className="text-info">{formatCurrency(closingData.discountsTotal)}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><Translate textKey="grossSales" />:</span>
                          <strong>{formatCurrency(closingData.salesTotal)}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><Translate textKey="lessRefunds" />:</span>
                          <strong className="text-danger">-{formatCurrency(closingData.refundsTotal)}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><Translate textKey="lessVoids" />:</span>
                          <strong className="text-warning">-{formatCurrency(closingData.voidsTotal)}</strong>
                        </div>
                        <div className="d-flex justify-content-between mb-2">
                          <span><Translate textKey="lessDiscounts" />:</span>
                          <strong className="text-info">-{formatCurrency(closingData.discountsTotal)}</strong>
                        </div>
                        <hr />
                        <div className="d-flex justify-content-between">
                          <span><strong><Translate textKey="netSales" />:</strong></span>
                          <strong className="text-success fs-5">{formatCurrency(closingData.netSales)}</strong>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              </Card.Body>
            </Card>
          </>
        ) : (
          <Alert variant="info">
            No data available for the selected date.
          </Alert>
        )}
      </Container>
    </>
  );
};

export default DailyClosing;

