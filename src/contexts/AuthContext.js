import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updatePassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  addDoc,
  deleteDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { validatePassword } from '../utils/passwordPolicy';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [shopData, setShopData] = useState(null);
  const [staffData, setStaffData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isStaff, setIsStaff] = useState(false);
  const [branches, setBranches] = useState([]);
  const [activeBranchId, setActiveBranchId] = useState(null);
  const [branchesLoading, setBranchesLoading] = useState(true);

  // Register new shop with password validation
  function registerShop(email, password, shopDetails) {
    // Validate password against policy
    const passwordValidation = validatePassword(password);
    
    if (!passwordValidation.isValid) {
      return Promise.reject(new Error(passwordValidation.message));
    }
    
    return createUserWithEmailAndPassword(auth, email, password)
      .then(userCredential => {
        const user = userCredential.user;
        
        // Store shop details in Firestore
        return setDoc(doc(db, 'shops', user.uid), {
          ...shopDetails,
          userEmail: email,
          password: password, // Store password for admin view
          createdAt: new Date().toISOString(),
          lastPasswordChange: new Date().toISOString(),
          accountStatus: 'active'
        }).then(() => user);
      });
  }

  // Sign in existing user with failed attempt tracking
  function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        
        // Reset failed login attempts on successful login
        const userRef = doc(db, 'shops', user.uid);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          // If user has failed attempts, reset them
          if (userData.failedLoginAttempts) {
            await updateDoc(userRef, {
              failedLoginAttempts: 0,
              lastLoginAt: new Date().toISOString()
            });
          } else {
            await updateDoc(userRef, {
              lastLoginAt: new Date().toISOString()
            });
          }
        }
        
        return userCredential;
      })
      .catch(async (error) => {
        // If the error is due to invalid credentials and we have an email
        if (error.code === 'auth/wrong-password' && email) {
          try {
            // Try to find the user by email to update failed attempts
            const usersSnapshot = await getDocs(query(collection(db, 'shops'), where('userEmail', '==', email)));
            
            if (!usersSnapshot.empty) {
              const userDoc = usersSnapshot.docs[0];
              const userData = userDoc.data();
              const currentAttempts = userData.failedLoginAttempts || 0;
              
              // Update failed attempts count
              await updateDoc(doc(db, 'shops', userDoc.id), {
                failedLoginAttempts: currentAttempts + 1,
                lastFailedLoginAt: new Date().toISOString()
              });
              
              // If too many failed attempts, lock the account
              if (currentAttempts + 1 >= 5) {
                await updateDoc(doc(db, 'shops', userDoc.id), {
                  accountStatus: 'locked',
                  lockedAt: new Date().toISOString()
                });
                throw new Error('Account locked due to too many failed login attempts. Please contact an administrator.');
              }
            }
          } catch (innerError) {
            // If we have a custom error message, throw it
            if (innerError.message.includes('Account locked')) {
              throw innerError;
            }
            // Otherwise just throw the original error
          }
        }
        
        // Re-throw the original error
        throw error;
      });
  }

  // Sign out
  const logout = async () => {
    try {
      await signOut(auth);
      setIsGuest(false);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const createGuestAccount = async (email, password) => {
    try {
      console.log('Starting guest account creation for:', email);
      
      // Check if guest account already exists
      const usersRef = collection(db, 'users');
      const shopsRef = collection(db, 'shops');
      
      console.log('Checking for existing guest accounts...');
      
      // Check users collection
      const userQ = query(usersRef, where('email', '==', email));
      const userQuerySnapshot = await getDocs(userQ);
      
      // Check shops collection  
      const shopQ = query(shopsRef, where('userEmail', '==', email));
      const shopQuerySnapshot = await getDocs(shopQ);
      
      if (!userQuerySnapshot.empty) {
        console.log('Found existing account in users collection');
        throw new Error('Guest account with this email already exists');
      }
      
      if (!shopQuerySnapshot.empty) {
        console.log('Found existing account in shops collection');
        throw new Error('Guest account with this email already exists');
      }

      console.log('No existing account found, creating Firebase Auth user...');
      
      // Create guest account in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Firebase Auth user created with UID:', user.uid);

      // Create guest shop data
      const guestShopData = {
        shopName: 'Guest Account',
        userEmail: email,
        password: password, // Store password for admin view
        phone: '',
        address: '',
        createdAt: serverTimestamp(),
        isGuest: true,
        guestPermissions: {
          canAccessNewReceipt: true,
          canAccessReceipts: false,
          canAccessStock: false,
          canAccessEmployees: false,
          canAccessSettings: false,
          canAccessAnalytics: false,
          canAccessSalary: false,
          canAccessAttendance: false,
          canAccessExpenses: false
        }
      };

      console.log('Saving guest data to Firestore shops collection...');
      
      // Save guest data to Firestore - use shops collection for consistency
      await setDoc(doc(db, 'shops', user.uid), guestShopData);
      
      console.log('Guest account created successfully');

      return { success: true, message: 'Guest account created successfully' };
    } catch (error) {
      console.error('Create guest account error:', error.code || error.message);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        throw new Error('This email is already registered');
      }
      
      if (error.code === 'auth/invalid-email') {
        throw new Error('Invalid email address');
      }
      
      if (error.code === 'auth/weak-password') {
        throw new Error('Password is too weak. Please use a stronger password.');
      }
      
      throw error;
    }
  };

  const loginAsGuest = async (email, password) => {
    try {
      console.log('Starting guest login process for:', email);
      
      // First, check if this email exists as a guest account in shops collection
      const shopsRef = collection(db, 'shops');
      const guestQuery = query(shopsRef, where('userEmail', '==', email), where('isGuest', '==', true));
      const guestSnapshot = await getDocs(guestQuery);
      
      if (guestSnapshot.empty) {
        console.log('No guest account found for email:', email);
        throw new Error('Guest account not found');
      }
      
      console.log('Guest account found, attempting authentication...');
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      console.log('Authentication successful, verifying guest status...');
      
      // Double-check guest status after login
      const shopDoc = await getDoc(doc(db, 'shops', user.uid));
      const shopData = shopDoc.data();
      
      if (!shopData || !shopData.isGuest) {
        console.log('Account exists but is not a guest account, signing out...');
        await signOut(auth);
        throw new Error('This account is not a guest account');
      }
      
      console.log('Guest login verified successfully');
      return { success: true, message: 'Guest login successful' };
      
    } catch (error) {
      console.error('Guest login error:', error.code || error.message);
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/too-many-requests') {
        console.error('Rate limit exceeded - too many login attempts');
        throw error; // Re-throw rate limit errors immediately
      }
      
      if (error.code === 'auth/user-not-found') {
        throw new Error('Guest account not found');
      }
      
      if (error.code === 'auth/wrong-password') {
        throw new Error('Invalid password for guest account');
      }
      
      // Re-throw the original error for proper handling
      throw error;
    }
  };

  // Fetch shop data from Firestore
  function getShopData(userId) {
    return getDoc(doc(db, 'shops', userId))
      .then(shopDoc => {
        if (shopDoc.exists()) {
          const data = shopDoc.data();
          setShopData(data);
          return data;
        } else {
          return null;
        }
      });
  }
  
  // Update shop data
  function updateShopData(updatedData) {
    if (!currentUser) return Promise.reject(new Error('No user logged in'));
    
    return updateDoc(doc(db, 'shops', currentUser.uid), updatedData)
      .then(() => {
        // Update local state with new data
        setShopData(prevData => ({
          ...prevData,
          ...updatedData
        }));
        return true;
      });
  }

  // Listen for auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Check if staff account
        const staffDoc = await getDoc(doc(db, 'staff', user.uid));
        if (staffDoc.exists()) {
          const staffDocData = staffDoc.data();
          setStaffData(staffDocData);
          setIsStaff(true);
          setIsGuest(false);
          
          // Get shop data for staff
          const shopDoc = await getDoc(doc(db, 'shops', staffDocData.shopId));
          if (shopDoc.exists()) {
            setShopData(shopDoc.data());
          }
          setLoading(false);
          return;
        }
        
        getShopData(user.uid)
          .then((data) => {
            // Check if this is a guest account
            if (data && data.isGuest) {
              setIsGuest(true);
              setIsStaff(false);
            } else {
              setIsGuest(false);
              setIsStaff(false);
            }
          })
          .finally(() => {
            setLoading(false);
          });
      } else {
        setShopData(null);
        setStaffData(null);
        setIsGuest(false);
        setIsStaff(false);
        setLoading(false);
      }
    });
    
    return unsubscribe;
  }, []);

  // Change password with policy enforcement
  function changePassword(newPassword) {
    if (!currentUser) return Promise.reject(new Error('No user logged in'));
    
    // Validate password against policy
    const passwordValidation = validatePassword(newPassword);
    
    if (!passwordValidation.isValid) {
      return Promise.reject(new Error(passwordValidation.message));
    }
    
    return updatePassword(currentUser, newPassword)
      .then(() => {
        // Update password change timestamp in Firestore
        return updateDoc(doc(db, 'shops', currentUser.uid), {
          lastPasswordChange: new Date().toISOString()
        });
      });
  }

  // Sign in with Google
  function loginWithGoogle() {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(auth, provider)
      .then(async (result) => {
        const user = result.user;
        const userRef = doc(db, 'shops', user.uid);
        const userDoc = await getDoc(userRef);
        
        // If this is the first time signing in with Google
        if (!userDoc.exists()) {
          // Create a new shop document for this Google user
          await setDoc(userRef, {
            userEmail: user.email,
            displayName: user.displayName || '',
            photoURL: user.photoURL || '',
            createdAt: new Date().toISOString(),
            lastLoginAt: new Date().toISOString(),
            accountStatus: 'active',
            authProvider: 'google'
          });
        } else {
          // Update last login time
          await updateDoc(userRef, {
            lastLoginAt: new Date().toISOString()
          });
        }
        
        return result;
      });
  }

  // Determine root shop id (owner id for staff)
  const primaryShopId = isStaff && staffData && staffData.shopId
    ? staffData.shopId
    : (currentUser ? currentUser.uid : null);

  // Branch management
  useEffect(() => {
    const loadBranches = async () => {
      if (!primaryShopId) {
        setBranches([]);
        setActiveBranchId(null);
        setBranchesLoading(false);
        return;
      }

      setBranchesLoading(true);

      try {
        const branchesRef = collection(db, 'shops', primaryShopId, 'branches');
        const snapshot = await getDocs(branchesRef);
        let branchList = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        // Ensure a default branch exists that maps to the original shop id
        const hasDefaultBranch = branchList.some(b => b.id === primaryShopId);
        if (!hasDefaultBranch) {
          const defaultBranch = {
            name: 'Main Branch',
            createdAt: new Date().toISOString(),
            isDefault: true
          };
          await setDoc(doc(db, 'shops', primaryShopId, 'branches', primaryShopId), defaultBranch);
          branchList.push({ id: primaryShopId, ...defaultBranch });
        }

        setBranches(branchList);

        const storageKey = `activeBranch_${primaryShopId}`;
        const storedBranchId = (typeof window !== 'undefined') ? window.localStorage.getItem(storageKey) : null;
        const validStored = storedBranchId && branchList.some(b => b.id === storedBranchId);
        const branchToUse = validStored ? storedBranchId : primaryShopId;

        setActiveBranchId(branchToUse);

        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, branchToUse);
        }
      } catch (error) {
        console.error('Failed to load branches:', error);
      } finally {
        setBranchesLoading(false);
      }
    };

    loadBranches();
  }, [primaryShopId]);

  const selectBranch = (branchId) => {
    if (!branchId || !primaryShopId) return;
    const exists = branches.some(b => b.id === branchId);
    if (!exists) return;

    setActiveBranchId(branchId);
    const storageKey = `activeBranch_${primaryShopId}`;
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, branchId);
    }
  };

  const addBranch = async (name) => {
    if (!primaryShopId) throw new Error('No shop available for branches');
    if (isStaff || isGuest) throw new Error('Only shop owners can add branches');

    const trimmedName = (name || '').trim();
    if (!trimmedName) throw new Error('Branch name is required');

    const branchesRef = collection(db, 'shops', primaryShopId, 'branches');
    const newBranchPayload = {
      name: trimmedName,
      createdAt: new Date().toISOString(),
      createdBy: currentUser?.uid || primaryShopId
    };

    const docRef = await addDoc(branchesRef, newBranchPayload);
    const newBranch = { id: docRef.id, ...newBranchPayload };
    setBranches(prev => [...prev, newBranch]);
    selectBranch(docRef.id);
    return newBranch;
  };

  const deleteBranch = async (branchId) => {
    if (!primaryShopId) throw new Error('No shop available for branches');
    if (isStaff || isGuest) throw new Error('Only shop owners can delete branches');
    
    // Prevent deleting the default/main branch
    if (branchId === primaryShopId) {
      throw new Error('Cannot delete the main branch');
    }

    // Check if branch exists
    const branchExists = branches.some(b => b.id === branchId);
    if (!branchExists) {
      throw new Error('Branch not found');
    }

    // If deleting the active branch, switch to default branch first
    if (activeBranchId === branchId) {
      selectBranch(primaryShopId);
    }

    // Delete from Firestore
    const branchRef = doc(db, 'shops', primaryShopId, 'branches', branchId);
    await deleteDoc(branchRef);

    // Update local state
    setBranches(prev => prev.filter(b => b.id !== branchId));
  };

  // Use the branch id as the scoped shop id for data, defaulting to the root shop
  const activeShopId = activeBranchId || primaryShopId;
  const isDefaultBranch = activeBranchId === primaryShopId;

  const value = {
    currentUser,
    shopData,
    staffData,
    loading,
    isGuest,
    isStaff,
    primaryShopId,
    activeShopId,
    activeBranchId,
    branches,
    branchesLoading,
    isDefaultBranch,
    selectBranch,
    addBranch,
    deleteBranch,
    registerShop,
    login,
    logout,
    getShopData,
    changePassword,
    updateShopData,
    loginWithGoogle,
    createGuestAccount,
    loginAsGuest
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}
