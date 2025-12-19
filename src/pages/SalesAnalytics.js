import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Container, Card, Button, Row, Col, Form, Table, Spinner, Alert, ButtonGroup, Dropdown } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { formatCurrency } from '../utils/receiptUtils';
import { getDailySalesAndProfit, getMonthlySalesAndProfit, getYearlySalesAndProfit } from '../utils/salesUtils';
import { formatDisplayDate } from '../utils/dateUtils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './SalesAnalytics.css';
import { Translate } from '../utils';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';
import 'echarts-gl';

// Memoized category row component to prevent unnecessary re-renders
const CategoryRow = React.memo(({ category, index }) => (
  <tr>
    <td>{category.category}</td>
    <td>{formatCurrency(category.sales)}</td>
    <td>{formatCurrency(category.profit)}</td>
    <td>{category.profitMargin}%</td>
    <td>{category.items}</td>
  </tr>
));

// Memoized category progress bar component
const CategoryProgressBar = React.memo(({ category, index, totalSales }) => {
  // Calculate percentage of total sales
  const percentage = totalSales > 0 
    ? (category.sales / totalSales * 100).toFixed(1) 
    : 0;
  
  return (
    <div className="mb-2">
      <div className="d-flex justify-content-between mb-1">
        <span>{category.category}</span>
        <span>{formatCurrency(category.sales)} ({percentage}%)</span>
      </div>
      <div className="progress" style={{ height: '20px' }}>
        <div 
          className="progress-bar" 
          role="progressbar" 
          style={{ 
            width: `${percentage}%`,
            backgroundColor: `hsl(${210 - index * 30}, 70%, 50%)` // Different color for each category
          }} 
          aria-valuenow={percentage} 
          aria-valuemin="0" 
          aria-valuemax="100"
        >
          {percentage > 5 ? `${percentage}%` : ''}
        </div>
      </div>
    </div>
  );
});

// Memoized daily data row component
const DailyDataRow = React.memo(({ day }) => {
  const profitMargin = day.sales > 0 ? ((day.profit / day.sales) * 100).toFixed(2) : 0;
  
  return (
    <tr>
      <td>{day.day}</td>
      <td>{formatCurrency(day.sales)}</td>
      <td>{formatCurrency(day.profit)}</td>
      <td>{profitMargin}%</td>
    </tr>
  );
});

// Memoized monthly data row component
const MonthlyDataRow = React.memo(({ month }) => {
  const profitMargin = month.sales > 0 ? ((month.profit / month.sales) * 100).toFixed(2) : 0;
  
  return (
    <tr>
      <td>{month.month}</td>
      <td>{formatCurrency(month.sales)}</td>
      <td>{formatCurrency(month.profit)}</td>
      <td>{profitMargin}%</td>
    </tr>
  );
});

// Memoized product sales by employee row component
const ProductSalesRow = React.memo(({ product }) => {
  const profitMargin = product.totalSales > 0 ? ((product.profit / product.totalSales) * 100).toFixed(2) : 0;
  
  return (
    <tr>
      <td>{product.productName}</td>
      <td>{product.employeeName}</td>
      <td>{product.date}</td>
      <td>{product.time}</td>
      <td>{product.quantity}</td>
      <td>{formatCurrency(product.price)}</td>
      <td>{formatCurrency(product.totalSales)}</td>
      <td>{formatCurrency(product.profit)}</td>
      <td>{profitMargin}%</td>
      <td>{product.category}</td>
    </tr>
  );
});

