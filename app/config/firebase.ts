import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, documentId, deleteDoc, updateDoc, orderBy } from 'firebase/firestore';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Log config for debug purposes
console.log("Firebase Config is using environment variables");

// Initialize Firebase (only once)
let app: FirebaseApp;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  console.log("Firebase initialized (app/config/firebase.ts)");
} else {
  app = getApps()[0];
  console.log("Using existing Firebase app (app/config/firebase.ts)");
}

export const db = getFirestore(app);
export const storage = getStorage(app);

// Verify storage configuration is correct
const verifyStorageConfig = () => {
  try {
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    console.log("Firebase Storage initialized with bucket:", bucket);
    if (!bucket) {
      console.warn("Warning: Firebase Storage bucket not properly configured!");
    }
  } catch (err) {
    console.error("Error checking Firebase Storage configuration:", err);
  }
};

// Run verification in development
if (process.env.NODE_ENV === 'development') {
  verifyStorageConfig();
}

const generateUserCode = (firstName: string, surname: string, phone: string, role: 'admin' | 'vendor' | 'master_admin'): string => {
  const prefix = role === 'admin' || role === 'master_admin' ? 'a' : 'v';
  const firstInitial = firstName?.charAt(0).toLowerCase() || '';
  const surnameInitial = surname?.charAt(0).toLowerCase() || '';

  // Clean non-digits from phone and get last 10 digits.
  // If phone has fewer than 10 digits, it will take all available digits.
  const phoneSuffix = phone?.replace(/\D/g, '').slice(-10) || '';

  // Fallback if essential parts are missing or if no phone digits are available after cleaning.
  if (!firstName || !surname || !phoneSuffix) {
    console.warn(`User code generated with fallback due to missing data (firstName: ${firstName}, surname: ${surname}, rawPhone: ${phone}, role: ${role}) or insufficient phone digits.`);
    // Using a slightly longer Date.now() slice for fallback to improve uniqueness.
    return `${prefix}${firstInitial}${surnameInitial}${Date.now().toString().slice(-7)}`.toLowerCase();
  }

  return `${prefix}${firstInitial}${surnameInitial}${phoneSuffix}`.toLowerCase();
};

export interface User {
  uid: string;
  email: string;
  role: 'admin' | 'vendor' | 'master_admin';
  firstName?: string;
  surname?: string;
  phone?: string;
  companyName?: string;
  userCode?: string;
  password?: string;
  designation?: string;
  vendorJobWork?: string;
  address?: {
    line1: string;
    city: string;
    district: string;
    state: string;
    country: string;
    pincode: string;
  };
  photo?: string | null;
  profilePhotoUrl?: string;
  kycDocuments?: {
    photo?: string;
    aadhar?: string;
    companyId?: string;
    drivingLicense?: string;
    gstin?: string;
    pancard?: string;
    passport?: string;
    voterId?: string;
  };
  createdAt?: string;
  approved?: boolean;
  isFirstLogin?: boolean;
  requiresPasswordChange?: boolean;
  kycStatus?: string;
}

export interface JobWork {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt?: string;
}

// Session management
const SESSION_KEY = 'user_session';

export const setSession = (user: User) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }
};

export const getSession = (): User | null => {
  if (typeof window !== 'undefined') {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  }
  return null;
};

export const clearSession = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(SESSION_KEY);
  }
};

// Check if user exists in Firestore
export const checkUserExists = async (phone: string): Promise<boolean> => {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', cleanPhone));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking user existence:', error);
    throw error;
  }
};

// Check if user exists and is approved in Firestore
export const checkUserApproved = async (phone: string): Promise<boolean> => {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', cleanPhone), where('approved', '==', true));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Error checking user approval:', error);
    throw error;
  }
};

// Check if user is master admin
export const isMasterAdmin = (user: User | null): boolean => {
  return user?.phone === '9876543210' || user?.role === 'master_admin';
};

