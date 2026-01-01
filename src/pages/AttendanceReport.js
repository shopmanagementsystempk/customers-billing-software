import React, { useState, useEffect, useRef } from 'react';
import { Container, Card, Table, Button, Form, Row, Col, Alert, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './AttendanceReport.css'; // Import the CSS for responsive styles
import PageHeader from '../components/PageHeader';
import { Translate, useTranslatedAttribute } from '../utils';

const AttendanceReport = () => {
  const { currentUser, shopData, activeShopId } = useAuth();
  const navigate = useNavigate();
  const reportRef = useRef(null);
  const getTranslatedAttr = useTranslatedAttribute();

  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // Tab state
  const [reportType, setReportType] = useState('monthly');

  // Monthly report filters
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedEmployee, setSelectedEmployee] = useState('all');

  // Date range filters
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedEmployeeRange, setSelectedEmployeeRange] = useState('all');

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      if (!currentUser || !activeShopId) return;

      try {
        setEmployees([]);
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
      } catch (err) {
        console.error('Error fetching employees:', err);
        setError(getTranslatedAttr('failedToLoadEmployees'));
        setEmployees([]);
      }
    };

    fetchEmployees();
  }, [currentUser, activeShopId]);

  // Generate attendance report when filters change
  useEffect(() => {
    const generateReport = async () => {
      if (!currentUser) {
        setLoading(false);
        setAttendance([]);
        return;
      }

      try {
        setLoading(true);

        // If no employees, still set loading to false and show empty state
        if (employees.length === 0) {
          setAttendance([]);
          setLoading(false);
          return;
        }

        let startDateStr, endDateStr;

        if (reportType === 'monthly') {
          // Calculate the date range for the selected month
          const startDate = new Date(selectedYear, selectedMonth, 1);
          const endDate = new Date(selectedYear, parseInt(selectedMonth) + 1, 0);

          startDateStr = startDate.toISOString().split('T')[0];
          endDateStr = endDate.toISOString().split('T')[0];
        } else {
          // Use the date range selected by the user
          startDateStr = startDate;
          endDateStr = endDate;
        }

        // Modified approach to avoid requiring a composite index
        // First, query by shopId only, then filter the results in memory
        const attendanceRef = collection(db, 'attendance');
        const attendanceQuery = query(
          attendanceRef,
          where('shopId', '==', activeShopId)
        );

        const snapshot = await getDocs(attendanceQuery);
        const allAttendance = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Filter by date range and employee if needed
        const filteredAttendance = allAttendance.filter(record => {
          const recordDate = record.date;
          const isInDateRange = recordDate >= startDateStr && recordDate <= endDateStr;

          const selectedEmp = reportType === 'monthly' ? selectedEmployee : selectedEmployeeRange;

          if (selectedEmp === 'all') {
            return isInDateRange;
          } else {
            return isInDateRange && record.employeeId === selectedEmp;
          }
        });

        // Process attendance data
        const attendanceData = [];

        // Create a mapping of employeeId to name
        const employeeMap = {};
        employees.forEach(emp => {
          employeeMap[emp.id] = emp.name;
        });

        // Group attendance by employee
        const groupedAttendance = {};

        filteredAttendance.forEach(record => {
          if (!groupedAttendance[record.employeeId]) {
            groupedAttendance[record.employeeId] = [];
          }

          groupedAttendance[record.employeeId].push(record);
        });

        // Create attendance summary for each employee
        for (const employeeId in groupedAttendance) {
          const employeeRecords = groupedAttendance[employeeId];

          // Count different attendance statuses
          const present = employeeRecords.filter(record => record.status === 'present').length;
          const absent = employeeRecords.filter(record => record.status === 'absent').length;
          const halfDay = employeeRecords.filter(record => record.status === 'half-day').length;
          const leave = employeeRecords.filter(record => record.status === 'leave').length;

          // Calculate attendance percentage
          const totalDays = employeeRecords.length;
          const presentEquivalent = present + (halfDay * 0.5);
          const attendancePercentage = totalDays > 0
            ? ((presentEquivalent / totalDays) * 100).toFixed(2)
            : '0.00';

          attendanceData.push({
            employeeId,
            name: employeeMap[employeeId] || getTranslatedAttr('unknownEmployee'),
            totalDays,
            present,
            absent,
            halfDay,
            leave,
            attendancePercentage
          });
        }

        setAttendance(attendanceData);
      } catch (err) {
        console.error('Error generating attendance report:', err);
        setError(getTranslatedAttr('failedToLoadAttendance'));
        setAttendance([]);
      } finally {
        setLoading(false);
      }
    };

    generateReport();
  }, [currentUser, employees, selectedMonth, selectedYear, selectedEmployee, reportType, startDate, endDate, selectedEmployeeRange, activeShopId]);

  const months = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
  ];

  const generateYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const options = [];

    for (let year = currentYear; year >= currentYear - 3; year--) {
      options.push(
        <option key={year} value={year}>{year}</option>
      );
    }

    return options;
  };

  const handleGeneratePDF = async () => {
    if (!reportRef.current) return;

    try {
      setGeneratingPdf(true);

      const reportElement = reportRef.current;
      const canvas = await html2canvas(reportElement, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 20;

      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);

      let pdfName;
      if (reportType === 'monthly') {
        pdfName = `Attendance_Report_${months[selectedMonth]}_${selectedYear}.pdf`;
      } else {
        pdfName = `Attendance_Report_${startDate}_to_${endDate}.pdf`;
      }

      pdf.save(pdfName);

      setGeneratingPdf(false);
    } catch (err) {
      setError(getTranslatedAttr('error'));
      setGeneratingPdf(false);
    }
  };

  const handleTabChange = (key) => {
    setReportType(key);
  };

  return (
    <>
      <MainNavbar />
      <Container>
        <PageHeader
          title={<Translate textKey="attendanceReport" />}
          icon="bi-clipboard-data"
          subtitle={<Translate textKey="attendanceReportSubtitle" />}
        />

        {error && <Alert variant="danger">{error}</Alert>}

        <Card className="mb-4">
          <Card.Body>
            <Tabs
              activeKey={reportType}
              onSelect={handleTabChange}
              className="mb-3"
            >
              <Tab eventKey="monthly" title={getTranslatedAttr("monthlyReport")}>
                <Row className="report-filters">
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label><Translate textKey="month" /></Form.Label>
                      <Form.Select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                      >
                        {months.map((month, index) => (
                          <option key={index} value={index}>{getTranslatedAttr(month)}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label><Translate textKey="yearly" /></Form.Label>
                      <Form.Select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                      >
                        {generateYearOptions()}
                      </Form.Select>
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label><Translate textKey="employee" /></Form.Label>
                      <Form.Select
                        value={selectedEmployee}
                        onChange={(e) => setSelectedEmployee(e.target.value)}
                      >
                        <option value="all">{getTranslatedAttr("allEmployees")}</option>
                        {employees.map(employee => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>

              <Tab eventKey="dateRange" title={getTranslatedAttr("dateRangeReport")}>
                <Row className="report-filters">
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label><Translate textKey="startDate" /></Form.Label>
                      <Form.Control
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label><Translate textKey="endDate" /></Form.Label>
                      <Form.Control
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                      />
                    </Form.Group>
                  </Col>

                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label><Translate textKey="employee" /></Form.Label>
                      <Form.Select
                        value={selectedEmployeeRange}
                        onChange={(e) => setSelectedEmployeeRange(e.target.value)}
                      >
                        <option value="all">{getTranslatedAttr("allEmployees")}</option>
                        {employees.map(employee => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
              </Tab>
            </Tabs>
          </Card.Body>
        </Card>

        <div ref={reportRef}>
          <Card>
            <Card.Body>
              <div className="text-center mb-4">
                <h3>{shopData?.shopName || getTranslatedAttr('shop')}</h3>
                <h5><Translate textKey="attendanceReport" /></h5>
                {reportType === 'monthly' ? (
                  <p>{getTranslatedAttr(months[selectedMonth])} {selectedYear}</p>
                ) : (
                  <p><Translate textKey="from" fallback="From" /> {startDate} <Translate textKey="to" fallback="to" /> {endDate}</p>
                )}
              </div>

              {loading ? (
                <p className="text-center"><Translate textKey="loading" />...</p>
              ) : attendance.length > 0 ? (
                <div className="report-table-container">
                  <Table striped bordered hover className="report-table">
                    <thead>
                      <tr>
                        <th><Translate textKey="employee" /></th>
                        <th><Translate textKey="workingDays" /></th>
                        <th><Translate textKey="present" /></th>
                        <th><Translate textKey="absent" /></th>
                        <th><Translate textKey="halfDay" /></th>
                        <th><Translate textKey="onLeave" /></th>
                        <th><Translate textKey="attendancePercentage" /></th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance.map(record => (
                        <tr key={record.employeeId}>
                          <td data-label={getTranslatedAttr("employee")}>{record.name}</td>
                          <td data-label={getTranslatedAttr("workingDays")}>{record.totalDays}</td>
                          <td data-label={getTranslatedAttr("present")}>{record.present}</td>
                          <td data-label={getTranslatedAttr("absent")}>{record.absent}</td>
                          <td data-label={getTranslatedAttr("halfDay")}>{record.halfDay}</td>
                          <td data-label={getTranslatedAttr("onLeave")}>{record.leave}</td>
                          <td data-label={getTranslatedAttr("attendancePercentage")}>{record.attendancePercentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="text-center"><Translate textKey="noAttendanceRecords" /></p>
              )}
            </Card.Body>
          </Card>
        </div>

        <div className="d-flex justify-content-between mt-4 report-actions">
          <Button variant="secondary" onClick={() => navigate('/attendance')}>
            <Translate textKey="backToAttendance" fallback="Back to Attendance" />
          </Button>

          <Button
            variant="primary"
            onClick={handleGeneratePDF}
            disabled={generatingPdf || attendance.length === 0}
          >
            {generatingPdf ? `${getTranslatedAttr("loading")}...` : getTranslatedAttr("downloadPDF")}
          </Button>
        </div>
      </Container>
    </>
  );
};

export default AttendanceReport; 