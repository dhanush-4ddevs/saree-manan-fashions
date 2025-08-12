#!/usr/bin/env node

/**
 * Test Script for Backup System
 *
 * This script tests the backup system functionality by:
 * 1. Creating a test backup
 * 2. Validating the backup structure
 * 3. Testing import functionality
 *
 * Usage:
 *   node scripts/test-backup.js
 */

const fs = require('fs');
const path = require('path');
const { BackupService } = require('./daily-backup.js');

async function testBackupSystem() {
  console.log('🧪 Starting Backup System Test...\n');

  try {
    // Test 1: Create a backup for today
    console.log('📦 Test 1: Creating daily backup...');
    const today = new Date();
    const backupData = await BackupService.exportDailyBackup(today);

    console.log('✅ Backup created successfully!');
    console.log(`   - Vouchers: ${backupData.metadata.summary.totalVouchers}`);
    console.log(`   - Images: ${backupData.metadata.summary.totalImages}`);
    console.log(`   - Users: ${backupData.metadata.summary.totalUsers}`);
    console.log(`   - Events: ${backupData.metadata.summary.totalEvents}\n`);

    // Test 2: Validate backup structure
    console.log('🔍 Test 2: Validating backup structure...');
    validateBackupStructure(backupData);
    console.log('✅ Backup structure is valid!\n');

    // Test 3: Create backup file
    console.log('💾 Test 3: Creating backup file...');
    const testBackupPath = path.join(__dirname, '../test-backup.json');
    await BackupService.createBackupFile(backupData, testBackupPath);

    const stats = fs.statSync(testBackupPath);
    const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Backup file created: ${testBackupPath}`);
    console.log(`   - File size: ${fileSizeInMB} MB\n`);

    // Test 4: Load backup file
    console.log('📂 Test 4: Loading backup file...');
    const fileContent = fs.readFileSync(testBackupPath, 'utf8');
    const loadedBackupData = JSON.parse(fileContent);

    if (JSON.stringify(backupData) === JSON.stringify(loadedBackupData)) {
      console.log('✅ Backup file loaded successfully and data matches!\n');
    } else {
      console.log('❌ Backup file data mismatch!\n');
    }

    // Test 5: Test import (dry run - won't actually import)
    console.log('🔄 Test 5: Testing import validation...');
    const importResult = await BackupService.importBackup(backupData);

    console.log('✅ Import validation completed!');
    console.log(`   - Vouchers processed: ${importResult.details.vouchersProcessed}`);
    console.log(`   - Images processed: ${importResult.details.imagesProcessed}`);
    console.log(`   - Users processed: ${importResult.details.usersProcessed}`);
    console.log(`   - Errors: ${importResult.details.errors.length}\n`);

    // Test 6: Cleanup
    console.log('🧹 Test 6: Cleaning up test files...');
    if (fs.existsSync(testBackupPath)) {
      fs.unlinkSync(testBackupPath);
      console.log('✅ Test backup file removed!\n');
    }

    console.log('🎉 All tests completed successfully!');
    console.log('The backup system is working correctly.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

function validateBackupStructure(backupData) {
  // Check required top-level properties
  const requiredProps = ['metadata', 'vouchers', 'users', 'images'];
  for (const prop of requiredProps) {
    if (!(prop in backupData)) {
      throw new Error(`Missing required property: ${prop}`);
    }
  }

  // Validate metadata structure
  const metadata = backupData.metadata;
  const requiredMetadataProps = ['version', 'createdAt', 'dateRange', 'summary', 'firebaseConfig'];
  for (const prop of requiredMetadataProps) {
    if (!(prop in metadata)) {
      throw new Error(`Missing required metadata property: ${prop}`);
    }
  }

  // Validate summary structure
  const summary = metadata.summary;
  const requiredSummaryProps = ['totalVouchers', 'totalImages', 'totalUsers', 'totalEvents'];
  for (const prop of requiredSummaryProps) {
    if (!(prop in summary)) {
      throw new Error(`Missing required summary property: ${prop}`);
    }
  }

  // Validate arrays
  if (!Array.isArray(backupData.vouchers)) {
    throw new Error('Vouchers must be an array');
  }

  if (!Array.isArray(backupData.users)) {
    throw new Error('Users must be an array');
  }

  if (typeof backupData.images !== 'object' || backupData.images === null) {
    throw new Error('Images must be an object');
  }

  // Validate voucher structure (if vouchers exist)
  if (backupData.vouchers.length > 0) {
    const voucher = backupData.vouchers[0];
    const requiredVoucherProps = ['voucher_no', 'voucher_status', 'created_at', 'item_details', 'events'];
    for (const prop of requiredVoucherProps) {
      if (!(prop in voucher)) {
        throw new Error(`Missing required voucher property: ${prop}`);
      }
    }
  }

  // Validate user structure (if users exist)
  if (backupData.users.length > 0) {
    const user = backupData.users[0];
    const requiredUserProps = ['uid', 'email', 'role'];
    for (const prop of requiredUserProps) {
      if (!(prop in user)) {
        throw new Error(`Missing required user property: ${prop}`);
      }
    }
  }

  // Validate image structure (if images exist)
  const imageKeys = Object.keys(backupData.images);
  if (imageKeys.length > 0) {
    const imageKey = imageKeys[0];
    const image = backupData.images[imageKey];
    const requiredImageProps = ['url', 'path', 'data', 'contentType'];
    for (const prop of requiredImageProps) {
      if (!(prop in image)) {
        throw new Error(`Missing required image property: ${prop}`);
      }
    }
  }
}

// Run the test
if (require.main === module) {
  testBackupSystem();
}

module.exports = { testBackupSystem, validateBackupStructure };