// Create default admin if it doesn't exist
export const createDefaultAdminIfNotExists = async (): Promise<void> => {
  const adminPhone = '9999999999';
  const adminPassword = 'admin123';

  try {
    // First check if admin exists in Firestore
    const exists = await checkUserExists(adminPhone);

    if (!exists) {
      console.log('Creating default admin account...');

      const adminData: User = {
        uid: `admin_${Date.now()}`,
        email: 'admin@gmail.com',
        phone: adminPhone,
        password: adminPassword,
        role: 'admin',
        firstName: 'Admin',
        surname: 'User',
        userCode: `a-${Date.now()}`,
        createdAt: new Date().toISOString(),
        approved: true,
        isFirstLogin: false,
        requiresPasswordChange: false
      };

      await setDoc(doc(db, 'users', adminData.uid), adminData);
      console.log('Created default admin account successfully');
    } else {
      console.log('Default admin already exists');
    }
  } catch (error) {
    console.error('Error in createDefaultAdminIfNotExists:', error);
    throw error;
  }
};

// Create master admin if it doesn't exist
export const createMasterAdminIfNotExists = async (): Promise<void> => {
  const masterAdminPhone = '9876543210';
  const masterAdminPassword = 'master123';

  try {
    // First check if master admin exists in Firestore
    const exists = await checkUserExists(masterAdminPhone);

    if (!exists) {
      console.log('Creating master admin account...');

      const masterAdminData: User = {
        uid: `master_admin_${Date.now()}`,
        email: 'master@admin.com',
        phone: masterAdminPhone,
        password: masterAdminPassword,
        role: 'master_admin',
        firstName: 'Master',
        surname: 'Admin',
        userCode: `ma-${Date.now()}`,
        createdAt: new Date().toISOString(),
        approved: true,
        isFirstLogin: false,
        requiresPasswordChange: false
      };

      await setDoc(doc(db, 'users', masterAdminData.uid), masterAdminData);
      console.log('Created master admin account successfully');
    } else {
      console.log('Master admin already exists');
    }
  } catch (error) {
    console.error('Error in createMasterAdminIfNotExists:', error);
    throw error;
  }
};

// Login with phone/password
export const loginWithPhoneAndPassword = async (phone: string, password: string) => {
  try {
    // First ensure default admin exists
    if (phone === '9999999999') {
      await createDefaultAdminIfNotExists();
    }

    // First ensure master admin exists
    if (phone === '9876543210') {
      await createMasterAdminIfNotExists();
    }

    // Clean phone number (remove spaces, dashes, etc.)
    const cleanPhone = phone.replace(/\D/g, '');

    // Find user by phone number
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', cleanPhone));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('No account found with this phone number.');
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as User;

    console.log('Login attempt:', {
      inputPhone: phone,
      cleanPhone,
      storedPhone: userData.phone,
      inputPassword: password,
      storedPassword: userData.password
    });

    // Check password
    if (userData.password !== password) {
      throw new Error('Incorrect password.');
    }

    // Check if user is approved
    if (!userData.approved) {
      throw new Error('Your account is pending approval. Please contact an administrator.');
    }

    // Check if this is a first login (using default password)
    if (userData.isFirstLogin === true) {
      // Set session even for first login so password change can work
      setSession(userData);
      // Return user data with flag for first login
      return {
        ...userData,
        requiresPasswordChange: true
      };
    }

    // Set session
    setSession(userData);

    return userData;
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.message || 'Login failed. Please try again.');
  }
};

// Login with email/password (for backward compatibility)
export const loginWithEmailAndPassword = async (email: string, password: string) => {
  try {
    // Find user by email
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('No account found with this email.');
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as User;

    // Check password
    if (userData.password !== password) {
      throw new Error('Incorrect password.');
    }

    // Check if user is approved
    if (!userData.approved) {
      throw new Error('Your account is pending approval. Please contact an administrator.');
    }

    // Check if this is a first login (using default password)
    if (userData.isFirstLogin === true) {
      // Set session even for first login so password change can work
      setSession(userData);
      // Return user data with flag for first login
      return {
        ...userData,
        requiresPasswordChange: true
      };
    }

    // Set session
    setSession(userData);

    return userData;
  } catch (error: any) {
    console.error('Login error:', error);
    throw new Error(error.message || 'Login failed. Please try again.');
  }
};

