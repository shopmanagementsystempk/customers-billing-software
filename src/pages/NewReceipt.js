import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Table, InputGroup, Badge, Alert } from 'react-bootstrap';
import BarcodeReader from 'react-barcode-reader';
import Select from 'react-select';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { calculateTotal, generateTransactionId, saveReceipt, formatCurrency } from '../utils/receiptUtils';
import { getShopStock, updateStockQuantity } from '../utils/stockUtils';
import { createSaleLedgerEntry } from '../utils/ledgerUtils';
import { Translate, useTranslatedData, translations } from '../utils';
import { formatDisplayDate } from '../utils/dateUtils';
import MainNavbar from '../components/Navbar';
import PageHeader from '../components/PageHeader';
import { db } from '../firebase/config';
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import '../styles/select.css';

const NewReceipt = () => {
  const { currentUser, shopData, activeShopId } = useAuth();
  const { language } = useLanguage();
  const [items, setItems] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [productCode, setProductCode] = useState('');
  const [customer, setCustomer] = useState('Walk-in Customer');
  const [autoPrint, setAutoPrint] = useState(true);
  const [discount, setDiscount] = useState('');
  const [tax, setTax] = useState('');
  const [enterAmount, setEnterAmount] = useState('');
  const [loanAmount, setLoanAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [transactionId, setTransactionId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [stockItems, setStockItems] = useState([]);
  const [stockLoaded, setStockLoaded] = useState(false);
  const [savedReceiptId, setSavedReceiptId] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeesLoaded, setEmployeesLoaded] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [customersLoaded, setCustomersLoaded] = useState(false);
  const navigate = useNavigate();
  const pdfRef = useRef();
  const barcodeInputRef = useRef(null);

  // Fetch stock items
  useEffect(() => {
    if (currentUser && activeShopId) {
      getShopStock(activeShopId)
        .then(items => {
          setStockItems(items);
          setStockLoaded(true);
        })
        .catch(error => {
          console.error('Error loading inventory items:', error);
        });
    }
  }, [currentUser, activeShopId]);

  // Auto-focus on barcode input when page loads
  useEffect(() => {
    if (stockLoaded && barcodeInputRef.current) {
      // Small delay to ensure the input is fully rendered
      setTimeout(() => {
        barcodeInputRef.current?.focus();
      }, 100);
    }
  }, [stockLoaded]);

  // Initialize transaction ID (sequential per shop)
  useEffect(() => {
    let isMounted = true;
    const initTransactionId = async () => {
      try {
        if (activeShopId) {
          const id = await generateTransactionId(activeShopId);
          if (isMounted) setTransactionId(id);
        } else {
          const id = generateTransactionId();
          if (isMounted) setTransactionId(id);
        }
      } catch (err) {
        if (isMounted) setTransactionId(generateTransactionId());
      }
    };
    initTransactionId();
    return () => { isMounted = false; };
  }, [activeShopId]);

  // Fetch employees
  useEffect(() => {
    if (currentUser && activeShopId) {
      const fetchEmployees = async () => {
        try {
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
          setEmployeesLoaded(true);
        } catch (error) {
          console.error('Error loading employees:', error);
          setEmployeesLoaded(true);
        }
      };
      fetchEmployees();
    }
  }, [currentUser, activeShopId]);

  useEffect(() => {
    if (currentUser && activeShopId) {
      const fetchCustomers = async () => {
        try {
          const customersRef = collection(db, 'customers');
          const customersQuery = query(
            customersRef,
            where('shopId', '==', activeShopId)
          );
          const snapshot = await getDocs(customersQuery);
          const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          setCustomers(list);
          setCustomersLoaded(true);
        } catch (error) {
          setCustomersLoaded(true);
        }
      };
      fetchCustomers();
    }
  }, [currentUser, activeShopId]);

  // Cleanup: Remove any print iframes when component unmounts
  useEffect(() => {
    return () => {
      const existingIframe = document.getElementById('print-iframe');
      if (existingIframe && existingIframe.parentNode) {
        existingIframe.parentNode.removeChild(existingIframe);
      }
    };
  }, []);

  // Handle barcode scan from scanner hardware
  const handleScan = (data) => {
    if (!data) return;

    const matchingItem = stockItems.find(item =>
      item.sku && item.sku.toLowerCase() === data.toLowerCase());

    if (matchingItem) {
      // Block scanning if out of stock
      if ((parseFloat(matchingItem.quantity || 0)) <= 0) {
        setError(translations[language]?.outOfStock || 'Out of stock');
        setTimeout(() => setError(''), 3000);
        setSelectedProduct('');
        setProductCode('');
        return;
      }

      setSelectedProduct(matchingItem.name);
      setProductCode(matchingItem.sku || '');

      // Add to items if not already exists
      const existingIndex = items.findIndex(item =>
        item.name.toLowerCase() === matchingItem.name.toLowerCase());

      if (existingIndex >= 0) {
        const newItems = [...items];
        newItems[existingIndex].quantity = (parseInt(newItems[existingIndex].quantity) + 1).toString();
        setItems(newItems);
      } else {
        setItems([...items, {
          code: matchingItem.sku || '',
          name: matchingItem.name,
          inStock: matchingItem.quantity || 0,
          salePrice: matchingItem.price.toString(),
          tax: '0',
          quantity: '1',
          itemPrice: '', // Price field for quantity calculation
          total: matchingItem.price.toString(),
          costPrice: matchingItem.costPrice ? matchingItem.costPrice.toString() : '0',
          quantityUnit: matchingItem.quantityUnit || 'units',
          category: matchingItem.category || 'Uncategorized'
        }]);
      }

      // Clear the fields
      setSelectedProduct('');
      setProductCode('');
    }
  };

  // Handle code input field change (for barcode scanner input)
  const handleCodeInput = (e) => {
    const code = e.target.value;
    setProductCode(code);

    // Look for matching product by SKU/code
    const matchingItem = stockItems.find(item =>
      item.sku && item.sku.toLowerCase() === code.toLowerCase());

    if (matchingItem && code.length > 0) {
      // Block adding if out of stock
      if ((parseFloat(matchingItem.quantity || 0)) <= 0) {
        setError(translations[language]?.outOfStock || 'Out of stock');
        setTimeout(() => setError(''), 3000);
        setSelectedProduct('');
        setProductCode('');
        return;
      }
      // Add product to items list
      const existingIndex = items.findIndex(item =>
        item.name.toLowerCase() === matchingItem.name.toLowerCase());

      if (existingIndex >= 0) {
        // If item already exists, increment quantity
        const newItems = [...items];
        newItems[existingIndex].quantity = (parseInt(newItems[existingIndex].quantity) + 1).toString();
        setItems(newItems);
      } else {
        // Add as new item
        setItems([...items, {
          code: matchingItem.sku || '',
          name: matchingItem.name,
          inStock: matchingItem.quantity || 0,
          salePrice: matchingItem.price.toString(),
          tax: '0',
          quantity: '1',
          itemPrice: '', // Price field for quantity calculation
          total: matchingItem.price.toString(),
          costPrice: matchingItem.costPrice ? matchingItem.costPrice.toString() : '0',
          quantityUnit: matchingItem.quantityUnit || 'units',
          category: matchingItem.category || 'Uncategorized'
        }]);
      }

      // Clear the fields after adding
      setSelectedProduct('');
      setProductCode('');
    }
  };

  // Handle product selection
  const handleProductSelect = (option) => {
    if (option) {
      const productName = option.value;
      setSelectedProduct(productName);
      const matchingItem = stockItems.find(item => item.name === productName);

      if (matchingItem) {
        // Block selection if out of stock
        if ((parseFloat(matchingItem.quantity || 0)) <= 0) {
          setError(translations[language]?.outOfStock || 'Out of stock');
          setTimeout(() => setError(''), 3000);
          setSelectedProduct('');
          setProductCode('');
          return;
        }

        const itemCode = matchingItem.sku || '';
        setProductCode(itemCode);

        // Automatically add the product to the items list
        const existingIndex = items.findIndex(item =>
          item.name.toLowerCase() === productName.toLowerCase());

        if (existingIndex >= 0) {
          // If item already exists, increment quantity
          const newItems = [...items];
          newItems[existingIndex].quantity = (parseInt(newItems[existingIndex].quantity) + 1).toString();
          setItems(newItems);
        } else {
          // Add as new item
          setItems([...items, {
            code: itemCode,
            name: productName,
            inStock: matchingItem.quantity || 0,
            salePrice: matchingItem.price.toString(),
            tax: '0',
            quantity: '1',
            itemPrice: '', // Price field for quantity calculation
            total: matchingItem.price.toString(),
            costPrice: matchingItem.costPrice ? matchingItem.costPrice.toString() : '0',
            quantityUnit: matchingItem.quantityUnit || 'units',
            category: matchingItem.category || 'Uncategorized'
          }]);
        }

        // Clear the selection to allow for next item
        setSelectedProduct('');
        setProductCode('');
      }
    }
  };

  const totals = useMemo(() => {
    const totalQuantities = items.reduce((sum, item) =>
      sum + parseFloat(item.quantity || 0), 0);
    const totalAmount = items.reduce((sum, item) =>
      sum + parseFloat(item.total || 0), 0);
    const discountAmount = parseFloat(discount || 0);
    const subtotalAfterDiscount = totalAmount - discountAmount;
    // Calculate tax as percentage of subtotal after discount
    const taxPercentage = parseFloat(tax || 0);
    const taxAmount = (taxPercentage / 100) * subtotalAfterDiscount;
    const payable = subtotalAfterDiscount + taxAmount;
    const receivedAmount = parseFloat(enterAmount || 0);
    const loanAmt = Math.max(0, Math.min(parseFloat(loanAmount || 0) || 0, payable));
    const effectivePayable = Math.max(0, payable - loanAmt);
    const balance = receivedAmount - effectivePayable;

    return {
      totalQuantities: totalQuantities.toFixed(2),
      totalAmount: totalAmount.toFixed(2),
      taxAmount: taxAmount.toFixed(2),
      payable: payable.toFixed(2),
      receivedAmount: receivedAmount.toFixed(2),
      balance: balance.toFixed(2),
      return: balance < 0 ? Math.abs(balance).toFixed(2) : '0.00',
      loanAmount: loanAmt.toFixed(2),
      effectivePayable: effectivePayable.toFixed(2)
    };
  }, [items, discount, tax, enterAmount, loanAmount]);

  // Handle item changes
  const handleItemChange = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;

    const calculateItemTotal = (item) => {
      const qty = parseFloat(item.quantity || 0);
      const price = parseFloat(item.salePrice || 0);
      const subtotal = qty * price;

      const dPercent = parseFloat(item.discountPercent || 0);
      const dAmount = parseFloat(item.discountAmount || 0);

      // Apply individual item discount
      const afterDiscount = subtotal - dAmount - (subtotal * dPercent / 100);

      const tPercent = parseFloat(item.tax || 0);
      const total = afterDiscount + (afterDiscount * tPercent / 100);

      return total.toFixed(2);
    };

    // If price field is entered, calculate quantity based on price / unit price
    if (field === 'itemPrice') {
      const itemPrice = value === '' ? 0 : parseFloat(value || 0);
      const unitPrice = parseFloat(newItems[index].salePrice || 0);

      if (itemPrice > 0 && unitPrice > 0) {
        // Calculate quantity: quantity = price / unit price
        const calculatedQuantity = (itemPrice / unitPrice).toFixed(4);
        newItems[index].quantity = calculatedQuantity;
        newItems[index].total = calculateItemTotal(newItems[index]);
      } else {
        // If price is cleared, recalculate total based on quantity
        newItems[index].total = calculateItemTotal(newItems[index]);
      }
    }
    // Recalculate total for this item when quantity or salePrice or tax or discounts change
    else if (field === 'quantity' || field === 'salePrice' || field === 'tax' || field === 'discountPercent' || field === 'discountAmount') {
      newItems[index].total = calculateItemTotal(newItems[index]);

      // If quantity or salePrice changed, update itemPrice to match (if it was used for entry)
      if (field === 'quantity' || field === 'salePrice') {
        const qty = parseFloat(newItems[index].quantity || 0);
        const price = parseFloat(newItems[index].salePrice || 0);
        newItems[index].itemPrice = (qty * price).toFixed(2);
      }
    }

    setItems(newItems);
  };

  // Add item to list
  const addItemToList = () => {
    if (!selectedProduct) {
      setError('Please select a product');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const matchingItem = stockItems.find(item => item.name === selectedProduct);
    if (!matchingItem) {
      setError('Product not found in stock');
      setTimeout(() => setError(''), 3000);
      return;
    }

    // Block adding if out of stock
    if ((parseFloat(matchingItem.quantity || 0)) <= 0) {
      setError(translations[language]?.outOfStock || 'Out of stock');
      setTimeout(() => setError(''), 3000);
      setSelectedProduct('');
      setProductCode('');
      return;
    }

    // Check if already in list
    const existingIndex = items.findIndex(item =>
      item.name.toLowerCase() === selectedProduct.toLowerCase());

    if (existingIndex >= 0) {
      const newItems = [...items];
      newItems[existingIndex].quantity = (parseInt(newItems[existingIndex].quantity) + 1).toString();
      setItems(newItems);
    } else {
      setItems([...items, {
        code: productCode || matchingItem.sku || '',
        name: selectedProduct,
        inStock: matchingItem.quantity || 0,
        salePrice: matchingItem.price.toString(),
        tax: '0',
        discountPercent: '0',
        discountAmount: '0',
        quantity: '1',
        itemPrice: '', // Price field for quantity calculation
        total: matchingItem.price.toString(),
        costPrice: matchingItem.costPrice ? matchingItem.costPrice.toString() : '0',
        quantityUnit: matchingItem.quantityUnit || 'units',
        category: matchingItem.category || 'Uncategorized'
      }]);
    }

    setSelectedProduct('');
    setProductCode('');
  };

  // Remove item from the items list
  const removeItemFromList = (index) => {
    const updated = items.filter((_, i) => i !== index);
    setItems(updated);
  };

  // Reset form
  const resetForm = useCallback(() => {
    setItems([]);
    setSelectedProduct('');
    setProductCode('');
    setCustomer('Walk-in Customer');
    setDiscount('');
    setTax('');
    setEnterAmount('');
    setPaymentMethod('Cash');
    setSelectedEmployee(null);
    setError('');
    setSuccess('');
    setSavedReceiptId(null);
    // Regenerate a new transaction ID for the next receipt
    if (activeShopId) {
      generateTransactionId(activeShopId)
        .then((id) => setTransactionId(id))
        .catch(() => setTransactionId(generateTransactionId()));
    } else {
      setTransactionId(generateTransactionId());
    }
  }, [activeShopId]);

  const printReceipt = useCallback(() => {
    const existingIframe = document.getElementById('print-iframe');
    if (existingIframe) {
      existingIframe.remove();
    }

    const iframe = document.createElement('iframe');
    iframe.id = 'print-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const currentDate = formatDisplayDate(new Date());
    const currentTime = new Date().toLocaleTimeString();

    // Get translated payment method label
    const paymentMethodsList = [
      { id: 'Cash', labelKey: 'cash' },
      { id: 'Cards', labelKey: 'cards' },
      { id: 'Mobile Wallet', labelKey: 'mobileWallets' },
      { id: 'QR Code', labelKey: 'qrPayment' },
      { id: 'Bank Transfer', labelKey: 'bankLinked' }
    ];
    const methodObj = paymentMethodsList.find(m => m.id === paymentMethod);
    const translatedPaymentMethod = methodObj ? (translations[language]?.[methodObj.labelKey] || paymentMethod) : paymentMethod;

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${translations[language]?.receiptTitle || 'Receipt'} - ${shopData?.shopName || 'Shop'}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            @media print { body { margin: 0; padding: 0; } }
            body {
              width: 80mm;
              font-family: 'Courier New', monospace;
              color: #000;
              margin: 0 auto;
              background: #fff;
              padding: 6mm 4mm;
              font-weight: 700;
            }
            .center { text-align: center; }
            .header-logo { max-height: 36px; margin: 6px auto 8px; display: block; }
            .shop-name { font-size: 20px; font-weight: 700; margin: 4px 0; }
            .shop-address, .shop-phone { font-size: 12px; margin: 2px 0; }
            .sep { border-top: 1px dotted #000; margin: 6px 0; }
            .meta {
              display: grid;
              grid-template-columns: 1fr 1fr;
              font-size: 12px;
              margin: 6px 0;
            }
            .meta div { padding: 2px 0; }
            .meta-right { text-align: right; }
            table.receipt { width: 100%; border-collapse: collapse; margin: 4px 0; }
            table.receipt thead th { font-size: 12px; font-weight: 700; padding: 8px 4px; border-top: 1px dotted #000; border-bottom: 1px dotted #000; border-right: 1px dotted #000; }
            table.receipt thead th:first-child { border-left: 1px dotted #000; }
            table.receipt tbody td { font-size: 12px; padding: 8px 4px; border-bottom: 1px dotted #000; border-right: 1px dotted #000; vertical-align: top; }
            table.receipt tbody tr td:first-child { border-left: 1px dotted #000; }
            .c { text-align: center; }
            .r { text-align: right; }
            .wrap { white-space: pre-wrap; word-break: break-word; }
            .totals { margin-top: 8px; border-top: 1px dotted #000; border-bottom: 1px dotted #000; padding: 6px 0; font-size: 12px; }
            .line { display: flex; justify-content: space-between; margin: 3px 0; }
            .net { text-align: right; font-weight: 700; font-size: 18px; margin-top: 6px; }
            .thanks { text-align: center; margin-top: 12px; font-size: 12px; }
            .dev {
              text-align: center;
              margin-top: 40px;
              padding: 6px 0;
              font-size: 10px;
              border-top: 1px dashed #000;
              border-bottom: 1px dashed #000;
            }
            col.sr { width: 12%; }
            col.item { width: 46%; }
            col.qty { width: 10%; }
            col.rate { width: 16%; }
            col.amnt { width: 16%; }
          </style>
        </head>
        <body>
          <div class="center">
            ${shopData?.logoUrl ? `<img class="header-logo" src="${shopData.logoUrl}" alt="logo" onerror='this.style.display="none"' />` : ''}
            <div class="shop-name">${shopData?.shopName || 'Shop Name'}</div>
            ${shopData?.address ? `<div class="shop-address">${shopData.address}</div>` : ''}
            <div class="shop-phone">${translations[language]?.phone || 'Phone'} # ${shopData?.phoneNumbers?.[0] || shopData?.phoneNumber || ''}</div>
          </div>
 
          <div class="sep"></div>
          <div class="meta">
            <div>${translations[language]?.invoice || 'Invoice'}: ${transactionId}</div>
            <div class="meta-right">${currentDate} ${currentTime}</div>
            <div>${translations[language]?.paymentMethod || 'Payment'}:</div>
            <div class="meta-right">${translatedPaymentMethod}</div>
          </div>
          <div class="sep"></div>
 
          <table class="receipt">
            <colgroup>
              <col class="sr" />
              <col class="item" />
              <col class="qty" />
              <col class="rate" />
              <col class="amnt" />
            </colgroup>
            <thead>
              <tr>
                <th class="c">${translations[language]?.sr || 'Sr'}</th>
                <th class="c">${translations[language]?.itemProduct || 'Item / Product'}</th>
                <th class="c">${translations[language]?.qty || 'Qty'}</th>
                <th class="r">${translations[language]?.rate || 'Rate'}</th>
                <th class="r">${translations[language]?.amnt || 'Amnt'}</th>
              </tr>
            </thead>
            <tbody>
              ${items.map((item, idx) => {
      const qty = parseFloat(item.quantity || 1);
      const rate = Math.round(parseFloat(item.salePrice || 0));
      const amount = Math.round(parseFloat(item.total || 0));
      const name = (item.name || '').replace(/\n/g, '\n');
      const unit = item.quantityUnit && item.quantityUnit.toLowerCase() !== 'units' ? item.quantityUnit.toUpperCase() : '';
      return `
                  <tr>
                    <td class="c">${idx + 1}</td>
                    <td class="wrap">${name}</td>
                    <td class="c">${qty} ${unit}</td>
                    <td class="r">${rate}</td>
                    <td class="r">${amount}</td>
                  </tr>
                `;
    }).join('')}
            </tbody>
          </table>
 
            <div class="totals">
            <div class="line"><span>${translations[language]?.total || 'Total'}</span><span>${parseFloat(totals.totalQuantities).toFixed(2)}</span></div>
            ${parseFloat(discount) > 0 ? `<div class="line"><span>${translations[language]?.discount || 'Discount'}</span><span>${Math.round(parseFloat(discount))}</span></div>` : ''}
            ${parseFloat(totals.taxAmount) > 0 ? `<div class="line"><span>${translations[language]?.tax || 'Tax'} (${tax || 0}%)</span><span>${Math.round(parseFloat(totals.taxAmount))}</span></div>` : ''}
            <div class="line"><span>${translations[language]?.netTotal || 'Net Total'}</span><span>${Math.round(parseFloat(totals.payable))}</span></div>
            ${parseFloat(totals.loanAmount) > 0 ? `<div class="line"><span>${translations[language]?.loan || 'Loan'}</span><span>${Math.round(parseFloat(totals.loanAmount))}</span></div>` : ''}
          </div>
 
          <div class="net">${Math.round(parseFloat(totals.payable))}</div>
          <div class="thanks">${translations[language]?.thankYouShopping || 'Thank you For Shoping !'}</div>
          <div class="dev">${translations[language]?.softwareDevelopedBy || 'software developed by'} Soft Verse 03311041968</div>
        </body>
      </html>
    `;

    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
    iframeDoc.open();
    iframeDoc.write(receiptHTML);
    iframeDoc.close();

    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();

      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 1000);
    }, 250);
  }, [discount, items, shopData, tax, totals, transactionId, language, paymentMethod]);


  // Handle form submission
  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (items.length === 0) {
      setError(translations[language]?.pleaseAddOneItem || 'Please add at least one item');
      setLoading(false);
      return;
    }

    try {
      const receiptItems = items.map(item => ({
        name: item.name,
        price: parseFloat(item.salePrice),
        quantity: parseFloat(item.quantity),
        costPrice: parseFloat(item.costPrice || 0),
        tax: parseFloat(item.tax || 0),
        discountPercent: parseFloat(item.discountPercent || 0),
        discountAmount: parseFloat(item.discountAmount || 0),
        total: parseFloat(item.total || 0),
        quantityUnit: item.quantityUnit || 'units',
        category: item.category || 'Uncategorized'
      }));

      const receiptData = {
        shopId: activeShopId,
        shopDetails: {
          name: shopData.shopName,
          address: shopData.address,
          phone: shopData.phoneNumbers && shopData.phoneNumbers.length > 0
            ? shopData.phoneNumbers.join(', ')
            : shopData.phoneNumber || '',
          logoUrl: shopData.logoUrl || '',
          receiptDescription: shopData.receiptDescription || ''
        },
        transactionId,
        cashierName: 'Cashier',
        managerName: 'Manager',
        createdBy: currentUser.uid,
        items: receiptItems,
        totalAmount: parseFloat(totals.payable),
        discount: parseFloat(discount) || 0,
        paymentMethod: paymentMethod,
        cashGiven: parseFloat(enterAmount) || 0,
        change: (parseFloat(enterAmount) || 0) - Math.max(parseFloat(totals.payable) - (parseFloat(loanAmount || 0) || 0), 0),
        employeeName: selectedEmployee ? selectedEmployee.name : null,
        employeeId: selectedEmployee ? selectedEmployee.id : null,
        customerName: customer,
        isLoan: (parseFloat(loanAmount || 0) || 0) > 0,
        loanAmount: Math.max(parseFloat(loanAmount || 0) || 0, 0)
      };

      // Save receipt (this is the only blocking operation)
      const receiptId = await saveReceipt(receiptData);

      // Show success immediately - don't wait for background operations
      setSuccess(translations[language]?.receiptSavedSuccess || 'Receipt saved successfully');
      setSavedReceiptId(receiptId);

      // All background operations run in parallel (non-blocking)
      const backgroundOperations = [];

      // 1. Create automatic ledger entry (non-blocking)
      backgroundOperations.push(
        createSaleLedgerEntry({
          ...receiptData,
          id: receiptId,
          receiptId: receiptId,
          date: new Date().toISOString().split('T')[0]
        }).catch(ledgerError => {
          console.error('Error creating ledger entry:', ledgerError);
        })
      );

      // 2. Update stock (non-blocking)
      backgroundOperations.push(
        updateStockQuantity(activeShopId, receiptItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          quantityUnit: item.quantityUnit
        }))).catch(stockError => {
          console.error('Error updating stock:', stockError);
        })
      );

      // 3. Create customer loan if needed (non-blocking)
      if ((parseFloat(loanAmount || 0) || 0) > 0 && customer && customer !== 'Walk-in Customer') {
        backgroundOperations.push(
          addDoc(collection(db, 'customerLoans'), {
            shopId: activeShopId,
            customerName: customer,
            receiptId,
            transactionId,
            amount: Math.max(parseFloat(loanAmount || 0) || 0, 0),
            timestamp: new Date().toISOString(),
            status: 'outstanding'
          }).catch(loanError => {
            console.error('Failed to record customer loan:', loanError);
          })
        );
      }

      // Run all background operations in parallel (fire and forget)
      Promise.all(backgroundOperations).catch(err => {
        console.error('Error in background operations:', err);
      });

      // Auto print if enabled
      if (autoPrint) {
        setTimeout(() => {
          printReceipt();
        }, 500);
      }

      // Reset form after delay
      setTimeout(() => {
        resetForm();
      }, 5000);

    } catch (error) {
      setError('Error saving receipt: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [
    activeShopId,
    autoPrint,
    customer,
    discount,
    enterAmount,
    items,
    loanAmount,
    printReceipt,
    resetForm,
    selectedEmployee,
    shopData,
    totals,
    transactionId,
    language,
    currentUser?.uid
  ]);

  // Handle Enter key to save and print receipt
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === 'Enter' && !loading && items.length > 0) {
        const activeElement = document.activeElement;

        // Check if we're in Product Select or Barcode field
        // These fields have their own Enter handlers to add items
        const isProductSelect = activeElement && (
          activeElement.closest('.select__control') !== null ||
          activeElement.closest('[class*="select"]') !== null ||
          activeElement.closest('[id*="react-select"]') !== null
        );
        const isBarcodeField = activeElement && activeElement === barcodeInputRef.current;

        // If in Product Select with selected product, let its handler work (it will add item)
        if (isProductSelect && selectedProduct) {
          return; // Let the product select handler work
        }

        // If in Barcode field with code, let its handler work (it will add item)
        if (isBarcodeField && productCode.trim() !== '') {
          return; // Let the barcode handler work
        }

        // For all other fields (including empty barcode/product select), trigger Pay & Save
        e.preventDefault();
        handleSubmit(e);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [loading, items, handleSubmit, selectedProduct, productCode]);

  // Get product options for select
  const productOptions = stockLoaded ?
    stockItems.map(item => ({
      value: item.name,
      label: item.name + ((parseFloat(item.quantity || 0)) <= 0 ? ` (${translations[language]?.outOfStock || 'Out of stock'})` : ''),
      quantity: parseFloat(item.quantity || 0)
    })) : [];

  // Get employee options for select
  const employeeOptions = employeesLoaded ?
    employees.map(emp => ({ value: emp.id, label: emp.name })) : [];

  const customerOptions = customersLoaded
    ? [{ value: 'Walk-in Customer', label: 'Walk-in Customer' }, ...customers.map(c => ({ value: c.name, label: c.name }))]
    : [{ value: 'Walk-in Customer', label: 'Walk-in Customer' }];


  return (
    <>
      <MainNavbar />
      <Container fluid className="pos-content" style={{ padding: '0.5rem 1rem' }}>
        <PageHeader
          title={<Translate textKey="newReceipt" fallback="New Receipt" />}
          icon="bi-receipt"
          subtitle={<><Translate textKey="newReceiptSubtitle" fallback="Create a new sale invoice. Transaction ID: " /> {transactionId}</>}
          style={{ marginBottom: '0.5rem' }}
        >
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="items" fallback="Items" /></span>
            <span className="hero-metrics__value">{items.length}</span>
          </div>
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="total" fallback="Total" /></span>
            <span className="hero-metrics__value">{formatCurrency(totals.totalAmount)}</span>
          </div>
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="payable" fallback="Payable" /></span>
            <span className="hero-metrics__value">{formatCurrency(totals.payable)}</span>
          </div>
          <div className="hero-metrics__item">
            <span className="hero-metrics__label"><Translate textKey="balance" fallback="Balance" /></span>
            <span className="hero-metrics__value">{formatCurrency(totals.balance)}</span>
          </div>
        </PageHeader>

        {error && <Alert variant="danger" className="mb-2 py-2">{error}</Alert>}
        {success && <Alert variant="success" className="mb-2 py-2">{success}</Alert>}

        <Row className="g-2">
          {/* Left Column - Product Selection & Cart */}
          <Col lg={8}>
            {/* Product Selection Card */}
            <Card className="mb-2 pos-card">
              <Card.Body className="p-3">
                <h6 className="mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-cart-plus text-primary"></i>
                  <Translate textKey="addProducts" fallback="Add Products" />
                </h6>
                <Row className="g-2">
                  <Col md={6}>
                    <Form.Group className="mb-2">
                      <Form.Label className="mb-1" style={{ fontSize: '0.875rem' }}><Translate textKey="product" fallback="Product" /></Form.Label>
                      <Select
                        value={productOptions.find(opt => opt.value === selectedProduct)}
                        onChange={handleProductSelect}
                        options={productOptions}
                        placeholder={translations[language]?.searchProductPlaceholder || "Search or select product..."}
                        className="basic-single"
                        classNamePrefix="select"
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 })
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && selectedProduct) {
                            e.preventDefault();
                            addItemToList();
                          }
                        }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-2">
                      <Form.Label className="mb-1" style={{ fontSize: '0.875rem' }}><Translate textKey="barcodeSku" fallback="Barcode / SKU" /></Form.Label>
                      <Form.Control
                        ref={barcodeInputRef}
                        type="text"
                        placeholder={translations[language]?.scanBarcodePlaceholder || "Scan or enter barcode"}
                        value={productCode}
                        onChange={handleCodeInput}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && productCode) {
                            e.preventDefault();
                            addItemToList();
                          }
                        }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-2">
                      <Form.Label className="mb-1" style={{ fontSize: '0.875rem' }}><Translate textKey="customerName" fallback="Customer Name" /></Form.Label>
                      <Select
                        value={customerOptions.find(opt => opt.value === customer) || null}
                        onChange={(option) => setCustomer(option ? option.value : 'Walk-in Customer')}
                        options={customerOptions}
                        placeholder={translations[language]?.walkInCustomer || "Walk-in Customer"}
                        isClearable
                        className="basic-single"
                        classNamePrefix="select"
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 })
                        }}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-2">
                      <Form.Label className="mb-1" style={{ fontSize: '0.875rem' }}><Translate textKey="employeeOptional" fallback="Employee (Optional)" /></Form.Label>
                      <Select
                        value={selectedEmployee ? employeeOptions.find(opt => opt.value === selectedEmployee.id) : null}
                        onChange={(option) => setSelectedEmployee(option ? employees.find(emp => emp.id === option.value) : null)}
                        options={employeeOptions}
                        placeholder={translations[language]?.selectEmployeePlaceholder || "Select employee..."}
                        isClearable
                        className="basic-single"
                        classNamePrefix="select"
                        menuPortalTarget={document.body}
                        styles={{
                          menuPortal: (base) => ({ ...base, zIndex: 9999 })
                        }}
                      />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex gap-2 mt-2 flex-wrap">
                  <Form.Check
                    type="checkbox"
                    id="autoPrint"
                    label={<Translate textKey="autoPrint" fallback="Auto Print" />}
                    checked={autoPrint}
                    onChange={(e) => setAutoPrint(e.target.checked)}
                    style={{ fontSize: '0.875rem' }}
                  />
                </div>
              </Card.Body>
            </Card>

            {/* Cart Items Card */}
            <Card className="pos-card">
              <Card.Body className="p-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <h6 className="mb-0 d-flex align-items-center gap-2">
                    <i className="bi bi-cart-check text-primary"></i>
                    <Translate textKey="cartItems" fallback="Cart Items" />
                  </h6>
                  <Badge bg="primary" style={{ fontSize: '0.75rem' }}>{items.length} <Translate textKey="items" fallback="items" /></Badge>
                </div>
                {items.length === 0 ? (
                  <div className="text-center py-3">
                    <i className="bi bi-cart-x text-muted" style={{ fontSize: '2rem' }}></i>
                    <p className="text-muted mt-2 mb-0" style={{ fontSize: '0.875rem' }}><Translate textKey="noItemsInCart" fallback="No items in cart. Add products to get started." /></p>
                  </div>
                ) : (
                  <div className="table-responsive" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    <Table hover className="mb-0" size="sm">
                      <thead>
                        <tr>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}>#</th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="product" fallback="Product" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="stock" fallback="Stock" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="unitPrice" fallback="Unit Price" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="priceRs" fallback="Price (RS)" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="qty" fallback="Qty" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="taxPercent" fallback="Tax (%)" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="discountPercent" fallback="Disc (%)" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="discountAmount" fallback="Disc (RS)" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="total" fallback="Total" /></th>
                          <th style={{ fontSize: '0.75rem', padding: '0.25rem', color: 'white' }}><Translate textKey="action" fallback="Action" /></th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td style={{ padding: '0.25rem', fontSize: '0.8rem' }}>
                              <div>
                                <strong style={{ fontSize: '0.8rem' }}>{item.name}</strong>
                                {item.code && <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>{item.code}</small>}
                              </div>
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <Badge bg={item.inStock > 0 ? 'success' : 'danger'} style={{ fontSize: '0.7rem' }}>
                                {item.inStock}
                              </Badge>
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <Form.Control
                                type="number"
                                size="sm"
                                style={{ width: '80px', fontSize: '0.8rem', padding: '0.2rem' }}
                                value={item.salePrice}
                                readOnly
                                title="Unit price per {item.quantityUnit || 'unit'} (read-only)"
                                className="bg-light"
                              />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <Form.Control
                                type="number"
                                size="sm"
                                style={{ width: '80px', fontSize: '0.8rem', padding: '0.2rem' }}
                                value={item.itemPrice || ''}
                                onChange={(e) => handleItemChange(index, 'itemPrice', e.target.value)}
                                placeholder="Enter price"
                                step="0.01"
                                min="0"
                                title="Enter price to calculate quantity automatically"
                              />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <Form.Control
                                type="number"
                                size="sm"
                                style={{ width: '70px', fontSize: '0.8rem', padding: '0.2rem' }}
                                value={item.quantity}
                                onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                                min="0"
                                step={item.quantityUnit === 'kg' ? '0.001' : '1'}
                                title={`Quantity in ${item.quantityUnit || 'units'}`}
                              />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <Form.Control
                                type="number"
                                size="sm"
                                style={{ width: '60px', fontSize: '0.8rem', padding: '0.2rem' }}
                                value={item.tax}
                                onChange={(e) => handleItemChange(index, 'tax', e.target.value)}
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder="0"
                              />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <Form.Control
                                type="number"
                                size="sm"
                                style={{ width: '60px', fontSize: '0.8rem', padding: '0.2rem' }}
                                value={item.discountPercent}
                                onChange={(e) => handleItemChange(index, 'discountPercent', e.target.value)}
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder="0"
                              />
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <Form.Control
                                type="number"
                                size="sm"
                                style={{ width: '70px', fontSize: '0.8rem', padding: '0.2rem' }}
                                value={item.discountAmount}
                                onChange={(e) => handleItemChange(index, 'discountAmount', e.target.value)}
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                              />
                            </td>
                            <td style={{ padding: '0.25rem', fontSize: '0.8rem' }}>
                              <strong>{formatCurrency(item.total)}</strong>
                            </td>
                            <td style={{ padding: '0.25rem' }}>
                              <Button
                                variant="outline-danger"
                                size="sm"
                                onClick={() => removeItemFromList(index)}
                                style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                              >
                                <i className="bi bi-trash"></i>
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          {/* Right Column - Payment Summary */}
          <Col lg={4}>
            <Card className="pos-card sticky-top" style={{ top: '80px', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
              <Card.Body className="p-3">
                <h6 className="mb-2 d-flex align-items-center gap-2">
                  <i className="bi bi-cash-stack text-success"></i>
                  <Translate textKey="paymentSummary" fallback="Payment Summary" />
                </h6>

                <div className="mb-2">
                  <Form.Group className="mb-2">
                    <Form.Label className="mb-1" style={{ fontSize: '0.875rem' }}><Translate textKey="loanAmountRs" fallback="Loan Amount (RS)" /></Form.Label>
                    <Form.Control
                      type="number"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                    <Form.Text className="text-muted" style={{ fontSize: '0.7rem' }}><Translate textKey="loanOptionalText" fallback="Optional. If provided, cash change is computed on payable minus loan." /></Form.Text>
                  </Form.Group>
                </div>

                <div className="mb-2">
                  <Form.Group className="mb-2">
                    <Form.Label className="mb-1" style={{ fontSize: '0.875rem' }}><Translate textKey="discountAmount" fallback="Discount (Amount)" /></Form.Label>
                    <Form.Control
                      type="number"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </Form.Group>
                  <Form.Group className="mb-2">
                    <Form.Label className="mb-1" style={{ fontSize: '0.875rem' }}><Translate textKey="taxPercentage" fallback="Tax (%)" /></Form.Label>
                    <Form.Control
                      type="number"
                      value={tax}
                      onChange={(e) => setTax(e.target.value)}
                      placeholder="0"
                      min="0"
                      max="100"
                      step="0.01"
                    />
                    <Form.Text className="text-muted" style={{ fontSize: '0.7rem' }}>
                      <Translate textKey="taxHelpText" fallback="Tax percentage will be calculated on the subtotal (after discount)" />
                    </Form.Text>
                  </Form.Group>
                </div>

                <div className="border-top pt-2 mb-2">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}><Translate textKey="subtotal" fallback="Subtotal" />:</span>
                    <strong style={{ fontSize: '0.8rem' }}>{formatCurrency(totals.totalAmount)}</strong>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}><Translate textKey="discount" fallback="Discount" />:</span>
                    <span className="text-danger" style={{ fontSize: '0.8rem' }}>-{formatCurrency(discount)}</span>
                  </div>
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}><Translate textKey="tax" fallback="Tax" /> ({tax || 0}%):</span>
                    <span style={{ fontSize: '0.8rem' }}>+{formatCurrency(totals.taxAmount)}</span>
                  </div>
                  <div className="border-top pt-2 mb-3">
                    <Form.Label className="mb-2" style={{ fontSize: '0.875rem', fontWeight: 'bold' }}>
                      <Translate textKey="paymentMethod" fallback="Payment Method" />
                    </Form.Label>
                    <div className="d-flex flex-wrap gap-2 mb-3">
                      {[
                        { id: 'Cash', icon: 'bi-cash', labelKey: 'cash' },
                        { id: 'Cards', icon: 'bi-credit-card', labelKey: 'cards' },
                        { id: 'Mobile Wallet', icon: 'bi-phone', labelKey: 'mobileWallets' },
                        { id: 'QR Code', icon: 'bi-qr-code', labelKey: 'qrPayment' },
                        { id: 'Bank Transfer', icon: 'bi-bank', labelKey: 'bankLinked' }
                      ].map((method) => (
                        <Button
                          key={method.id}
                          variant={paymentMethod === method.id ? 'primary' : 'outline-secondary'}
                          size="sm"
                          className="d-flex align-items-center gap-2 px-3 py-2 flex-grow-1"
                          onClick={() => setPaymentMethod(method.id)}
                          style={{ fontSize: '0.8rem', borderRadius: '8px', transition: 'all 0.2s' }}
                        >
                          <i className={`bi ${method.icon}`}></i>
                          <Translate textKey={method.labelKey} fallback={method.id} />
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="d-flex justify-content-between mb-2 pt-1 border-top">
                    <span className="fw-bold" style={{ fontSize: '0.9rem' }}><Translate textKey="totalPayable" fallback="Total Payable" />:</span>
                    <strong className="text-primary" style={{ fontSize: '1rem' }}>{formatCurrency(totals.payable)}</strong>
                  </div>
                </div>

                <Form.Group className="mb-2">
                  <Form.Label className="mb-1" style={{ fontSize: '0.875rem' }}><Translate textKey="receivedAmountRs" fallback="Received Amount (RS)" /></Form.Label>
                  <Form.Control
                    type="number"
                    value={enterAmount}
                    onChange={(e) => setEnterAmount(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    style={{ fontSize: '0.9rem' }}
                  />
                </Form.Group>

                <div className="border-top pt-2 mb-2">
                  <div className="d-flex justify-content-between mb-1">
                    <span className="text-muted" style={{ fontSize: '0.8rem' }}><Translate textKey="received" fallback="Received" />:</span>
                    <strong style={{ fontSize: '0.8rem' }}>{formatCurrency(totals.receivedAmount)}</strong>
                  </div>
                  <div className="d-flex justify-content-between">
                    <span className="fw-bold" style={{ fontSize: '0.9rem' }}><Translate textKey="change" fallback="Change" />:</span>
                    <strong className={`${parseFloat(totals.balance) >= 0 ? 'text-success' : 'text-danger'}`} style={{ fontSize: '1rem' }}>
                      {formatCurrency(totals.balance)}
                    </strong>
                  </div>
                  {parseFloat(totals.loanAmount) > 0 && (
                    <div className="d-flex justify-content-between mt-1">
                      <span className="fw-bold" style={{ fontSize: '0.9rem' }}><Translate textKey="loan" fallback="Loan" />:</span>
                      <strong className="text-danger" style={{ fontSize: '0.9rem' }}>
                        {formatCurrency(totals.loanAmount)}
                      </strong>
                    </div>
                  )}
                </div>

                <div className="d-grid gap-2">
                  <Button
                    variant="success"
                    onClick={handleSubmit}
                    disabled={loading || items.length === 0}
                    className="mb-2 py-2 fw-bold btn-success text-white"
                    style={{ fontSize: '1.1rem', transition: 'all 0.3s' }}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                        <Translate textKey="processing" fallback="Processing..." />
                      </>
                    ) : (
                      <>
                        <i className="bi bi-check-circle me-2"></i>
                        <Translate textKey="payAndSave" fallback="Pay & Save" />
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline-secondary"
                    onClick={resetForm}
                    disabled={loading}
                    className="py-1"
                  >
                    <i className="bi bi-arrow-clockwise me-2"></i>
                    <Translate textKey="reset" fallback="Reset" />
                  </Button>
                  <Button
                    variant="outline-primary"
                    onClick={() => navigate('/receipts')}
                    className="py-1"
                  >
                    <i className="bi bi-list-ul me-2"></i>
                    <Translate textKey="viewReceipts" fallback="View Receipts" />
                  </Button>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>

      {/* Barcode Reader */}
      <BarcodeReader
        onError={(err) => console.error('Scan error:', err)}
        onScan={handleScan}
      />
    </>
  );
};

export default NewReceipt;
