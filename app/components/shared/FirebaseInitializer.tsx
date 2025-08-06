'use client';

import { useEffect } from 'react';
import { createDefaultAdminIfNotExists, initializeDefaultJobWorks } from '@/config/firebase';

export default function FirebaseInitializer() {
  useEffect(() => {
    // Initialize default admin user and job works on app start
    const initializeFirebase = async () => {
      try {
        await createDefaultAdminIfNotExists();
        await initializeDefaultJobWorks();
      } catch (error) {
        console.error('Error initializing Firebase:', error);
      }
    };

    initializeFirebase();
  }, []);

  // This component doesn't render anything
  return null;
}