// Helper function to convert data URL to Blob
const dataURLtoBlob = (dataURL: string) => {
  const arr = dataURL.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

// Helper function to upload profile photo to Firebase Storage
const uploadProfilePhotoToStorage = async (dataURL: string, userId: string): Promise<string> => {
  try {
    if (!dataURL) return '';

    // Skip if not a data URL
    if (!dataURL.startsWith('data:')) return dataURL;

    const blob = dataURLtoBlob(dataURL);
    const photoRef = ref(storage, `users/${userId}/profile-photo`);

    // Upload the blob to Firebase Storage
    const uploadTask = uploadBytesResumable(photoRef, blob);

    // Return a promise that resolves with the download URL
    return new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          // Optional: Track upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          console.log(`Upload progress: ${progress}%`);
        },
        (error) => {
          console.error('Error uploading profile photo:', error);
          reject(error);
        },
        async () => {
          // Upload completed successfully, get download URL
          try {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            resolve(downloadURL);
          } catch (error) {
            console.error('Error getting download URL:', error);
            reject(error);
          }
        }
      );
    });
  } catch (error) {
    console.error('Error in uploadProfilePhotoToStorage:', error);
    throw error;
  }
};

// Clear all users from Firestore
export const clearAllUsers = async () => {
  try {
    const usersRef = collection(db, 'users');
    const querySnapshot = await getDocs(usersRef);

    const deletePromises = querySnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    console.log('All users cleared from Firestore');
  } catch (error) {
    console.error('Error clearing users:', error);
    throw error;
  }
};

// Create new user (admin only)
export const createUser = async (userData: Partial<User>, creatorUid: string) => {
  let photoURL = '';

  try {
    // Verify creator is an admin
    const creatorDoc = await getDoc(doc(db, 'users', creatorUid));
    const creatorData = creatorDoc.data() as User;

    if (!creatorData || creatorData.role !== 'admin') {
      throw new Error('Only admins can create new users');
    }

    // Check if user already exists
    if (userData.phone) {
      const existingUser = await checkUserExists(userData.phone);
      if (existingUser) {
        throw new Error('A user with this phone number already exists');
      }
    }

    // Upload profile photo to Firebase Storage if provided
    let shouldUseBase64 = false;
    if (userData.photo && userData.photo.startsWith('data:')) {
      try {
        photoURL = await uploadProfilePhotoToStorage(userData.photo, `user_${Date.now()}`);
        console.log("Photo uploaded successfully, URL:", photoURL);
      } catch (photoError) {
        console.error("Failed to upload profile photo:", photoError);
        shouldUseBase64 = true;
      }
    }

    const userRole = userData.role || 'vendor';
    const userFirstName = userData.firstName || '';
    const userSurname = userData.surname || '';
    const userPhone = (userData.phone || '').replace(/\D/g, ''); // Clean phone number

    const userDataToSave: User = {
      uid: `user_${Date.now()}`,
      email: userData.email || '',
      role: userRole,
      firstName: userFirstName,
      surname: userSurname,
      phone: userPhone,
      password: userData.password || userPhone, // Save the password
      companyName: userData.companyName || '',
      userCode: userData.userCode || generateUserCode(userFirstName, userSurname, userPhone, userRole),
      designation: userData.designation || '',
      vendorJobWork: userData.vendorJobWork || '',
      address: userData.address,
      photo: shouldUseBase64 ? userData.photo : null,
      ...(photoURL ? { profilePhotoUrl: photoURL } : {}),
      createdAt: new Date().toISOString(),
      approved: true,
      isFirstLogin: true,
      requiresPasswordChange: true
    };

    // Save user data to Firestore
    await setDoc(doc(db, 'users', userDataToSave.uid), userDataToSave);

    console.log('User created successfully:', {
      uid: userDataToSave.uid,
      phone: userDataToSave.phone,
      password: userDataToSave.password,
      role: userDataToSave.role
    });

    return userDataToSave;
  } catch (error: any) {
    console.error('Error creating user:', error);
    throw new Error(error.message || 'Failed to create user. Please try again.');
  }
};

