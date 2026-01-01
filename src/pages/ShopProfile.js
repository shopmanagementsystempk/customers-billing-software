import React, { useState, useEffect } from 'react';
import { Container, Card, Form, Button, Row, Col, Alert } from 'react-bootstrap';
import { useAuth } from '../contexts/AuthContext';
import MainNavbar from '../components/Navbar';
import { Translate, useTranslatedAttribute } from '../utils';
import PageHeader from '../components/PageHeader';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

const ShopProfile = () => {
  const { shopData, currentUser, updateShopData } = useAuth();

  // Get translations for attributes
  const getTranslatedAttr = useTranslatedAttribute();

  // Owner and business information
  const [ownerNames, setOwnerNames] = useState('');
  const [ownerCnicNo, setOwnerCnicNo] = useState('');
  const [ownerMobileNo, setOwnerMobileNo] = useState('');
  const [ntnNo, setNtnNo] = useState('');
  const [salesTaxNo, setSalesTaxNo] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [easypaisaNo, setEasypaisaNo] = useState('');
  const [jazzcashNo, setJazzcashNo] = useState('');

  // UI states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Load shop profile data
  useEffect(() => {
    if (shopData) {
      setOwnerNames(shopData.ownerNames || '');
      setOwnerCnicNo(shopData.ownerCnicNo || '');
      setOwnerMobileNo(shopData.ownerMobileNo || '');
      setNtnNo(shopData.ntnNo || '');
      setSalesTaxNo(shopData.salesTaxNo || '');
      setBankAccountNo(shopData.bankAccountNo || '');
      setEasypaisaNo(shopData.easypaisaNo || '');
      setJazzcashNo(shopData.jazzcashNo || '');
    }
  }, [shopData]);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');
    setLoading(true);

    try {
      // Create updated shop profile data
      const updatedData = {
        ownerNames: ownerNames.trim(),
        ownerCnicNo: ownerCnicNo.trim(),
        ownerMobileNo: ownerMobileNo.trim(),
        ntnNo: ntnNo.trim(),
        salesTaxNo: salesTaxNo.trim(),
        bankAccountNo: bankAccountNo.trim(),
        easypaisaNo: easypaisaNo.trim(),
        jazzcashNo: jazzcashNo.trim(),
        updatedAt: new Date().toISOString()
      };

      // Update shop data in Firestore
      await updateShopData(updatedData);

      setSuccess(getTranslatedAttr('shopProfileUpdated'));
      setTimeout(() => setSuccess(''), 5000);
    } catch (error) {
      setError(getTranslatedAttr('failedToUpdateProfile') + error.message);
      console.error('Error updating shop profile:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MainNavbar />
      <Container>
        <PageHeader
          title={<Translate textKey="shopProfile" />}
          icon="bi-person-badge"
          subtitle={<Translate textKey="shopProfileSubtitle" />}
        />

        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        <Card className="mb-4">
          <Card.Body>
            <Form onSubmit={handleSubmit}>
              <h4 className="mb-3"><Translate textKey="ownerInformation" /></h4>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="ownerNames" /></Form.Label>
                    <Form.Control
                      type="text"
                      value={ownerNames}
                      onChange={(e) => setOwnerNames(e.target.value)}
                      placeholder={getTranslatedAttr("enterOwnerNames")}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="ownerCnic" /></Form.Label>
                    <Form.Control
                      type="text"
                      value={ownerCnicNo}
                      onChange={(e) => setOwnerCnicNo(e.target.value)}
                      placeholder={getTranslatedAttr("enterCnic")}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="ownerMobile" /></Form.Label>
                    <Form.Control
                      type="text"
                      value={ownerMobileNo}
                      onChange={(e) => setOwnerMobileNo(e.target.value)}
                      placeholder={getTranslatedAttr("enterMobile")}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <h4 className="mb-3 mt-4"><Translate textKey="businessInformation" /></h4>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="ntnNo" /></Form.Label>
                    <Form.Control
                      type="text"
                      value={ntnNo}
                      onChange={(e) => setNtnNo(e.target.value)}
                      placeholder={getTranslatedAttr("enterNtn")}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="salesTaxNo" /></Form.Label>
                    <Form.Control
                      type="text"
                      value={salesTaxNo}
                      onChange={(e) => setSalesTaxNo(e.target.value)}
                      placeholder={getTranslatedAttr("enterSalesTax")}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <h4 className="mb-3 mt-4"><Translate textKey="paymentInformation" /></h4>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="bankAccountNo" /></Form.Label>
                    <Form.Control
                      type="text"
                      value={bankAccountNo}
                      onChange={(e) => setBankAccountNo(e.target.value)}
                      placeholder={getTranslatedAttr("enterBankAccount")}
                    />
                  </Form.Group>
                </Col>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="easypaisaNo" /></Form.Label>
                    <Form.Control
                      type="text"
                      value={easypaisaNo}
                      onChange={(e) => setEasypaisaNo(e.target.value)}
                      placeholder={getTranslatedAttr("enterEasypaisa")}
                    />
                  </Form.Group>
                </Col>
              </Row>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label><Translate textKey="jazzcashNo" /></Form.Label>
                    <Form.Control
                      type="text"
                      value={jazzcashNo}
                      onChange={(e) => setJazzcashNo(e.target.value)}
                      placeholder={getTranslatedAttr("enterJazzcash")}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <div className="d-flex justify-content-end mt-4">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={loading}
                >
                  {loading ? <Translate textKey="saving" /> : <Translate textKey="save" />}
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default ShopProfile;