const SalesAnalytics = () => {
  const { currentUser, activeShopId } = useAuth();
  const [viewMode, setViewMode] = useState('daily'); // 'daily', 'monthly', 'yearly'
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Memoized function to fetch analytics data
  const fetchAnalyticsData = useCallback(async () => {
    if (!currentUser) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Add validation for date and fallback to current date if invalid
      let date;
      try {
        date = new Date(selectedDate);
        // Check if date is valid
        if (isNaN(date.getTime())) {
          date = new Date(); // Fallback to current date
        }
      } catch (e) {
        date = new Date(); // Fallback to current date
      }
      
      let data;
      
      switch (viewMode) {
        case 'daily':
          data = await getDailySalesAndProfit(activeShopId, date);
          break;
        case 'monthly':
          data = await getMonthlySalesAndProfit(activeShopId, date);
          break;
        case 'yearly':
          data = await getYearlySalesAndProfit(activeShopId, date);
          break;
        default:
          data = await getDailySalesAndProfit(activeShopId, date);
      }
      
      setAnalytics(data);
    } catch (error) {
      // Only log minimal error details, not the full error object
      console.log('Analytics data fetch issue:', error.message || 'Error fetching data');
      
      // Set user-friendly error message without exposing internal details
      setError('Failed to load analytics data. Please try again later.');
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [currentUser, activeShopId, viewMode, selectedDate]);

  useEffect(() => {
    fetchAnalyticsData();
  }, [fetchAnalyticsData]);

  // Handle date selector based on view mode - memoized to prevent unnecessary recalculations
  const renderDateSelector = useMemo(() => {
    switch (viewMode) {
      case 'daily':
        return (
          <div className="position-relative">
            <Form.Control
              type="text"
              value={selectedDate ? formatDisplayDate(new Date(selectedDate)) : ''}
              readOnly
              onClick={() => {
                const dateInput = document.getElementById('hidden-date-input');
                if (dateInput) {
                  dateInput.showPicker ? dateInput.showPicker() : dateInput.click();
                }
              }}
              style={{ cursor: 'pointer' }}
            />
            <input
              id="hidden-date-input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{
                position: 'absolute',
                opacity: 0,
                width: '100%',
                height: '100%',
                cursor: 'pointer',
                top: 0,
                left: 0
              }}
            />
            <i className="bi bi-calendar" style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
              color: '#6c757d'
            }}></i>
          </div>
        );
      case 'monthly':
        return (
          <Form.Control
            type="month"
            value={selectedDate.substring(0, 7)}
            onChange={(e) => setSelectedDate(`${e.target.value}-01`)}
          />
        );
      case 'yearly':
        return (
          <Form.Control
            type="number"
            min="2000"
            max="2100"
            value={selectedDate.substring(0, 4)}
            onChange={(e) => setSelectedDate(`${e.target.value}-01-01`)}
          />
        );
      default:
        return null;
    }
  }, [viewMode, selectedDate]);

  // Memoized calculation of profit margin
  const profitMargin = useMemo(() => {
    if (!analytics || analytics.sales <= 0) return 0;
    return ((analytics.profit / analytics.sales) * 100).toFixed(2);
  }, [analytics]);

  // Build 3D Profit & Loss chart options (Sales vs Profit over time)
  const threeDOptions = useMemo(() => {
    if (!analytics) return null;
    const timeSeries = analytics.dailyData || analytics.monthlyData;
    if (!timeSeries || timeSeries.length === 0) return null;
  
    const xAxisCategories = timeSeries.map(item => item.day || item.month);
    const yAxisCategories = ['Sales', 'Profit'];
    const data = [];
    let maxValue = 0;
  
    timeSeries.forEach((item, xi) => {
      const salesVal = Number(item.sales || 0);
      const profitVal = Number(item.profit || 0);
      maxValue = Math.max(maxValue, salesVal, profitVal);
      data.push([xi, 0, salesVal]);
      data.push([xi, 1, profitVal]);
    });
  
    return {
      tooltip: {
        formatter: params => {
          const xLabel = xAxisCategories[params.value[0]];
          const yLabel = yAxisCategories[params.value[1]];
          const val = params.value[2];
          return `${yLabel} on ${xLabel}: ${formatCurrency(val)}`;
        }
      },
      visualMap: {
        max: maxValue || 1,
        inRange: {
          color: ['#0d6efd', '#6f42c1', '#198754']
        }
      },
      xAxis3D: {
        type: 'category',
        data: xAxisCategories,
        name: analytics.dailyData ? 'Day' : 'Month'
      },
      yAxis3D: {
        type: 'category',
        data: yAxisCategories,
        name: 'Metric'
      },
      zAxis3D: {
        type: 'value',
        name: 'Amount'
      },
      grid3D: {
        boxWidth: 120,
        boxDepth: 60,
        light: {
          main: { intensity: 1.2, shadow: true },
          ambient: { intensity: 0.3 }
        },
        viewControl: {
          projection: 'perspective',
          autoRotate: true,
          autoRotateSpeed: 8
        }
      },
      series: [{
        type: 'bar3D',
        data,
        shading: 'lambert',
        itemStyle: {
          opacity: 0.9
        },
        label: {
          show: false
        }
      }]
    };
  }, [analytics]);

  // Generate employee sales summary
  const generateEmployeeSummary = useMemo(() => {
    if (!analytics || !analytics.productSalesByEmployee || analytics.productSalesByEmployee.length === 0) {
      return [];
    }

    const summary = {};
    analytics.productSalesByEmployee.forEach(product => {
      const empName = product.employeeName;
      if (!summary[empName]) {
        summary[empName] = {
          employeeName: empName,
          totalSales: 0,
          totalProfit: 0,
          totalItems: 0,
          productCount: 0,
          transactions: new Set()
        };
      }
      summary[empName].totalSales += product.totalSales;
      summary[empName].totalProfit += product.profit;
      summary[empName].totalItems += product.quantity;
      summary[empName].productCount += 1;
      summary[empName].transactions.add(product.transactionId);
    });

    // Convert Set to count and calculate profit margin
    return Object.keys(summary).map(empName => {
      const emp = summary[empName];
      return {
        ...emp,
        transactionCount: emp.transactions.size,
        profitMargin: emp.totalSales > 0 ? ((emp.totalProfit / emp.totalSales) * 100).toFixed(2) : 0
      };
    }).sort((a, b) => b.totalSales - a.totalSales);
  }, [analytics]);

  // Generate CSV report
  const generateCSVReport = useCallback(() => {
    if (!analytics || !analytics.productSalesByEmployee || analytics.productSalesByEmployee.length === 0) {
      alert('No data available to export');
      return;
    }

    // CSV Headers
    const headers = ['Product', 'Employee', 'Date', 'Time', 'Quantity', 'Unit Price', 'Total Sales', 'Profit', 'Profit Margin (%)', 'Category', 'Transaction ID'];
    
    // CSV Rows
    const rows = analytics.productSalesByEmployee.map(product => [
      product.productName,
      product.employeeName,
      product.date,
      product.time,
      product.quantity,
      product.price.toFixed(2),
      product.totalSales.toFixed(2),
      product.profit.toFixed(2),
      (product.totalSales > 0 ? ((product.profit / product.totalSales) * 100).toFixed(2) : 0),
      product.category,
      product.transactionId
    ]);

    // Add employee summary section
    const summaryHeaders = ['Employee Summary'];
    const summarySection = generateEmployeeSummary.length > 0 ? [
      [],
      ['Employee', 'Total Sales', 'Total Profit', 'Profit Margin (%)', 'Items Sold', 'Products Sold', 'Transactions'],
      ...generateEmployeeSummary.map(emp => [
        emp.employeeName,
        emp.totalSales.toFixed(2),
        emp.totalProfit.toFixed(2),
        emp.profitMargin,
        emp.totalItems,
        emp.productCount,
        emp.transactionCount
      ])
    ] : [];

    // Combine all data
    const csvContent = [
      ['Employee Sales Report'],
      [`Generated: ${formatDisplayDate(new Date())}`],
      [`Period: ${viewMode} view - ${selectedDate}`],
      [],
      ['Detailed Product Sales'],
      headers,
      ...rows,
      [],
      ...summarySection
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `employee_sales_report_${viewMode}_${selectedDate.replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [analytics, generateEmployeeSummary, viewMode, selectedDate]);

  // Generate PDF report
  const generatePDFReport = useCallback(async () => {
    if (!analytics || !analytics.productSalesByEmployee || analytics.productSalesByEmployee.length === 0) {
      alert('No data available to export');
      return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;
    let xPos = margin;
    const lineHeight = 7;
    const maxY = pageHeight - margin;

    // Helper function to add new page if needed
    const checkNewPage = (requiredSpace) => {
      if (yPosition + requiredSpace > maxY) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Title
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Employee Sales Report', margin, yPosition);
    yPosition += lineHeight * 1.5;

    // Report Info
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(`Generated: ${formatDisplayDate(new Date())}`, margin, yPosition);
    yPosition += lineHeight;
    pdf.text(`Period: ${viewMode} view - ${selectedDate}`, margin, yPosition);
    yPosition += lineHeight * 1.5;

    // Employee Summary Section
    if (generateEmployeeSummary.length > 0) {
      pdf.setFontSize(14);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Employee Summary', margin, yPosition);
      yPosition += lineHeight * 1.5;

      pdf.setFontSize(9);
      pdf.setFont('helvetica', 'bold');
      const summaryHeaders = ['Employee', 'Sales', 'Profit', 'Margin %', 'Items', 'Transactions'];
      const summaryColWidths = [50, 30, 30, 25, 20, 30];
      xPos = margin;
      
      summaryHeaders.forEach((header, index) => {
        pdf.text(header, xPos, yPosition);
        xPos += summaryColWidths[index];
      });
      yPosition += lineHeight;

      pdf.setFont('helvetica', 'normal');
      generateEmployeeSummary.forEach(emp => {
        checkNewPage(lineHeight * 2);
        xPos = margin;
        pdf.text(emp.employeeName.substring(0, 20), xPos, yPosition);
        xPos += summaryColWidths[0];
        pdf.text(formatCurrency(emp.totalSales), xPos, yPosition);
        xPos += summaryColWidths[1];
        pdf.text(formatCurrency(emp.totalProfit), xPos, yPosition);
        xPos += summaryColWidths[2];
        pdf.text(`${emp.profitMargin}%`, xPos, yPosition);
        xPos += summaryColWidths[3];
        pdf.text(emp.totalItems.toString(), xPos, yPosition);
        xPos += summaryColWidths[4];
        pdf.text(emp.transactionCount.toString(), xPos, yPosition);
        yPosition += lineHeight;
      });

      yPosition += lineHeight;
    }

    // Detailed Product Sales Section
    checkNewPage(lineHeight * 3);
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Detailed Product Sales', margin, yPosition);
    yPosition += lineHeight * 1.5;

    // Table headers
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    const headers = ['Product', 'Employee', 'Date', 'Qty', 'Price', 'Sales', 'Profit'];
    const colWidths = [40, 30, 25, 15, 20, 25, 25];
    
    xPos = margin;
    headers.forEach((header, index) => {
      pdf.text(header, xPos, yPosition);
      xPos += colWidths[index];
    });
    yPosition += lineHeight;
    
    // Draw line under headers
    pdf.setLineWidth(0.5);
    pdf.line(margin, yPosition - 2, pageWidth - margin, yPosition - 2);
    yPosition += 2;

    // Table rows
    pdf.setFont('helvetica', 'normal');
    analytics.productSalesByEmployee.forEach((product, index) => {
      checkNewPage(lineHeight * 2);
      
      xPos = margin;
      pdf.text(product.productName.substring(0, 18), xPos, yPosition);
      xPos += colWidths[0];
      pdf.text(product.employeeName.substring(0, 15), xPos, yPosition);
      xPos += colWidths[1];
      pdf.text(product.date, xPos, yPosition);
      xPos += colWidths[2];
      pdf.text(product.quantity.toString(), xPos, yPosition);
      xPos += colWidths[3];
      pdf.text(product.price.toFixed(2), xPos, yPosition);
      xPos += colWidths[4];
      pdf.text(product.totalSales.toFixed(2), xPos, yPosition);
      xPos += colWidths[5];
      pdf.text(product.profit.toFixed(2), xPos, yPosition);
      
      yPosition += lineHeight;
      
      // Add line every 10 rows for readability
      if ((index + 1) % 10 === 0) {
        pdf.setLineWidth(0.1);
        pdf.line(margin, yPosition, pageWidth - margin, yPosition);
        yPosition += 2;
      }
    });

    // Save PDF
    pdf.save(`employee_sales_report_${viewMode}_${selectedDate.replace(/\//g, '-')}.pdf`);
  }, [analytics, generateEmployeeSummary, viewMode, selectedDate]);

  // Render basic summary - memoized to prevent unnecessary recalculations
  const renderSummary = useMemo(() => {
    if (!analytics) return null;

    return (
      <>
        <Row className="mb-4">
          <Col md={3} className="d-flex">
            <Card className="text-center p-3 mb-3 shadow-sm analytics-card h-100 w-100">
              <Card.Title><Translate textKey="totalSales" fallback="Total Sales" /></Card.Title>
              <Card.Text className="display-6">{formatCurrency(analytics.sales)}</Card.Text>
            </Card>
          </Col>
          <Col md={3} className="d-flex">
            <Card className="text-center p-3 mb-3 shadow-sm analytics-card h-100 w-100">
              <Card.Title><Translate textKey="totalProfit" fallback="Total Profit" /></Card.Title>
              <Card.Text className="display-6">{formatCurrency(analytics.profit)}</Card.Text>
              <small className="text-muted">{profitMargin}% margin</small>
            </Card>
          </Col>
          <Col md={3} className="d-flex">
            <Card className="text-center p-3 mb-3 shadow-sm analytics-card h-100 w-100">
              <Card.Title><Translate textKey="itemsSold" fallback="Items Sold" /></Card.Title>
              <Card.Text className="display-6">{analytics.totalItems}</Card.Text>
            </Card>
          </Col>
          <Col md={3} className="d-flex">
            <Card className="text-center p-3 mb-3 shadow-sm analytics-card h-100 w-100">
              <Card.Title><Translate textKey="transactions" fallback="Transactions" /></Card.Title>
              <Card.Text className="display-6">{analytics.transactionCount}</Card.Text>
            </Card>
          </Col>
        </Row>
        
        <Row className="mb-4">
          <Col md={12}>
            <Card className="shadow-sm profit-breakdown-card">
              <Card.Body>
                <h5><Translate textKey="profitBreakdown" fallback="Profit Breakdown" /></h5>
                <Row className="mt-3">
                  <Col xs={12} md={4} className="mb-2">
                    <div className="d-flex justify-content-between">
                      <span><Translate textKey="sales" fallback="Sales" />:</span>
                      <strong>{formatCurrency(analytics.sales)}</strong>
                    </div>
                  </Col>
                  <Col xs={12} md={4} className="mb-2">
                    <div className="d-flex justify-content-between">
                      <span><Translate textKey="profit" fallback="Profit" />:</span>
                      <strong>{formatCurrency(analytics.profit)}</strong>
                    </div>
                  </Col>
                  <Col xs={12} md={4} className="mb-2">
                    <div className="d-flex justify-content-between">
                      <span><Translate textKey="profitMargin" fallback="Profit Margin" />:</span>
                      <strong>{profitMargin}%</strong>
                    </div>
                  </Col>
                </Row>
                <div className="progress mt-2" style={{ height: '25px' }}>
                  <div 
                    className="progress-bar bg-success" 
                    role="progressbar" 
                    style={{ width: `${profitMargin}%` }} 
                    aria-valuenow={profitMargin} 
                    aria-valuemin="0" 
                    aria-valuemax="100"
                  >
                    {profitMargin}%
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>

        {/* 3D Profit & Loss Chart */}
        {threeDOptions && (
          <Row className="mb-4">
            <Col md={12}>
              <Card className="shadow-sm h-100">
                <Card.Body>
                  <Card.Title><Translate textKey="profitAndLoss3D" fallback="3D Profit & Loss" /></Card.Title>
                  <ReactECharts echarts={echarts} option={threeDOptions} style={{ height: 360 }} />
                </Card.Body>
              </Card>
            </Col>
          </Row>
        )}

        {/* Charts Section (kept intact) */}
        <Row className="mb-4">
          {/* Trend Chart - Only for Monthly/Yearly views */}
          {(analytics.dailyData || analytics.monthlyData) && (
            <Col md={12} lg={6} className="mb-4">
              <Card className="shadow-sm h-100">
                <Card.Body>
                  <Card.Title><Translate textKey="salesVsProfitTrend" fallback="Sales vs Profit Trend" /></Card.Title>
                  <div style={{ width: '100%', height: 300 }}>
                    <ResponsiveContainer>
                      <LineChart
                        data={analytics.dailyData || analytics.monthlyData}
                        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey={analytics.dailyData ? "day" : "month"} />
                        <YAxis />
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend />
                        <Line 
                          type="monotone" 
                          dataKey="sales" 
                          stroke="#0d6efd" 
                          name="Sales" 
                          activeDot={{ r: 8 }} 
                        />
                        <Line 
                          type="monotone" 
                          dataKey="profit" 
                          stroke="#198754" 
                          name="Profit" 
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          )}

          {/* Category Chart */}
          <Col md={12} lg={(analytics.dailyData || analytics.monthlyData) ? 6 : 12}>
            <Card className="shadow-sm h-100">
              <Card.Body>
                <Card.Title><Translate textKey="salesByCategory" fallback="Sales by Category" /></Card.Title>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart
                      data={analytics.categoryData}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="category" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatCurrency(value)} />
                      <Legend />
                      <Bar 
                        dataKey="sales" 
                        fill="#0d6efd" 
                        name="Sales" 
                      />
                      <Bar 
                        dataKey="profit" 
                        fill="#198754" 
                        name="Profit" 
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
        {/* Category-wise Sales and Profit */}
        {analytics.categoryData && analytics.categoryData.length > 0 && (
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <h5><Translate textKey="categoryBreakdown" fallback="Category Breakdown" /></h5>
              <div className="table-responsive mt-3">
                <Table striped bordered hover>
                  <thead>
                    <tr>
                      <th><Translate textKey="category" fallback="Category" /></th>
                      <th><Translate textKey="sales" fallback="Sales" /></th>
                      <th><Translate textKey="profit" fallback="Profit" /></th>
                      <th><Translate textKey="profitMargin" fallback="Profit Margin" /></th>
                      <th><Translate textKey="itemsSold" fallback="Items Sold" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.categoryData.map((category, index) => (
                      <CategoryRow key={index} category={category} index={index} />
                    ))}
                  </tbody>
                </Table>
              </div>
              
              {/* Category Sales Distribution Chart (visual representation as progress bars) */}
              <h6 className="mt-4"><Translate textKey="salesDistribution" fallback="Sales Distribution" /></h6>
              {analytics.categoryData.map((category, index) => (
                <CategoryProgressBar 
                  key={index} 
                  category={category} 
                  index={index} 
                  totalSales={analytics.sales} 
                />
              ))}
            </Card.Body>
          </Card>
        )}
        
        {/* Product Sales by Employee */}
        <Card className="shadow-sm mb-4">
          <Card.Body>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h5 className="mb-0"><Translate textKey="productSalesByEmployee" fallback="Product Sales by Employee" /></h5>
              {analytics.productSalesByEmployee && analytics.productSalesByEmployee.length > 0 && (
                <Dropdown as={ButtonGroup}>
                  <Button 
                    variant="success" 
                    onClick={generateCSVReport}
                    size="sm"
                  >
                    <i className="bi bi-file-earmark-spreadsheet me-1"></i>
                    <Translate textKey="exportCSV" fallback="Export CSV" />
                  </Button>
                  <Dropdown.Toggle split variant="success" id="dropdown-split-basic" size="sm" />
                  <Dropdown.Menu>
                    <Dropdown.Item onClick={generatePDFReport}>
                      <i className="bi bi-file-earmark-pdf me-2"></i>
                      <Translate textKey="exportPDF" fallback="Export PDF" />
                    </Dropdown.Item>
                    <Dropdown.Item onClick={generateCSVReport}>
                      <i className="bi bi-file-earmark-spreadsheet me-2"></i>
                      <Translate textKey="exportCSV" fallback="Export CSV" />
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              )}
            </div>
            <p className="text-muted mb-3">
              <Translate 
                textKey="productSalesByEmployeeDescription" 
                fallback="Detailed list of products sold by employees (only shows products from receipts where an employee was selected)" 
              />
            </p>
            
            {/* Employee Summary */}
            {generateEmployeeSummary && generateEmployeeSummary.length > 0 && (
              <Card className="mb-3" style={{ backgroundColor: '#f8f9fa' }}>
                <Card.Body>
                  <h6 className="mb-3"><Translate textKey="employeeSummary" fallback="Employee Summary" /></h6>
                  <div className="table-responsive">
                    <Table striped bordered hover size="sm">
                      <thead>
                        <tr>
                          <th><Translate textKey="employee" fallback="Employee" /></th>
                          <th><Translate textKey="totalSales" fallback="Total Sales" /></th>
                          <th><Translate textKey="totalProfit" fallback="Total Profit" /></th>
                          <th><Translate textKey="profitMargin" fallback="Profit Margin" /></th>
                          <th><Translate textKey="itemsSold" fallback="Items Sold" /></th>
                          <th><Translate textKey="productsSold" fallback="Products Sold" /></th>
                          <th><Translate textKey="transactions" fallback="Transactions" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {generateEmployeeSummary.map((emp, index) => (
                          <tr key={index}>
                            <td><strong>{emp.employeeName}</strong></td>
                            <td>{formatCurrency(emp.totalSales)}</td>
                            <td>{formatCurrency(emp.totalProfit)}</td>
                            <td>{emp.profitMargin}%</td>
                            <td>{emp.totalItems}</td>
                            <td>{emp.productCount}</td>
                            <td>{emp.transactionCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </Card.Body>
              </Card>
            )}
            
            {analytics.productSalesByEmployee && analytics.productSalesByEmployee.length > 0 ? (
              <div className="table-responsive mt-3">
                <Table striped bordered hover size="sm" className="product-sales-table">
                  <thead>
                    <tr>
                      <th><Translate textKey="product" fallback="Product" /></th>
                      <th><Translate textKey="employee" fallback="Employee" /></th>
                      <th><Translate textKey="date" fallback="Date" /></th>
                      <th><Translate textKey="time" fallback="Time" /></th>
                      <th><Translate textKey="quantity" fallback="Quantity" /></th>
                      <th><Translate textKey="unitPrice" fallback="Unit Price" /></th>
                      <th><Translate textKey="totalSales" fallback="Total Sales" /></th>
                      <th><Translate textKey="profit" fallback="Profit" /></th>
                      <th><Translate textKey="profitMargin" fallback="Profit Margin" /></th>
                      <th><Translate textKey="category" fallback="Category" /></th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.productSalesByEmployee.map((product, index) => (
                      <ProductSalesRow key={`${product.transactionId}-${index}-${product.productName}`} product={product} />
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <Alert variant="info" className="mt-3">
                <Translate 
                  textKey="noProductSalesWithEmployee" 
                  fallback="No product sales with employee information found for this period. Products will appear here when an employee is selected during receipt generation." 
                />
              </Alert>
            )}
          </Card.Body>
        </Card>
      </>
    );
  }, [analytics, profitMargin, generateEmployeeSummary, generateCSVReport, generatePDFReport, threeDOptions]);

  // Render detailed data based on view mode - memoized to prevent unnecessary recalculations
  const renderDetailedData = useMemo(() => {
    if (!analytics) return null;

    switch (viewMode) {
      case 'monthly':
        return (
          <Table responsive striped bordered hover>
            <thead>
              <tr>
                <th><Translate textKey="day" fallback="Day" /></th>
                <th><Translate textKey="sales" fallback="Sales" /></th>
                <th><Translate textKey="profit" fallback="Profit" /></th>
                <th><Translate textKey="profitMargin" fallback="Profit Margin" /> (%)</th>
              </tr>
            </thead>
            <tbody>
              {analytics.dailyData && analytics.dailyData.length > 0 ? (
                analytics.dailyData.map((day) => (
                  <DailyDataRow key={day.day} day={day} />
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">
                    <Translate textKey="noDataAvailable" fallback="No data available for this period" />
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        );
        
      case 'yearly':
        return (
          <Table responsive striped bordered hover>
            <thead>
              <tr>
                <th><Translate textKey="month" fallback="Month" /></th>
                <th><Translate textKey="sales" fallback="Sales" /></th>
                <th><Translate textKey="profit" fallback="Profit" /></th>
                <th><Translate textKey="profitMargin" fallback="Profit Margin" /> (%)</th>
              </tr>
            </thead>
            <tbody>
              {analytics.monthlyData && analytics.monthlyData.length > 0 ? (
                analytics.monthlyData.map((month) => (
                  <MonthlyDataRow key={month.month} month={month} />
                ))
              ) : (
                <tr>
                  <td colSpan="4" className="text-center">
                    <Translate textKey="noDataAvailable" fallback="No data available for this period" />
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        );
        
      default: // daily
        return (
          <Alert variant="info">
            <Translate 
              textKey="dailyViewDescription" 
              fallback="Daily view displays summary data for the selected date. You can switch to monthly or yearly views for more detailed analysis."
            />
          </Alert>
        );
    }
  }, [analytics, viewMode]);

  // Memoized view mode button handlers
  const handleViewModeChange = useCallback((mode) => {
    setViewMode(mode);
  }, []);

  return (
    <>
      <MainNavbar />
      <Container>
        <PageHeader 
          title="Profit and Loss" 
          icon="bi-graph-up" 
          subtitle="Dive into your sales performance, profit trends, and period comparisons."
        />
        
        <Card className="mb-4 shadow-sm">
          <Card.Body>
            <Row className="mb-3">
              <Col md={4}>
                <Form.Group>
                  <Form.Label><Translate textKey="viewMode" fallback="View Mode" /></Form.Label>
                  <div className="d-flex">
                    <Button
                      variant={viewMode === 'daily' ? 'primary' : 'outline-primary'}
                      className="me-2"
                      onClick={() => handleViewModeChange('daily')}
                    >
                      <Translate textKey="daily" fallback="Daily" />
                    </Button>
                    <Button
                      variant={viewMode === 'monthly' ? 'primary' : 'outline-primary'}
                      className="me-2"
                      onClick={() => handleViewModeChange('monthly')}
                    >
                      <Translate textKey="monthly" fallback="Monthly" />
                    </Button>
                    <Button
                      variant={viewMode === 'yearly' ? 'primary' : 'outline-primary'}
                      onClick={() => handleViewModeChange('yearly')}
                    >
                      <Translate textKey="yearly" fallback="Yearly" />
                    </Button>
                  </div>
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group>
                  <Form.Label>
                    <Translate
                      textKey={`select${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)}`}
                      fallback={`Select ${viewMode}`}
                    />
                  </Form.Label>
                  {renderDateSelector}
                </Form.Group>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        
        {error && <Alert variant="danger">{error}</Alert>}
        
        {isInitialLoad ? (
          <div className="text-center my-5">
            <Spinner animation="border" role="status">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
          </div>
        ) : loading ? (
          <div className="position-relative">
            <div className="loading-overlay">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading...</span>
              </Spinner>
            </div>
            {analytics && (
              <>
                {renderSummary}
                
                <Card className="shadow-sm">
                  <Card.Body>
                    <h4 className="mb-3">
                      <Translate 
                        textKey={`${viewMode}Details`} 
                        fallback={`${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Details`} 
                      />
                    </h4>
                    {renderDetailedData}
                  </Card.Body>
                </Card>
              </>
            )}
          </div>
        ) : (
          <>
            {renderSummary}
            
            <Card className="shadow-sm">
              <Card.Body>
                <h4 className="mb-3">
                  <Translate 
                    textKey={`${viewMode}Details`} 
                    fallback={`${viewMode.charAt(0).toUpperCase() + viewMode.slice(1)} Details`} 
                  />
                </h4>
                {renderDetailedData}
              </Card.Body>
            </Card>
          </>
        )}
      </Container>
    </>
  );
};

export default SalesAnalytics;