// Register new user
export const registerUser = async (phone: string, password: string, userData: Partial<User>) => {
  let photoURL = '';
  let shouldUseBase64 = false;

  try {
    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');

    // Check if user already exists
    const existingUser = await checkUserExists(cleanPhone);
    if (existingUser) {
      throw new Error('A user with this phone number already exists');
    }

    // Upload profile photo to Firebase Storage if provided
    if (userData.photo && userData.photo.startsWith('data:')) {
      try {
        photoURL = await uploadProfilePhotoToStorage(userData.photo, `user_${Date.now()}`);
        console.log("Photo uploaded successfully, URL:", photoURL);
      } catch (photoError) {
        console.error("Failed to upload profile photo:", photoError);
        shouldUseBase64 = true;
      }
    }

    const userRole = userData.role || 'vendor';
    const userFirstName = userData.firstName || '';
    const userSurname = userData.surname || '';

    // Create user document in Firestore
    const userDataToSave: User = {
      uid: `user_${Date.now()}`,
      email: userData.email || '',
      role: userRole,
      firstName: userFirstName,
      surname: userSurname,
      phone: cleanPhone,
      password: password,
      companyName: userData.companyName || '',
      userCode: userData.userCode || generateUserCode(userFirstName, userSurname, phone, userRole),
      designation: userData.designation || '',
      vendorJobWork: userData.vendorJobWork || '',
      address: userData.address,
      photo: shouldUseBase64 ? userData.photo : null,
      ...(photoURL ? { profilePhotoUrl: photoURL } : {}),
      createdAt: new Date().toISOString(),
      approved: false,
      requiresPasswordChange: true
    };

    await setDoc(doc(db, 'users', userDataToSave.uid), userDataToSave);
    return userDataToSave;
  } catch (error: any) {
    console.error('Error registering user:', error);
    throw new Error(error.message || 'Registration failed. Please try again.');
  }
};

// Approve user (admin only)
export const approveUser = async (userId: string, adminUid: string) => {
  try {
    // Verify admin
    const adminDoc = await getDoc(doc(db, 'users', adminUid));
    const adminData = adminDoc.data() as User;

    if (!adminData || adminData.role !== 'admin') {
      throw new Error('Only admins can approve users');
    }

    // Update user document
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, { approved: true }, { merge: true });

    return true;
  } catch (error: any) {
    console.error('Error approving user:', error);
    throw new Error(error.message || 'Failed to approve user. Please try again.');
  }
};

// Get current authenticated user data
export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const session = getSession();
    if (session) {
      // Verify user still exists in database
      const userDoc = await getDoc(doc(db, 'users', session.uid));
      if (userDoc.exists()) {
        return userDoc.data() as User;
      } else {
        // User no longer exists in database, clear session
        clearSession();
        return null;
      }
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    clearSession();
    return null;
  }
};

// Sign out
export const signOut = async () => {
  try {
    clearSession();
  } catch (error) {
    console.error('Sign out error:', error);
    throw error;
  }
};

// Update user password and mark as no longer first login
export const updateUserPassword = async (newPassword: string) => {
  try {
    const currentUser = getSession();
    console.log('Updating password for user:', currentUser);

    if (!currentUser) {
      throw new Error('No authenticated user found');
    }

    // Update user document in Firestore
    const userRef = doc(db, 'users', currentUser.uid);
    await updateDoc(userRef, {
      password: newPassword,
      isFirstLogin: false,
      requiresPasswordChange: false
    });

    console.log('Password updated successfully in Firestore');

    // Update session with new data
    const updatedUser = { ...currentUser, password: newPassword, isFirstLogin: false, requiresPasswordChange: false };
    setSession(updatedUser);

    console.log('Session updated with new password');

    return true;
  } catch (error: any) {
    console.error('Error updating password:', error);
    throw new Error(error.message || 'Failed to update password. Please try again.');
  }
};

