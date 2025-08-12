#!/usr/bin/env node

/**
 * Daily Backup Script for Firebase Voucher Management System
 *
 * This script can be run manually or scheduled via cron to create daily backups
 * of voucher data and associated images.
 *
 * Usage:
 *   node scripts/daily-backup.js [date] [output-dir]
 *
 * Examples:
 *   node scripts/daily-backup.js                    # Backup today's data
 *   node scripts/daily-backup.js 2024-01-15         # Backup specific date
 *   node scripts/daily-backup.js 2024-01-15 ./backups # Backup to specific directory
 */

const fs = require('fs');
const path = require('path');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, getDocs, query, where, orderBy, getDoc, setDoc, updateDoc, serverTimestamp, addDoc } = require('firebase/firestore');
const { getStorage, ref, getDownloadURL, uploadBytes } = require('firebase/storage');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

// Firebase configuration
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// Backup configuration
const BACKUP_VERSION = '1.0.0';
const MAX_BATCH_SIZE = 500;

class BackupService {
  /**
   * Export daily backup for a specific date
   */
  static async exportDailyBackup(targetDate) {
    console.log(`Starting daily backup export for ${targetDate.toISOString().split('T')[0]}`);

    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      // Get vouchers created on the target date
      const vouchers = await this.getVouchersForDate(startOfDay, endOfDay);
      console.log(`Found ${vouchers.length} vouchers for backup`);

      // Get all users involved in these vouchers
      const userIds = new Set();
      vouchers.forEach(voucher => {
        userIds.add(voucher.created_by_user_id);
        voucher.events.forEach(event => {
          if (event.user_id) userIds.add(event.user_id);
          if (event.details.sender_id) userIds.add(event.details.sender_id);
          if (event.details.receiver_id) userIds.add(event.details.receiver_id);
        });
      });

      const users = await this.getUsersByIds(Array.from(userIds));
      console.log(`Found ${users.length} users for backup`);

      // Get all images associated with these vouchers
      const images = await this.getImagesForVouchers(vouchers);
      console.log(`Found ${Object.keys(images).length} images for backup`);

      const metadata = {
        version: BACKUP_VERSION,
        createdAt: new Date().toISOString(),
        dateRange: {
          start: startOfDay.toISOString(),
          end: endOfDay.toISOString()
        },
        summary: {
          totalVouchers: vouchers.length,
          totalImages: Object.keys(images).length,
          totalUsers: users.length,
          totalEvents: vouchers.reduce((total, voucher) => total + voucher.events.length, 0)
        },
        firebaseConfig: {
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ''
        }
      };

      const backupData = {
        metadata,
        vouchers,
        users,
        images
      };

      console.log('Daily backup export completed successfully');
      return backupData;

    } catch (error) {
      console.error('Error during daily backup export:', error);
      throw new Error(`Backup export failed: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Get vouchers for a specific date range
   */
  static async getVouchersForDate(startDate, endDate) {
    const vouchersRef = collection(db, 'vouchers');
    const q = query(
      vouchersRef,
      where('created_at', '>=', startDate.toISOString()),
      where('created_at', '<=', endDate.toISOString()),
      orderBy('created_at', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      ...doc.data(),
      id: doc.id
    }));
  }

  /**
   * Get users by their IDs
   */
  static async getUsersByIds(userIds) {
    if (userIds.length === 0) return [];

    const users = [];

    // Process in batches to avoid query limitations
    for (let i = 0; i < userIds.length; i += MAX_BATCH_SIZE) {
      const batch = userIds.slice(i, i + MAX_BATCH_SIZE);
      const batchPromises = batch.map(async (userId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            return userDoc.data();
          }
          return null;
        } catch (error) {
          console.warn(`Failed to fetch user ${userId}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      users.push(...batchResults.filter(user => user !== null));
    }

    return users;
  }

  /**
   * Get all images associated with vouchers
   */
  static async getImagesForVouchers(vouchers) {
    const images = {};
    const imageUrls = new Set();

    // Collect all image URLs from vouchers
    vouchers.forEach(voucher => {
      if (voucher.item_details.images) {
        voucher.item_details.images.forEach(url => {
          if (url && url.startsWith('https://')) {
            imageUrls.add(url);
          }
        });
      }
    });

    // Download and encode images
    for (const imageUrl of imageUrls) {
      try {
        const imageData = await this.downloadAndEncodeImage(imageUrl);
        if (imageData) {
          const imageKey = this.generateImageKey(imageUrl);
          images[imageKey] = imageData;
        }
      } catch (error) {
        console.warn(`Failed to download image ${imageUrl}:`, error);
      }
    }

    return images;
  }

  /**
   * Download and encode image to base64
   */
  static async downloadAndEncodeImage(imageUrl) {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');

      // Extract path from URL
      const url = new URL(imageUrl);
      const imagePath = url.pathname.replace(/^\/o\//, '').replace(/\?.*$/, '');

      return {
        url: imageUrl,
        path: imagePath,
        data: base64,
        contentType: response.headers.get('content-type') || 'image/jpeg'
      };
    } catch (error) {
      console.error(`Error downloading image ${imageUrl}:`, error);
      return null;
    }
  }

  /**
   * Generate a unique key for an image
   */
  static generateImageKey(imageUrl) {
    const url = new URL(imageUrl);
    const path = url.pathname.replace(/^\/o\//, '').replace(/\?.*$/, '');
    return path.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Create a backup file
   */
  static async createBackupFile(backupData, outputPath) {
    const jsonString = JSON.stringify(backupData, null, 2);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, jsonString);
    return outputPath;
  }
}

// Main execution function
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const targetDate = args[0] ? new Date(args[0]) : new Date();
    const outputDir = args[1] || './backups';

    // Validate date
    if (isNaN(targetDate.getTime())) {
      console.error('Invalid date format. Please use YYYY-MM-DD format.');
      process.exit(1);
    }

    console.log(`Starting backup process for ${targetDate.toISOString().split('T')[0]}`);
    console.log(`Output directory: ${outputDir}`);

    // Create backup
    const backupData = await BackupService.exportDailyBackup(targetDate);

    // Generate output filename
    const dateString = targetDate.toISOString().split('T')[0];
    const outputPath = path.join(outputDir, `backup_${dateString}.json`);

    // Save backup file
    await BackupService.createBackupFile(backupData, outputPath);

    console.log(`Backup completed successfully!`);
    console.log(`File saved to: ${outputPath}`);
    console.log(`Summary:`);
    console.log(`  - Vouchers: ${backupData.metadata.summary.totalVouchers}`);
    console.log(`  - Images: ${backupData.metadata.summary.totalImages}`);
    console.log(`  - Users: ${backupData.metadata.summary.totalUsers}`);
    console.log(`  - Events: ${backupData.metadata.summary.totalEvents}`);

    // Calculate file size
    const stats = fs.statSync(outputPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`  - File size: ${fileSizeInMB} MB`);

  } catch (error) {
    console.error('Backup failed:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { BackupService };
