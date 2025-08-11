// Re-export Firebase configuration from config/firebase.ts
export {
  db,
  storage,
  getCurrentUser,
  signOut,
  createUser,
  registerUser,
  approveUser,
  updateUserPassword,
  markUserForPasswordChange,
  loginWithPhoneAndPassword,
  loginWithEmailAndPassword,
  checkUserExists,
  checkUserApproved,
  // createDefaultAdminIfNotExists,
  clearAllUsers,
  testStorageAccess,
  setSession,
  getSession,
  clearSession,
  type User
} from '../config/firebase';

// Password change request functions
export {
  requestPasswordChange,
  getPasswordChangeRequests,
  resolvePasswordChangeRequest
} from '@/config/firebase';