// For testing purposes - mark a user as requiring first login
export const markUserForPasswordChange = async (userId: string, adminUid: string) => {
  try {
    // Verify admin
    const adminDoc = await getDoc(doc(db, 'users', adminUid));
    const adminData = adminDoc.data() as User;

    if (!adminData || adminData.role !== 'admin') {
      throw new Error('Only admins can modify user settings');
    }

    // Update user document
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      isFirstLogin: true,
      requiresPasswordChange: true
    });

    return true;
  } catch (error: any) {
    console.error('Error marking user for password change:', error);
    throw new Error(error.message || 'Failed to update user settings. Please try again.');
  }
};

// Request password change (vendor function)
export const requestPasswordChange = async (phone: string) => {
  try {
    // Clean phone number
    const cleanPhone = phone.replace(/\D/g, '');

    // Find user by phone number
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phone', '==', cleanPhone));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error('No account found with this phone number.');
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data() as User;

    // Check if user is approved
    if (!userData.approved) {
      throw new Error('Your account is pending approval. Please contact an administrator.');
    }

    // Create password change request
    const requestData = {
      id: `request_${Date.now()}`,
      userId: userData.uid,
      userPhone: cleanPhone,
      userName: `${userData.firstName} ${userData.surname}`,
      userEmail: userData.email,
      requestType: 'password_change',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Save request to Firestore
    await setDoc(doc(db, 'passwordChangeRequests', requestData.id), requestData);

    console.log('Password change request created:', requestData);
    return true;
  } catch (error: any) {
    console.error('Error requesting password change:', error);
    throw new Error(error.message || 'Failed to request password change. Please try again.');
  }
};

// Get password change requests (admin function)
export const getPasswordChangeRequests = async (): Promise<any[]> => {
  try {
    const requestsRef = collection(db, 'passwordChangeRequests');
    const q = query(requestsRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const requests = querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));

    return requests;
  } catch (error) {
    console.error('Error fetching password change requests:', error);
    throw error;
  }
};

// Mark password change request as resolved (admin function)
export const resolvePasswordChangeRequest = async (requestId: string, adminUid: string) => {
  try {
    // Verify admin
    const adminDoc = await getDoc(doc(db, 'users', adminUid));
    const adminData = adminDoc.data() as User;

    if (!adminData || adminData.role !== 'admin') {
      throw new Error('Only admins can resolve password change requests');
    }

    // Update request status
    const requestRef = doc(db, 'passwordChangeRequests', requestId);
    await updateDoc(requestRef, {
      status: 'resolved',
      resolvedBy: adminUid,
      resolvedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    return true;
  } catch (error: any) {
    console.error('Error resolving password change request:', error);
    throw new Error(error.message || 'Failed to resolve request. Please try again.');
  }
};

// Test function for Storage access
export const testStorageAccess = async () => {
  try {
    console.log("Testing storage access");
    console.log("Storage bucket:", storage.app.options.storageBucket);

    const testRef = ref(storage, `test-${Date.now()}.txt`);
    const testBytes = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"

    // Create upload task
    const uploadTask = uploadBytesResumable(testRef, testBytes);

    // Wait for upload to complete
    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          console.log(`Test upload progress: ${(snapshot.bytesTransferred / snapshot.totalBytes) * 100}%`);
        },
        (error) => {
          reject(error);
        },
        () => {
          resolve();
        }
      );
    });

    console.log("Test upload successful");

    const downloadURL = await getDownloadURL(testRef);
    console.log("Test file URL:", downloadURL);

    return true;
  } catch (error) {
    console.error("Storage test failed:", error);
    return false;
  }
};

// JobWork Collection Management Functions
export const initializeDefaultJobWorks = async (): Promise<void> => {
  try {
    const jobWorksRef = collection(db, 'jobworks');
    const querySnapshot = await getDocs(jobWorksRef);

    // If jobworks collection is empty, create default job works
    if (querySnapshot.empty) {
      console.log('Creating default job works...');

      const defaultJobWorks = [
        { name: 'Dying Chaap', isDefault: true },
        { name: 'Dying 2D', isDefault: true },
        { name: 'Finishing / Polishing', isDefault: true },
        { name: 'Stone Work', isDefault: true },
        { name: 'Blouse Work', isDefault: true },
        { name: 'Embroidery Work', isDefault: true }
      ];

      const batch = [];
      for (const jobWork of defaultJobWorks) {
        const docRef = doc(jobWorksRef);
        batch.push(setDoc(docRef, {
          id: docRef.id,
          name: jobWork.name,
          isDefault: jobWork.isDefault,
          createdAt: new Date().toISOString()
        }));
      }

      await Promise.all(batch);
      console.log('Default job works created successfully');
    } else {
      console.log('Job works collection already exists');
    }
  } catch (error) {
    console.error('Error initializing default job works:', error);
    throw error;
  }
};

