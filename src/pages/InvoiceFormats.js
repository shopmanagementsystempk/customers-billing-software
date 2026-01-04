import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button, Badge, Alert } from 'react-bootstrap';
import { useLocation, useNavigate } from 'react-router-dom';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import Translate from '../components/Translate';
import { useAuth } from '../contexts/AuthContext';
import './ViewReceipt.css'; // Reuse some styles

const InvoiceFormats = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { shopData } = useAuth();
    const queryParams = new URLSearchParams(location.search);
    const initialFormat = queryParams.get('format') || 'thermal';
    const [selectedFormat, setSelectedFormat] = useState(initialFormat);

    useEffect(() => {
        const format = queryParams.get('format');
        if (format) {
            setSelectedFormat(format);
        }
    }, [location.search]);

    const formats = [
        {
            id: 'thermal',
            name: 'Thermal Format',
            description: 'Standard 80mm thermal printer format.',
            isDefault: true,
            icon: 'bi-printer'
        },
        {
            id: 'professional',
            name: 'Professional Format',
            description: 'Detailed formal invoice layout with full product breakdown.',
            isDefault: false,
            icon: 'bi-award'
        },
        {
            id: 'a4',
            name: 'A4 Format',
            description: 'Full-page professional A4 invoice format.',
            isDefault: false,
            icon: 'bi-file-earmark-text'
        },
        {
            id: 'modern',
            name: 'Modern Format',
            description: 'Sleek and modern design for high-end shops.',
            isDefault: false,
            icon: 'bi-stars'
        }
    ];

    const renderPreview = () => {
        const dummyReceipt = {
            transactionId: '25000005',
            timestamp: new Date().toISOString(),
            paymentMethod: 'Cash',
            totalAmount: 79,
            discount: 3,
            items: [
                {
                    name: 'Sultanpur. Store rxt can cola',
                    quantity: 1,
                    price: 82.50,
                    quantityUnit: 'pcs',
                    crtn: 0,
                    pcs: 1,
                    bns: 0,
                    tp: 82.50,
                    amount: 83,
                    disc: 3,
                    schm: 0,
                    disoPercent: 1.00,
                    netAmount: 79
                }
            ],
            shopDetails: {
                name: shopData?.shopName || 'Welcome Tarders',
                address: shopData?.address || 'Havailian',
                phone: shopData?.phoneNumber || '0331-1041968',
                logoUrl: shopData?.logoUrl,
                receiptDescription: 'software developed by Soft Verse 03311041968'
            }
        };

        if (selectedFormat === 'thermal') {
            return (
                <div className="thermal-preview-container p-3 bg-light rounded shadow-sm mx-auto" style={{ maxWidth: '400px' }}>
                    <div className="thermal-wrap bg-white p-4" style={{ border: '1px solid #ddd' }}>
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
                            .c{text-align:center}.r{text-align:right}
                            .totals{margin-top:8px;border-top:1px dotted #000;border-bottom:1px dotted #000;padding:6px 0;font-size:12px}
                            .line{display:flex;justify-content:space-between;margin:3px 0}
                            .net{ text-align:right;font-weight:700;font-size:18px;margin-top:6px }
                            .dev{ text-align:center;margin-top:10px;padding:6px 0;font-size:10px;border-top:1px dashed #000;border-bottom:1px dashed #000 }
                        `}</style>
                        <div className="center">
                            {dummyReceipt.shopDetails.logoUrl && (
                                <img src={dummyReceipt.shopDetails.logoUrl} alt="Logo" className="logo" />
                            )}
                            <div className="title">{dummyReceipt.shopDetails.name}</div>
                            <div className="sm">{dummyReceipt.shopDetails.address}</div>
                            <div className="sm">Phone # {dummyReceipt.shopDetails.phone}</div>
                        </div>
                        <div className="sep"></div>
                        <div className="sm" style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <div>Invoice: {dummyReceipt.transactionId}</div>
                            <div>{new Date().toLocaleDateString()}</div>
                        </div>
                        <div className="sep"></div>
                        <table className="thermal">
                            <thead>
                                <tr>
                                    <th className="c">Sr</th>
                                    <th className="c">Item</th>
                                    <th className="c">Qty</th>
                                    <th className="r">Rate</th>
                                    <th className="r">Amnt</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dummyReceipt.items.map((item, idx) => (
                                    <tr key={idx}>
                                        <td className="c">{idx + 1}</td>
                                        <td>{item.name}</td>
                                        <td className="c">{item.quantity}</td>
                                        <td className="r">{item.price}</td>
                                        <td className="r">{item.quantity * item.price}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        <div className="totals">
                            <div className="line"><span>Net Total</span><span>{dummyReceipt.totalAmount}</span></div>
                        </div>
                        <div className="net">{dummyReceipt.totalAmount}</div>
                        <div className="center sm" style={{ marginTop: '8px' }}>Thank you For Shopping !</div>
                        <div className="dev">{dummyReceipt.shopDetails.receiptDescription}</div>
                    </div>
                </div>
            );
        }

        if (selectedFormat === 'professional') {
            return (
                <div className="professional-preview-container p-3 bg-light rounded shadow-sm mx-auto" style={{ maxWidth: '900px' }}>
                    <div className="professional-wrap bg-white p-4 shadow-sm" style={{ color: '#000', fontFamily: 'Arial, sans-serif' }}>
                        <style>{`
                            .professional-wrap { border: 1px solid #ccc; width: 100%; }
                            .header-section { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; }
                            .header-title { font-size: 28px; font-weight: bold; margin: 0; }
                            .header-subtitle { font-size: 18px; margin: 5px 0; }
                            .header-salesman { font-size: 16px; margin: 5px 0; }
                            .invoice-type { font-size: 18px; font-weight: bold; text-decoration: underline; }
                            
                            .customer-info-section { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; }
                            .info-left p, .info-right p { margin: 5px 0; }
                            .info-label { display: inline-block; width: 120px; font-weight: 500; }
                            .info-value { font-weight: bold; }
                            
                            .professional-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
                            .professional-table th, .professional-table td { border: 1px solid #000; padding: 6px; font-size: 13px; text-align: center; }
                            .professional-table th { background-color: #f2f2f2; font-weight: bold; }
                            .professional-table td.text-left { text-align: left; }
                            .professional-table td.text-right { text-align: right; }
                            
                            .footer-section { display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px; }
                            .footer-left { width: 40%; }
                            .footer-stats p { display: flex; justify-content: space-between; margin: 4px 0; }
                            .footer-middle { width: 25%; text-align: center; display: flex; flex-direction: column; justify-content: flex-end; }
                            .signature-line { border-top: 1px solid #000; margin-top: 10px; padding-top: 5px; }
                            .footer-right { width: 30%; border: 2px solid #000; padding: 15px; text-align: center; position: relative; }
                            .total-bill-label { font-size: 16px; position: absolute; left: 10px; top: 15px; }
                            .total-bill-value { font-size: 24px; font-weight: bold; }
                            
                            .notes-section { margin-top: 20px; border-top: 1px dashed #ccc; padding-top: 10px; font-size: 12px; font-style: italic; }
                        `}</style>

                        <div className="header-section">
                            <h2 className="header-title">Welcome Tarders</h2>
                            <p className="header-subtitle">Havailian</p>
                            <p className="header-salesman">Sales-man: <span className="fw-bold">BAZAR</span></p>
                            <p className="invoice-type">SALE INVOICE</p>
                        </div>

                        <div className="customer-info-section">
                            <div className="info-left">
                                <p><span className="info-label">Customer Name:</span> <span className="info-value">AHMED G/S</span></p>
                                <p><span className="info-label">Address:</span> <span className="info-value"></span></p>
                                <p><span className="info-label">City:</span> <span className="info-value"></span></p>
                            </div>
                            <div className="info-right">
                                <p><span className="info-label">Date:</span> <span className="info-value">03-Jan-26</span></p>
                                <p><span className="info-label">Invoice No:</span> <span className="info-value">25000005</span></p>
                                <p><span className="info-label">Customer No:</span> <span className="info-value">703</span></p>
                            </div>
                        </div>

                        <table className="professional-table">
                            <thead>
                                <tr>
                                    <th style={{ width: '40px' }}>S#</th>
                                    <th>Productname</th>
                                    <th style={{ width: '50px' }}>Crtn</th>
                                    <th style={{ width: '50px' }}>Pcs</th>
                                    <th style={{ width: '50px' }}>Bns</th>
                                    <th style={{ width: '60px' }}>T.P.</th>
                                    <th style={{ width: '70px' }}>Amount</th>
                                    <th style={{ width: '50px' }}>Disc</th>
                                    <th style={{ width: '50px' }}>Schm</th>
                                    <th style={{ width: '60px' }}>Diso %</th>
                                    <th style={{ width: '80px' }}>Net Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>1</td>
                                    <td className="text-left">Sultanpur. Store<br />rxt can cola</td>
                                    <td></td>
                                    <td>1</td>
                                    <td></td>
                                    <td>82.50</td>
                                    <td>83</td>
                                    <td>3</td>
                                    <td>0</td>
                                    <td>1.00</td>
                                    <td>79</td>
                                </tr>
                                <tr className="fw-bold">
                                    <td colSpan="2" className="text-left">Total Item: 1</td>
                                    <td>0</td>
                                    <td></td>
                                    <td></td>
                                    <td></td>
                                    <td>83</td>
                                    <td></td>
                                    <td>0</td>
                                    <td></td>
                                    <td>79</td>
                                </tr>
                            </tbody>
                        </table>

                        <div className="footer-section">
                            <div className="footer-left">
                                <div className="footer-stats">
                                    <p><span>Prev Balance:</span> <span>0.71</span></p>
                                    <p><span>This Bill:</span> <span>79</span></p>
                                    <p><span>Cash Recieved:</span> <span>0.00</span></p>
                                    <p className="fw-bold"><span>New Balance:</span> <span>80</span></p>
                                </div>
                            </div>
                            <div className="footer-middle">
                                <div className="signature-line">
                                    Signature
                                </div>
                            </div>
                            <div className="footer-right">
                                <span className="total-bill-label">Total Bill :</span>
                                <span className="total-bill-value">79</span>
                            </div>
                        </div>

                        <div className="notes-section">
                            <strong>Notes:</strong> {dummyReceipt.shopDetails.receiptDescription}
                        </div>
                    </div>
                </div>
            );
        }

        return (
            <div className="text-center p-5 bg-white rounded shadow-sm border">
                <i className={`bi ${formats.find(f => f.id === selectedFormat)?.icon} fs-1 text-primary mb-3`}></i>
                <h4>{formats.find(f => f.id === selectedFormat)?.name} Preview</h4>
                <p className="text-muted">This format is coming soon. We are working on bringing more professional designs to your shop.</p>
                <div className="mt-4 border-dashed p-4 rounded text-secondary" style={{ border: '2px dashed #ccc' }}>
                    <i className="bi bi-tools me-2"></i>
                    [ Mockup Preview of {selectedFormat.toUpperCase()} Format ]
                </div>
            </div>
        );
    };

    const [applying, setApplying] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const { updateShopData } = useAuth();

    const handleApplyFormat = async () => {
        setApplying(true);
        try {
            await updateShopData({
                invoiceFormat: selectedFormat
            });
            setSuccessMsg(`Successfully applied ${formats.find(f => f.id === selectedFormat)?.name}!`);
            setTimeout(() => setSuccessMsg(''), 3000);
        } catch (error) {
            console.error("Error applying format:", error);
        } finally {
            setApplying(false);
        }
    };

    return (
        <>
            <MainNavbar />
            <Container className="pos-content">
                <PageHeader
                    title={<Translate textKey="invoiceFormats" fallback="Invoice Formats" />}
                    icon="bi-file-earmark-spreadsheet"
                    subtitle="Explore and select different invoice formats for your shop receipts."
                />

                {successMsg && (
                    <Alert variant="success" className="mb-4">
                        <i className="bi bi-check-circle-fill me-2"></i> {successMsg}
                    </Alert>
                )}

                <Row>
                    <Col lg={4}>
                        <h5 className="mb-4">Available Formats</h5>
                        {formats.map(format => (
                            <Card
                                key={format.id}
                                className={`mb-3 cursor-pointer format-card ${selectedFormat === format.id ? 'border-primary bg-primary bg-opacity-10' : ''}`}
                                onClick={() => navigate(`/invoice-formats?format=${format.id}`)}
                                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                            >
                                <Card.Body className="d-flex align-items-center">
                                    <div className={`format-icon-bg rounded p-3 me-3 ${selectedFormat === format.id ? 'bg-primary text-white' : 'bg-light text-primary'}`}>
                                        <i className={`bi ${format.icon} fs-4`}></i>
                                    </div>
                                    <div className="flex-grow-1">
                                        <div className="d-flex justify-content-between align-items-start">
                                            <h6 className="mb-1">{format.name}</h6>
                                            {(format.isDefault && !shopData?.invoiceFormat) || shopData?.invoiceFormat === format.id ? (
                                                <Badge bg="success" size="sm">Active</Badge>
                                            ) : null}
                                        </div>
                                        <p className="text-muted small mb-0">{format.description}</p>
                                    </div>
                                    {selectedFormat === format.id && (
                                        <i className="bi bi-check-circle-fill text-primary ms-2"></i>
                                    )}
                                </Card.Body>
                            </Card>
                        ))}

                        <Card className="mt-4 border-warning bg-warning bg-opacity-10">
                            <Card.Body>
                                <h6 className="text-warning-emphasis"><i className="bi bi-info-circle me-2"></i>Note</h6>
                                <p className="small mb-0 text-warning-emphasis">
                                    The selected format will be applied to all your generated receipts and invoices automatically.
                                </p>
                            </Card.Body>
                        </Card>
                    </Col>

                    <Col lg={8}>
                        <div className="sticky-top" style={{ top: '2rem' }}>
                            <div className="d-flex justify-content-between align-items-center mb-4">
                                <h5 className="mb-0">Format Preview</h5>
                                <div className="d-flex gap-2">
                                    <Button
                                        variant="primary"
                                        size="sm"
                                        onClick={handleApplyFormat}
                                        disabled={applying || shopData?.invoiceFormat === selectedFormat}
                                    >
                                        {applying ? (
                                            <><span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span> Applying...</>
                                        ) : (
                                            <><i className="bi bi-check2-all me-1"></i> Apply Format</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                            {renderPreview()}
                        </div>
                    </Col>
                </Row>
            </Container>

            <style>{`
                .format-card:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                .cursor-pointer {
                    cursor: pointer;
                }
            `}</style>
        </>
    );
};

export default InvoiceFormats;
