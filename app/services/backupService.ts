import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
  addDoc
} from 'firebase/firestore';
import {
  ref,
  getDownloadURL,
  uploadBytes,
  listAll,
  deleteObject
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { Voucher, VoucherEvent } from '../types/voucher';
import { User } from '../config/firebase';

export interface BackupMetadata {
  version: string;
  createdAt: string;
  dateRange: {
    start: string;
    end: string;
  };
  summary: {
    totalVouchers: number;
    totalImages: number;
    totalUsers: number;
    totalEvents: number;
  };
  firebaseConfig: {
    projectId: string;
    storageBucket: string;
  };
}

export interface BackupData {
  metadata: BackupMetadata;
  vouchers: Voucher[];
  users: User[];
  images: {
    [key: string]: {
      url: string;
      path: string;
      data: string; // base64 encoded image data
      contentType: string;
    };
  };
}

export interface BackupImportResult {
  success: boolean;
  message: string;
  details: {
    vouchersProcessed: number;
    vouchersSkipped: number;
    vouchersRestored: number;
    imagesProcessed: number;
    imagesSkipped: number;
    imagesRestored: number;
    usersProcessed: number;
    usersSkipped: number;
    usersRestored: number;
    errors: string[];
  };
}

export class BackupService {
  private static readonly BACKUP_VERSION = '1.0.0';
  private static readonly MAX_BATCH_SIZE = 500;

  /**
   * Export daily backup for a specific date
   */
  static async exportDailyBackup(targetDate: Date): Promise<BackupData> {
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
      const userIds = new Set<string>();
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

      const metadata: BackupMetadata = {
        version: this.BACKUP_VERSION,
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

      const backupData: BackupData = {
        metadata,
        vouchers,
        users,
        images
      };

      console.log('Daily backup export completed successfully');
      return backupData;

    } catch (error) {
      console.error('Error during daily backup export:', error);
      throw new Error(`Backup export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export backup for a date range
   */
  static async exportDateRangeBackup(startDate: Date, endDate: Date): Promise<BackupData> {
    console.log(`Starting date range backup export from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);

    const startOfDay = new Date(startDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(endDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
      const vouchers = await this.getVouchersForDate(startOfDay, endOfDay);
      console.log(`Found ${vouchers.length} vouchers for backup`);

      const userIds = new Set<string>();
      vouchers.forEach(voucher => {
        userIds.add(voucher.created_by_user_id);
        voucher.events.forEach(event => {
          if (event.user_id) userIds.add(event.user_id);
          if (event.details.sender_id) userIds.add(event.details.sender_id);
          if (event.details.receiver_id) userIds.add(event.details.receiver_id);
        });
      });

      const users = await this.getUsersByIds(Array.from(userIds));
      const images = await this.getImagesForVouchers(vouchers);

      const metadata: BackupMetadata = {
        version: this.BACKUP_VERSION,
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

      return {
        metadata,
        vouchers,
        users,
        images
      };

    } catch (error) {
      console.error('Error during date range backup export:', error);
      throw new Error(`Backup export failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Import backup data with validation and restoration
   */
  static async importBackup(backupData: BackupData): Promise<BackupImportResult> {
    console.log('Starting backup import process');

    const result: BackupImportResult = {
      success: true,
      message: 'Backup import completed successfully',
      details: {
        vouchersProcessed: 0,
        vouchersSkipped: 0,
        vouchersRestored: 0,
        imagesProcessed: 0,
        imagesSkipped: 0,
        imagesRestored: 0,
        usersProcessed: 0,
        usersSkipped: 0,
        usersRestored: 0,
        errors: []
      }
    };

    try {
      // Validate backup data
      if (!backupData.metadata || !backupData.vouchers) {
        throw new Error('Invalid backup data structure');
      }

      console.log(`Processing backup version ${backupData.metadata.version}`);

      // Process users first
      console.log('Processing users...');
      for (const user of backupData.users) {
        try {
          const userResult = await this.processUser(user);
          result.details.usersProcessed++;

          if (userResult.restored) {
            result.details.usersRestored++;
            console.log(`User restored: ${user.uid}`);
          } else {
            result.details.usersSkipped++;
            console.log(`User skipped (already exists): ${user.uid}`);
          }
        } catch (error) {
          result.details.errors.push(`User ${user.uid}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Process images
      console.log('Processing images...');
      for (const [imageKey, imageData] of Object.entries(backupData.images)) {
        try {
          const imageResult = await this.processImage(imageKey, imageData);
          result.details.imagesProcessed++;

          if (imageResult.restored) {
            result.details.imagesRestored++;
            console.log(`Image restored: ${imageKey}`);
          } else {
            result.details.imagesSkipped++;
            console.log(`Image skipped (already exists): ${imageKey}`);
          }
        } catch (error) {
          result.details.errors.push(`Image ${imageKey}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Process vouchers
      console.log('Processing vouchers...');
      for (const voucher of backupData.vouchers) {
        try {
          const voucherResult = await this.processVoucher(voucher);
          result.details.vouchersProcessed++;

          if (voucherResult.restored) {
            result.details.vouchersRestored++;
            console.log(`Voucher restored: ${voucher.voucher_no}`);
          } else {
            result.details.vouchersSkipped++;
            console.log(`Voucher skipped (already exists): ${voucher.voucher_no}`);
          }
        } catch (error) {
          result.details.errors.push(`Voucher ${voucher.voucher_no}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (result.details.errors.length > 0) {
        result.success = false;
        result.message = `Backup import completed with ${result.details.errors.length} errors`;
      }

      console.log('Backup import process completed');
      return result;

    } catch (error) {
      console.error('Error during backup import:', error);
      result.success = false;
      result.message = `Backup import failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      result.details.errors.push(result.message);
      return result;
    }
  }

  /**
   * Get vouchers for a specific date range
   */
  private static async getVouchersForDate(startDate: Date, endDate: Date): Promise<Voucher[]> {
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
    })) as Voucher[];
  }

  /**
   * Get users by their IDs
   */
  private static async getUsersByIds(userIds: string[]): Promise<User[]> {
    if (userIds.length === 0) return [];

    const usersRef = collection(db, 'users');
    const users: User[] = [];

    // Process in batches to avoid query limitations
    for (let i = 0; i < userIds.length; i += this.MAX_BATCH_SIZE) {
      const batch = userIds.slice(i, i + this.MAX_BATCH_SIZE);
      const batchPromises = batch.map(async (userId) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', userId));
          if (userDoc.exists()) {
            return userDoc.data() as User;
          }
          return null;
        } catch (error) {
          console.warn(`Failed to fetch user ${userId}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      users.push(...batchResults.filter(user => user !== null) as User[]);
    }

    return users;
  }

  /**
   * Get all images associated with vouchers
   */
  private static async getImagesForVouchers(vouchers: Voucher[]): Promise<BackupData['images']> {
    const images: BackupData['images'] = {};
    const imageUrls = new Set<string>();

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
  private static async downloadAndEncodeImage(imageUrl: string): Promise<BackupData['images'][string] | null> {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const blob = await response.blob();
      const contentType = blob.type;

      // Convert blob to base64
      const arrayBuffer = await blob.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      const base64 = btoa(String.fromCharCode(...uint8Array));

      // Extract path from URL
      const url = new URL(imageUrl);
      const path = url.pathname.replace(/^\/o\//, '').replace(/\?.*$/, '');

      return {
        url: imageUrl,
        path,
        data: base64,
        contentType
      };
    } catch (error) {
      console.error(`Error downloading image ${imageUrl}:`, error);
      return null;
    }
  }

  /**
   * Generate a unique key for an image
   */
  private static generateImageKey(imageUrl: string): string {
    const url = new URL(imageUrl);
    const path = url.pathname.replace(/^\/o\//, '').replace(/\?.*$/, '');
    return path.replace(/[^a-zA-Z0-9]/g, '_');
  }

  /**
   * Process a user during import
   */
  private static async processUser(user: User): Promise<{ restored: boolean }> {
    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid));

      if (userDoc.exists()) {
        console.log(`User ${user.uid} already exists - skipping`);
        return { restored: false };
      }

      // User doesn't exist, restore it
      await setDoc(doc(db, 'users', user.uid), {
        ...user,
        updatedAt: serverTimestamp()
      });

      return { restored: true };
    } catch (error) {
      console.error(`Error processing user ${user.uid}:`, error);
      throw error;
    }
  }

  /**
   * Process an image during import
   */
  private static async processImage(imageKey: string, imageData: BackupData['images'][string]): Promise<{ restored: boolean }> {
    try {
      // Check if image exists in storage
      const storageRef = ref(storage, imageData.path);

      try {
        await getDownloadURL(storageRef);
        console.log(`Image ${imageKey} already exists in storage - skipping`);
        return { restored: false };
      } catch (error) {
        // Image doesn't exist, restore it
        const uint8Array = new Uint8Array(
          atob(imageData.data).split('').map(char => char.charCodeAt(0))
        );

        await uploadBytes(storageRef, uint8Array, {
          contentType: imageData.contentType
        });

        return { restored: true };
      }
    } catch (error) {
      console.error(`Error processing image ${imageKey}:`, error);
      throw error;
    }
  }

  /**
   * Process a voucher during import
   */
  private static async processVoucher(voucher: Voucher): Promise<{ restored: boolean }> {
    try {
      // Check if voucher exists by voucher number
      const vouchersRef = collection(db, 'vouchers');
      const q = query(vouchersRef, where('voucher_no', '==', voucher.voucher_no));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        console.log(`Voucher ${voucher.voucher_no} already exists - skipping`);
        return { restored: false };
      }

      // Voucher doesn't exist, restore it
      const voucherData = {
        ...voucher,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      // Remove the id field as it will be auto-generated
      delete (voucherData as any).id;

      await addDoc(collection(db, 'vouchers'), voucherData);

      return { restored: true };
    } catch (error) {
      console.error(`Error processing voucher ${voucher.voucher_no}:`, error);
      throw error;
    }
  }

  /**
   * Create a downloadable backup file
   */
  static async createBackupFile(backupData: BackupData): Promise<Blob> {
    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    return blob;
  }

  /**
   * Load backup data from file
   */
  static async loadBackupFromFile(file: File): Promise<BackupData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const backupData = JSON.parse(content) as BackupData;

          // Validate backup data structure
          if (!backupData.metadata || !backupData.vouchers) {
            throw new Error('Invalid backup file format');
          }

          resolve(backupData);
        } catch (error) {
          reject(new Error(`Failed to parse backup file: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      };

      reader.onerror = () => {
        reject(new Error('Failed to read backup file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Get backup statistics
   */
  static async getBackupStats(targetDate: Date): Promise<{
    voucherCount: number;
    imageCount: number;
    userCount: number;
    totalSize: number;
  }> {
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const vouchers = await this.getVouchersForDate(startOfDay, endOfDay);
    const userIds = new Set<string>();

    vouchers.forEach(voucher => {
      userIds.add(voucher.created_by_user_id);
      voucher.events.forEach(event => {
        if (event.user_id) userIds.add(event.user_id);
        if (event.details.sender_id) userIds.add(event.details.sender_id);
        if (event.details.receiver_id) userIds.add(event.details.receiver_id);
      });
    });

    const users = await this.getUsersByIds(Array.from(userIds));
    const images = await this.getImagesForVouchers(vouchers);

    // Estimate total size (rough calculation)
    const voucherSize = JSON.stringify(vouchers).length;
    const userSize = JSON.stringify(users).length;
    const imageSize = Object.values(images).reduce((total, img) => total + img.data.length, 0);
    const totalSize = voucherSize + userSize + imageSize;

    return {
      voucherCount: vouchers.length,
      imageCount: Object.keys(images).length,
      userCount: users.length,
      totalSize
    };
  }
}