export const getAllJobWorks = async (): Promise<JobWork[]> => {
  try {
    const jobWorksRef = collection(db, 'jobworks');
    const q = query(jobWorksRef, orderBy('name'));
    const querySnapshot = await getDocs(q);

    const jobWorks: JobWork[] = [];
    querySnapshot.forEach((doc) => {
      jobWorks.push(doc.data() as JobWork);
    });

    return jobWorks;
  } catch (error) {
    console.error('Error fetching job works:', error);
    throw error;
  }
};

export const addJobWork = async (name: string, adminUid: string): Promise<JobWork> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminUid));
    const adminData = adminDoc.data() as User;

    if (!adminData || adminData.role !== 'admin') {
      throw new Error('Only admins can add job works');
    }

    // Check if job work already exists
    const jobWorksRef = collection(db, 'jobworks');
    const q = query(jobWorksRef, where('name', '==', name));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      throw new Error('A job work with this name already exists');
    }

    const docRef = doc(jobWorksRef);
    const newJobWork: JobWork = {
      id: docRef.id,
      name: name.trim(),
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    await setDoc(docRef, newJobWork);
    return newJobWork;
  } catch (error: any) {
    console.error('Error adding job work:', error);
    throw new Error(error.message || 'Failed to add job work');
  }
};

export const updateJobWork = async (id: string, name: string, adminUid: string): Promise<JobWork> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminUid));
    const adminData = adminDoc.data() as User;

    if (!adminData || adminData.role !== 'admin') {
      throw new Error('Only admins can update job works');
    }

    // Check if job work exists and is not default
    const jobWorkDoc = await getDoc(doc(db, 'jobworks', id));
    if (!jobWorkDoc.exists()) {
      throw new Error('Job work not found');
    }

    const jobWorkData = jobWorkDoc.data() as JobWork;
    if (jobWorkData.isDefault) {
      throw new Error('Default job works cannot be edited');
    }

    // Check if new name already exists
    const jobWorksRef = collection(db, 'jobworks');
    const q = query(jobWorksRef, where('name', '==', name));
    const querySnapshot = await getDocs(q);

    const existingJobWork = querySnapshot.docs.find(doc => doc.id !== id);
    if (existingJobWork) {
      throw new Error('A job work with this name already exists');
    }

    const updatedJobWork: Partial<JobWork> = {
      name: name.trim(),
      updatedAt: new Date().toISOString()
    };

    await updateDoc(doc(db, 'jobworks', id), updatedJobWork);

    return {
      ...jobWorkData,
      ...updatedJobWork
    };
  } catch (error: any) {
    console.error('Error updating job work:', error);
    throw new Error(error.message || 'Failed to update job work');
  }
};

export const deleteJobWork = async (id: string, adminUid: string): Promise<void> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminUid));
    const adminData = adminDoc.data() as User;

    if (!adminData || adminData.role !== 'admin') {
      throw new Error('Only admins can delete job works');
    }

    // Check if job work exists and is not default
    const jobWorkDoc = await getDoc(doc(db, 'jobworks', id));
    if (!jobWorkDoc.exists()) {
      throw new Error('Job work not found');
    }

    const jobWorkData = jobWorkDoc.data() as JobWork;
    if (jobWorkData.isDefault) {
      throw new Error('Default job works cannot be deleted');
    }

    await deleteDoc(doc(db, 'jobworks', id));
  } catch (error: any) {
    console.error('Error deleting job work:', error);
    throw new Error(error.message || 'Failed to delete job work');
  }
};
