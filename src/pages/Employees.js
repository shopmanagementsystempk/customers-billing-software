import React, { useState, useEffect } from 'react';
import { Container, Table, Button, Card, Row, Col, Alert, Modal } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import QRCode from 'react-qr-code';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import './Employees.css'; // Import the custom CSS
import { Translate, useTranslatedAttribute, translations } from '../utils';
import { formatDisplayDate } from '../utils/dateUtils';

const Employees = () => {
  const { currentUser, activeShopId } = useAuth();
  const { language } = useLanguage();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const navigate = useNavigate();
  
  // Get translations for attributes
  const getTranslatedAttr = useTranslatedAttribute();

  useEffect(() => {
    const fetchEmployees = async () => {
      if (!currentUser || !activeShopId) return;

      try {
        setLoading(true);
        const employeesRef = collection(db, 'employees');
        const employeesQuery = query(
          employeesRef,
          where('shopId', '==', activeShopId)
        );

        const snapshot = await getDocs(employeesQuery);
        const employeesList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        setEmployees(employeesList);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError('Failed to load employees. Please try again.');
        setLoading(false);
      }
    };

    fetchEmployees();
  }, [currentUser, activeShopId]);

  const handleDelete = async (employeeId) => {
    if (window.confirm(getTranslatedAttr('confirmDeleteEmployee'))) {
      try {
        await deleteDoc(doc(db, 'employees', employeeId));
        setEmployees(employees.filter(emp => emp.id !== employeeId));
      } catch (err) {
        console.error('Error deleting employee:', err);
        setError(getTranslatedAttr('failedToDeleteEmployee'));
      }
    }
  };

  const handleViewQR = (employee) => {
    setSelectedEmployee(employee);
    setShowQRModal(true);
  };

  const handleDownloadQR = (employee) => {
    const svg = document.getElementById(`qr-code-${employee.id}`);
    if (!svg) return;
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `${employee.name}_QR_Code.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <>
      <MainNavbar />
      <Container>
        <PageHeader 
          title={<Translate textKey="employees" fallback="Employees" />} 
          icon="bi-people" 
          subtitle={<Translate textKey="employeesSubtitle" fallback="Manage your team, update roles, and keep employee information centralized." />}
        />
        <div className="page-header-actions">
          <Button 
            variant="outline-primary"
            onClick={() => navigate('/employee-cards')}
          >
            <Translate textKey="qrCards" fallback="QR Cards" />
          </Button>
          <Button 
            variant="success" 
            onClick={() => navigate('/add-employee')}
          >
            <Translate textKey="addNewEmployee" />
          </Button>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        <Card>
          <Card.Body>
            {loading ? (
              <p className="text-center"><Translate textKey="loadingEmployees" /></p>
            ) : employees.length > 0 ? (
              <div className="table-responsive employee-table-container">
                <Table striped hover responsive="sm" className="employees-table">
                  <thead>
                    <tr>
                      <th><Translate textKey="name" /></th>
                      <th><Translate textKey="position" /></th>
                      <th><Translate textKey="contact" /></th>
                      <th><Translate textKey="email" /></th>
                      <th><Translate textKey="joiningDate" /></th>
                      <th>QR Code</th>
                      <th><Translate textKey="actions" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map(employee => (
                      <tr key={employee.id}>
                        <td data-label={getTranslatedAttr("name")} className="text-nowrap">{employee.name}</td>
                        <td data-label={getTranslatedAttr("position")}>{employee.position}</td>
                        <td data-label={getTranslatedAttr("contact")}>{employee.contact}</td>
                        <td data-label={getTranslatedAttr("email")} className="email-cell">{employee.email}</td>
                        <td data-label={getTranslatedAttr("joiningDate")}>{formatDisplayDate(employee.joiningDate)}</td>
                        <td data-label="QR Code">
                          {employee.qrCodeId ? (
                            <Button
                              variant="outline-info"
                              size="sm"
                              onClick={() => handleViewQR(employee)}
                            >
                              <Translate textKey="viewQR" fallback="View QR" />
                            </Button>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td data-label={getTranslatedAttr("actions")}>
                          <Button
                            variant="outline-primary"
                            size="sm"
                            className="me-2"
                            onClick={() => navigate(`/edit-employee/${employee.id}`)}
                          >
                            <Translate textKey="edit" />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => handleDelete(employee.id)}
                          >
                            <Translate textKey="delete" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <p className="text-center"><Translate textKey="noEmployeesFound" /></p>
            )}
          </Card.Body>
        </Card>

        {/* QR Code Modal */}
        <Modal show={showQRModal} onHide={() => setShowQRModal(false)} centered>
          <Modal.Header closeButton>
            <Modal.Title>
              {selectedEmployee && (
                <>
                  {selectedEmployee.name}{translations[language]?.sQRCode || "'s QR Code"}
                </>
              )}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center">
            {selectedEmployee && selectedEmployee.qrCodeId && (
              <>
                <div className="mb-3" style={{ display: 'flex', justifyContent: 'center', padding: '20px', backgroundColor: 'white' }}>
                  <QRCode
                    id={`qr-code-${selectedEmployee.id}`}
                    value={selectedEmployee.qrCodeId}
                    size={256}
                    style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                  />
                </div>
                <p className="text-muted mb-3">
                  <Translate textKey="employeeLabel" fallback="Employee:" /> <strong>{selectedEmployee.name}</strong>
                </p>
                <p className="text-muted small">
                  <Translate textKey="scanQRHelp" fallback="Scan this QR code to mark attendance" />
                </p>
              </>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowQRModal(false)}>
              <Translate textKey="close" fallback="Close" />
            </Button>
            {selectedEmployee && selectedEmployee.qrCodeId && (
              <Button variant="primary" onClick={() => handleDownloadQR(selectedEmployee)}>
                <Translate textKey="downloadQR" fallback="Download QR Code" />
              </Button>
            )}
          </Modal.Footer>
        </Modal>
      </Container>
    </>
  );
};

export default Employees; 