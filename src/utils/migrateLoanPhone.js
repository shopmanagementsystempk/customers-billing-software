import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Migration Script: Add customerPhone to existing loans
 * 
 * This script updates all existing customerLoans documents to include
 * the customerPhone field by matching with customer records.
 * 
 * Run this ONCE to fix existing data.
 */
export const migrateCustomerLoansAddPhone = async (shopId) => {
    try {
        console.log('Starting migration: Adding customerPhone to existing loans...');

        // 1. Fetch all customers for this shop
        const customersRef = collection(db, 'customers');
        const customersQuery = query(customersRef, where('shopId', '==', shopId));
        const customersSnapshot = await getDocs(customersQuery);

        const customers = customersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log(`Found ${customers.length} customers`);

        // 2. Fetch all loans for this shop
        const loansRef = collection(db, 'customerLoans');
        const loansQuery = query(loansRef, where('shopId', '==', shopId));
        const loansSnapshot = await getDocs(loansQuery);

        console.log(`Found ${loansSnapshot.docs.length} loans to migrate`);

        let updatedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        // 3. Update each loan with customerId and customerPhone
        for (const loanDoc of loansSnapshot.docs) {
            const loanData = loanDoc.data();

            // Skip if already has customerId
            if (loanData.customerId !== undefined) {
                skippedCount++;
                continue;
            }

            // Find matching customer by name
            const matchingCustomers = customers.filter(c =>
                (c.name || '').toLowerCase() === (loanData.customerName || '').toLowerCase()
            );

            if (matchingCustomers.length === 0) {
                console.warn(`No customer found for loan: ${loanData.customerName}`);
                // Set empty values for loans without matching customer
                await updateDoc(doc(db, 'customerLoans', loanDoc.id), {
                    customerId: '',
                    customerPhone: loanData.customerPhone || ''
                });
                updatedCount++;
            } else if (matchingCustomers.length === 1) {
                // Single match - update with customer's ID and phone
                await updateDoc(doc(db, 'customerLoans', loanDoc.id), {
                    customerId: matchingCustomers[0].id,
                    customerPhone: matchingCustomers[0].phone || ''
                });
                updatedCount++;
                console.log(`✓ Updated loan for ${loanData.customerName} with ID: ${matchingCustomers[0].id}`);
            } else {
                // Multiple customers with same name - THIS IS THE PROBLEM CASE
                console.warn(`⚠️  Multiple customers found for: ${loanData.customerName}`);
                console.warn('Customers:', matchingCustomers.map(c => ({ name: c.name, phone: c.phone, id: c.id })));

                // Try to match by phone if available
                let matched = false;
                if (loanData.customerPhone) {
                    const phoneMatch = matchingCustomers.find(c => c.phone === loanData.customerPhone);
                    if (phoneMatch) {
                        await updateDoc(doc(db, 'customerLoans', loanDoc.id), {
                            customerId: phoneMatch.id,
                            customerPhone: phoneMatch.phone || ''
                        });
                        updatedCount++;
                        matched = true;
                        console.log(`✓ Matched by phone: ${phoneMatch.id}`);
                    }
                }

                if (!matched) {
                    // Assign to first one and warn user to verify
                    await updateDoc(doc(db, 'customerLoans', loanDoc.id), {
                        customerId: matchingCustomers[0].id,
                        customerPhone: matchingCustomers[0].phone || ''
                    });
                    updatedCount++;
                    console.warn(`⚠️  Assigned to first match: ${matchingCustomers[0].id} - PLEASE VERIFY MANUALLY!`);
                    console.warn(`   Loan amount: ${loanData.amount}, Transaction: ${loanData.transactionId}`);
                }
            }
        }

        console.log('\n=== Migration Complete ===');
        console.log(`Updated: ${updatedCount} loans`);
        console.log(`Skipped: ${skippedCount} loans (already had phone)`);
        console.log(`Errors: ${errorCount} loans`);

        return {
            success: true,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errorCount
        };

    } catch (error) {
        console.error('Migration failed:', error);
        return {
            success: false,
            error: error.message
        };
    }
};

/**
 * How to use:
 * 
 * 1. Import this function in your component:
 *    import { migrateCustomerLoansAddPhone } from '../utils/migrateLoanPhone';
 * 
 * 2. Add a button in your admin panel or customer page:
 *    <Button onClick={() => migrateCustomerLoansAddPhone(activeShopId)}>
 *      Fix Loan Data
 *    </Button>
 * 
 * 3. Click the button ONCE to migrate all existing loans
 * 
 * 4. Check the browser console for migration results
 */
