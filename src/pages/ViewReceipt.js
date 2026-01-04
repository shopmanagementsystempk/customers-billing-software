import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Button, Row, Col, Table, Alert, Form } from 'react-bootstrap';
import { useParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import { getReceiptById, formatCurrency, formatDate, formatTime } from '../utils/receiptUtils';
import Translate from '../components/Translate';
import translations from '../utils/translations';
import './ViewReceipt.css';

const ViewReceipt = () => {
  const { id } = useParams();
  const { currentUser, activeShopId } = useAuth();
  const { language } = useLanguage();
  const [receipt, setReceipt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pdfRef = useRef();
  const navigate = useNavigate();
  const [receiptWidth, setReceiptWidth] = useState(100);
  const [receiptHeight, setReceiptHeight] = useState('auto');
  const [showSizeControls, setShowSizeControls] = useState(false);
  const [printMode, setPrintMode] = useState('thermal'); // 'thermal' or 'a4'

  useEffect(() => {
    // Create a non-async function for useEffect
    const fetchReceipt = () => {
      if (currentUser && id && activeShopId) {
        getReceiptById(id)
          .then(receiptData => {
            // Check if receipt belongs to current user
            if (receiptData.shopId !== activeShopId) {
              throw new Error('You do not have permission to view this receipt');
            }

            setReceipt(receiptData);
          })
          .catch(error => {
            setError('Failed to load receipt: ' + error.message);
            console.error('Error fetching receipt:', error);
          })
          .finally(() => {
            setLoading(false);
          });
      }
    };

    fetchReceipt();
  }, [id, currentUser, activeShopId]);

  // Updated downloadPdf function to consider custom size
  const downloadPdf = () => {
    const input = pdfRef.current;

    // Make sure all images are loaded before converting to canvas
    const images = input.querySelectorAll('img');
    const imagesLoaded = Array.from(images).map(img => {
      if (img.complete) {
        return Promise.resolve();
      } else {
        return new Promise(resolve => {
          img.onload = resolve;
          img.onerror = resolve; // Continue even if image fails
        });
      }
    });

    // Wait for all images to load then create PDF
    Promise.all(imagesLoaded).then(() => {
      html2canvas(input, {
        useCORS: true,
        allowTaint: true,
        logging: false,
        scale: 2 // Higher quality
      }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
        const imgX = (pdfWidth - imgWidth * ratio) / 2;
        const imgY = 30;

        pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
        pdf.save(`receipt-${receipt.transactionId}.pdf`);
      });
    });
  };

  // Function to print the receipt with invoice bill dimensions
  const printReceipt = () => {
    const content = pdfRef.current;
    const originalContents = document.body.innerHTML;

    // Create print content with proper invoice dimensions
    const printContent = document.createElement('div');
    printContent.innerHTML = content.innerHTML;

    // Apply invoice bill dimensions based on print mode
    if (printMode === 'thermal') {
      // Thermal printer dimensions (80mm width)
      printContent.style.width = '80mm';
      printContent.style.maxWidth = '80mm';
      printContent.style.minHeight = 'auto';
      printContent.style.margin = '0';
      printContent.style.padding = '5mm';
      printContent.style.fontSize = '12px';
      printContent.style.lineHeight = '1.2';
    } else {
      // A4 dimensions
      printContent.style.width = '210mm';
      printContent.style.maxWidth = '210mm';
      printContent.style.minHeight = '297mm';
      printContent.style.margin = '0 auto';
      printContent.style.padding = '20mm';
      printContent.style.fontSize = '14px';
      printContent.style.lineHeight = '1.4';
    }

    // Create print stylesheet
    const printStyles = document.createElement('style');
    printStyles.innerHTML = `
      @page { size: ${printMode === 'thermal' ? '80mm auto' : 'A4'}; margin: 0; }
      body { margin: 0; padding: 0; background: white !important; color: black !important; font-family: 'Courier New', monospace !important; }
      .receipt-header, .receipt-buttons, .size-controls-form { display: none !important; }
      .receipt-container { max-width: 100% !important; width: 100% !important; margin: 0 !important; padding: 0 !important; box-shadow: none !important; border: none !important; }
      .table { font-size: ${printMode === 'thermal' ? '11px' : '12px'} !important; background: white !important; color: black !important; border-collapse: collapse !important; width: 100% !important; }
      .table th, .table td { padding: ${printMode === 'thermal' ? '4px 2px' : '8px'} !important; background: white !important; color: black !important; border: 1px dotted black !important; }
      .table th { background: transparent !important; color: black !important; border-bottom: 1px dotted black !important; font-weight: bold !important; }
      h3 { font-size: ${printMode === 'thermal' ? '18px' : '20px'} !important; margin: ${printMode === 'thermal' ? '6px 0' : '10px 0'} !important; text-align: center !important; }
      p { font-size: ${printMode === 'thermal' ? '11px' : '12px'} !important; margin: ${printMode === 'thermal' ? '2px 0' : '5px 0'} !important; text-align: center !important; }
    `;

    document.head.appendChild(printStyles);
    document.body.innerHTML = printContent.innerHTML;

    // Add appropriate CSS class based on print mode
    document.body.classList.add(printMode === 'thermal' ? 'thermal-print' : 'a4-print');

    // Wait for content to render before printing
    setTimeout(() => {
      window.print();

      // Cleanup
      document.head.removeChild(printStyles);
      document.body.classList.remove(printMode === 'thermal' ? 'thermal-print' : 'a4-print');
      document.body.innerHTML = originalContents;
      window.location.reload(); // Reload to restore the React app state
    }, 100);
  };

  // Function to handle receipt width change
  const handleWidthChange = (e) => {
    setReceiptWidth(e.target.value);
  };

  // Function to handle receipt height change
  const handleHeightChange = (e) => {
    setReceiptHeight(e.target.value);
  };

  // Function to handle print mode change
  const handlePrintModeChange = (e) => {
    setPrintMode(e.target.value);
  };

  if (loading) {
    return (
      <>
        <MainNavbar />
        <Container className="text-center mt-5">
          <p>Loading receipt...</p>
        </Container>
      </>
    );
  }

  if (error) {
    return (
      <>
        <MainNavbar />
        <Container className="mt-4">
          <Alert variant="danger">{error}</Alert>
          <Button
            variant="primary"
            onClick={() => navigate('/receipts')}
          >
            Back to Receipts
          </Button>
        </Container>
      </>
    );
  }

  if (!receipt) {
    return (
      <>
        <MainNavbar />
        <Container className="mt-4">
          <Alert variant="warning">Receipt not found</Alert>
          <Button
            variant="primary"
            onClick={() => navigate('/receipts')}
          >
            Back to Receipts
          </Button>
        </Container>
      </>
    );
  }

  return (
    <>
      <MainNavbar />
      <Container>
        <div className="d-flex justify-content-between align-items-center mb-4 receipt-header">
          <h2>Receipt Details</h2>
          <div className="receipt-buttons">
            <Button
              variant="primary"
              onClick={downloadPdf}
            >
              Download PDF
            </Button>

            <Button
              variant="success"
              onClick={printReceipt}
            >
              Print Receipt
            </Button>

            <Button
              variant="info"
              onClick={() => setShowSizeControls(!showSizeControls)}
            >
              {showSizeControls ? 'Hide Size Controls' : 'Adjust Size'}
            </Button>

            <Button
              variant="warning"
              onClick={() => navigate(`/edit-receipt/${id}`)}
            >
              <Translate textKey="edit" fallback="Edit" />
            </Button>

            <Button
              variant="danger"
              onClick={() => navigate(`/return-products/${id}`)}
            >
              <Translate textKey="returnProducts" fallback="Return Products" />
            </Button>

            <Button
              variant="outline-secondary"
              onClick={() => navigate('/receipts')}
            >
              Back to Receipts
            </Button>
          </div>
        </div>

        {showSizeControls && (
          <Card className="mb-3">
            <Card.Body>
              <Form className="size-controls-form">
                <Form.Group as={Row} className="align-items-center mb-3">
                  <Form.Label column xs={12} sm={3}>Print Mode:</Form.Label>
                  <Col xs={12} sm={9}>
                    <Form.Select value={printMode} onChange={handlePrintModeChange}>
                      <option value="thermal">Thermal Printer (80mm)</option>
                      <option value="a4">A4 Paper</option>
                    </Form.Select>
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="align-items-center mb-3">
                  <Form.Label column xs={12} sm={3}>Receipt Width (%): {receiptWidth}%</Form.Label>
                  <Col xs={12} sm={7} className="mb-2 mb-sm-0">
                    <Form.Range
                      value={receiptWidth}
                      onChange={handleWidthChange}
                      min={50}
                      max={150}
                      step={5}
                    />
                  </Col>
                  <Col xs={12} sm={2} className="d-flex justify-content-start justify-content-sm-end">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setReceiptWidth(100)}
                    >
                      Reset
                    </Button>
                  </Col>
                </Form.Group>

                <Form.Group as={Row} className="align-items-center">
                  <Form.Label column xs={12} sm={3}>Receipt Height:</Form.Label>
                  <Col xs={12} sm={7} className="mb-2 mb-sm-0">
                    <Form.Select
                      value={receiptHeight}
                      onChange={handleHeightChange}
                    >
                      <option value="auto">Auto (Fit Content)</option>
                      <option value="100mm">100mm</option>
                      <option value="150mm">150mm</option>
                      <option value="200mm">200mm</option>
                      <option value="297mm">A4 Height (297mm)</option>
                    </Form.Select>
                  </Col>
                  <Col xs={12} sm={2} className="d-flex justify-content-start justify-content-sm-end">
                    <Button
                      variant="outline-secondary"
                      size="sm"
                      onClick={() => setReceiptHeight('auto')}
                    >
                      Reset
                    </Button>
                  </Col>
                </Form.Group>
              </Form>
            </Card.Body>
          </Card>
        )}

        <div style={{
          maxWidth: `${receiptWidth}%`,
          margin: '0 auto',
          height: receiptHeight !== 'auto' ? receiptHeight : 'auto',
          minHeight: receiptHeight !== 'auto' ? receiptHeight : 'auto'
        }}>
          <Card>
            <Card.Body ref={pdfRef} className="p-4">
              <style>{`
                .thermal-wrap{max-width:80mm;margin:0 auto;color:#000;font-family:'Courier New',monospace;font-weight:700}
                .center{text-align:center}
                .logo{max-height:36px;margin:6px auto 8px;display:block}
                .title{font-size:20px;font-weight:700;margin:4px 0}
                .sm{font-size:12px}
                .sep{border-top:1px dotted #000;margin:6px 0}
                table.thermal{width:100%;border-collapse:collapse;margin:4px 0}
                table.thermal th{font-size:12px;font-weight:700;padding:8px 4px;border-top:1px dotted #000;border-bottom:1px dotted #000;border-right:1px dotted #000}
                table.thermal th:first-child{border-left:1px dotted #000}
                table.thermal td{font-size:12px;padding:8px 4px;border-bottom:1px dotted #000;border-right:1px dotted #000;vertical-align:top}
                table.thermal td:first-child{border-left:1px dotted #000}
                .c{text-align:center}.r{text-align:right}.wrap{white-space:pre-wrap;word-break:break-word}
                .totals{margin-top:8px;border-top:1px dotted #000;border-bottom:1px dotted #000;padding:6px 0;font-size:12px}
                .line{display:flex;justify-content:space-between;margin:3px 0}
                .net{ text-align:right;font-weight:700;font-size:18px;margin-top:6px }
                .dev{ text-align:center;margin-top:10px;padding:6px 0;font-size:10px;border-top:1px dashed #000;border-bottom:1px dashed #000 }
                /* Percentage widths to increase the Item/Product column */
                .col-sr { width: 12%; }
                .col-item { width: 46%; }
                .col-qty { width: 10%; }
                .col-rate { width: 16%; }
                .col-amnt { width: 16%; }
                .totals-box { border: 1px dashed #000; padding: 5px; margin-top: 5mm; }
                .total-row { display: flex; justify-content: space-between; padding: 2px 0; }
                .net-total { font-size: 16px; font-weight: 700; text-align: right; margin-top: 3mm; }
                .thank-you { margin-top: 5mm; font-size: 10px; }
                .dev { text-align: center; margin-top: 10px; padding: 6px 0; font-size: 10px; border-top: 1px dashed #000; border-bottom: 1px dashed #000; }
                @media print {
                  body { font-weight: 700; }
                  .thermal-wrap { width: 80mm; }
                }
              `}</style>
              <div className="thermal-wrap">
                <div className="center">
                  {receipt.shopDetails.logoUrl && (
                    <img src={receipt.shopDetails.logoUrl} alt={receipt.shopDetails.name} className="logo" onError={(e) => { e.target.style.display = 'none' }} />
                  )}
                  <div className="title">{receipt.shopDetails.name}</div>
                  <div className="sm">{receipt.shopDetails.address}</div>
                  <div className="sm">Phone # {receipt.shopDetails.phone}</div>
                </div>
                <div className="sep"></div>
                <div className="sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <div>Invoice: {receipt.transactionId}</div>
                  <div>{formatDate(receipt.timestamp)} {formatTime(receipt.timestamp)}</div>
                </div>
                <div className="sm" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <div><Translate textKey="paymentMethod" fallback="Payment" />:</div>
                  <div>
                    {translations[language]?.[
                      ({
                        'Cash': 'cash',
                        'Cards': 'cards',
                        'Mobile Wallet': 'mobileWallets',
                        'QR Code': 'qrPayment',
                        'Bank Transfer': 'bankLinked'
                      })[receipt.paymentMethod] || 'cash'
                    ] || receipt.paymentMethod || 'Cash'}
                  </div>
                </div>
                <div className="sep"></div>
                <table className="thermal">
                  <colgroup>
                    <col style={{ width: '10mm' }} />
                    <col />
                    <col style={{ width: '12mm' }} />
                    <col style={{ width: '16mm' }} />
                    <col style={{ width: '16mm' }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th className="c">Sr</th>
                      <th className="c">Item / Product</th>
                      <th className="c">Qty</th>
                      <th className="r">Rate</th>
                      <th className="r">Amnt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {receipt.items.map((item, idx) => {
                      const qty = parseFloat(item.quantity || 1);
                      const bonus = parseFloat(item.bonus || 0);
                      const rate = Math.round(parseFloat(item.price || 0));
                      const amt = Math.round(qty * rate);
                      return (
                        <tr key={idx}>
                          <td className="c">{idx + 1}</td>
                          <td className="wrap">{item.name}</td>
                          <td className="c">{qty}{bonus > 0 ? ` + ${bonus}` : ''} {item.quantityUnit === 'kg' ? 'KG' : ''}</td>
                          <td className="r">{rate}</td>
                          <td className="r">{amt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="totals">
                  <div className="line"><span>Total</span><span>{receipt.items.reduce((s, i) => s + parseFloat(i.quantity || 0), 0).toFixed(2)}</span></div>
                  {receipt.discount > 0 && (<div className="line"><span>Discount</span><span>{Math.round(parseFloat(receipt.discount))}</span></div>)}
                  <div className="line"><span>Net Total</span><span>{Math.round(parseFloat(receipt.totalAmount))}</span></div>
                  {receipt.isLoan && (<div className="line"><span>Loan</span><span>{Math.round(parseFloat(receipt.loanAmount || 0))}</span></div>)}
                </div>
                <div className="net">{Math.round(parseFloat(receipt.totalAmount))}</div>
                <div className="center sm" style={{ marginTop: '8px' }}>Thank you For Shoping !</div>
                {receipt.shopDetails.receiptDescription && (
                  <div className="center sm" style={{ marginTop: '4px' }}>{receipt.shopDetails.receiptDescription}</div>
                )}
                <div className="dev">software developed by Soft Verse 03311041968</div>
              </div>
            </Card.Body>
          </Card>
        </div>
      </Container>
    </>
  );
};

export default ViewReceipt;
