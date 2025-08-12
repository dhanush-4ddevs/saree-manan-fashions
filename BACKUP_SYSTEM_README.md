# Firebase Voucher Management - Backup System

This document describes the comprehensive backup system for the Firebase Voucher Management application. The system provides daily export/import capabilities for voucher data, associated images, and user information.

## Features

### Data Scope
- **Vouchers**: All voucher data including events, status, and metadata
- **Images**: All images associated with vouchers (base64 encoded)
- **Users**: All users involved in voucher transactions
- **Metadata**: Backup version, timestamps, and summary statistics

### Export Capabilities
- **Daily Backup**: Export all data for a specific date
- **Date Range Backup**: Export data for a custom date range
- **Statistics**: Preview backup size and content before export
- **File Download**: Automatic download of backup files

### Import Capabilities
- **Smart Restoration**: Only restores missing data
- **Validation**: Checks for existing data before restoration
- **Error Handling**: Detailed error reporting for failed operations
- **Progress Tracking**: Real-time progress updates during import

## Setup

### Prerequisites
- Node.js 18+ installed
- Firebase project configured
- Environment variables set up in `.env.local`

### Environment Variables
Ensure your `.env.local` file contains:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Usage

### Web Interface

1. **Access Backup Manager**
   - Navigate to `/admin-dashboard/backup-management`
   - Requires admin authentication

2. **Daily Backup Export**
   - Select a date using the date picker
   - Click "Export Daily Backup" to download the backup file
   - Use "Load Stats" to preview backup contents

3. **Date Range Backup Export**
   - Set start and end dates
   - Click "Export Date Range" to download the backup file

4. **Import Backup**
   - Click "Select Backup File" to choose a `.json` backup file
   - The system will automatically validate and restore missing data
   - View detailed results and any errors

### Command Line Interface

#### Manual Backup
```bash
# Backup today's data
npm run backup

# Backup specific date
npm run backup:date 2024-01-15

# Backup with custom output directory
node scripts/daily-backup.js 2024-01-15 ./my-backups
```

#### Automated Backup (Cron)
Add to your crontab for daily automated backups:
```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/your/project && npm run backup >> /var/log/backup.log 2>&1

# Weekly backup on Sundays at 3 AM
0 3 * * 0 cd /path/to/your/project && npm run backup:date $(date -d "yesterday" +%Y-%m-%d) >> /var/log/backup.log 2>&1
```

## Backup File Structure

The backup file is a JSON file with the following structure:

```json
{
  "metadata": {
    "version": "1.0.0",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "dateRange": {
      "start": "2024-01-15T00:00:00.000Z",
      "end": "2024-01-15T23:59:59.999Z"
    },
    "summary": {
      "totalVouchers": 25,
      "totalImages": 50,
      "totalUsers": 10,
      "totalEvents": 75
    },
    "firebaseConfig": {
      "projectId": "your-project-id",
      "storageBucket": "your-project.appspot.com"
    }
  },
  "vouchers": [
    {
      "id": "voucher_id",
      "voucher_no": "MFV20240115_0001",
      "voucher_status": "Dispatched",
      "created_at": "2024-01-15T09:00:00.000Z",
      "created_by_user_id": "user_id",
      "item_details": {
        "item_name": "Sample Item",
        "images": ["image_url_1", "image_url_2"],
        "initial_quantity": 100,
        "supplier_name": "Supplier Name",
        "supplier_price_per_piece": 50.00
      },
      "events": [...],
      "total_dispatched": 100,
      "total_received": 0,
      "total_forwarded": 0,
      "total_missing_on_arrival": 0,
      "total_damaged_on_arrival": 0,
      "total_damaged_after_work": 0,
      "admin_received_quantity": 0
    }
  ],
  "users": [
    {
      "uid": "user_id",
      "email": "user@example.com",
      "role": "vendor",
      "firstName": "John",
      "surname": "Doe",
      "phone": "1234567890",
      "companyName": "Company Name",
      "userCode": "vjd1234567890",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "approved": true
    }
  ],
  "images": {
    "vouchers_image_1_jpg": {
      "url": "https://firebasestorage.googleapis.com/...",
      "path": "vouchers/image_1.jpg",
      "data": "base64_encoded_image_data",
      "contentType": "image/jpeg"
    }
  }
}
```

## Import Process

### Validation Logic
The import process follows these rules:

1. **Users**:
   - Check if user exists by `uid`
   - Skip if exists, restore if missing
   - Log: "User already exists - skipping" or "User restored"

2. **Images**:
   - Check if image exists in Firebase Storage by path
   - Skip if exists, re-upload if missing
   - Log: "Image already exists in storage - skipping" or "Image restored"

3. **Vouchers**:
   - Check if voucher exists by `voucher_no`
   - Skip if exists, restore if missing
   - Log: "Voucher already exists - skipping" or "Voucher restored"

### Import Results
The system provides detailed import results:
- Total items processed
- Items restored vs skipped
- Detailed error messages
- Success/failure status

## Security Considerations

### Data Protection
- Backup files contain sensitive business data
- Store backup files securely
- Use encryption for backup storage if required
- Implement access controls for backup files

### Firebase Security Rules
Ensure your Firestore security rules allow backup operations:
```javascript
// Example security rules for backup operations
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow admin users to read all data for backup
    match /{document=**} {
      allow read: if request.auth != null &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
  }
}
```

## Troubleshooting

### Common Issues

1. **Permission Denied**
   - Ensure user has admin role
   - Check Firebase security rules
   - Verify environment variables

2. **Large Backup Files**
   - Consider date range backups for large datasets
   - Monitor storage usage
   - Implement backup rotation

3. **Import Failures**
   - Check backup file format
   - Verify Firebase connectivity
   - Review error logs for specific issues

4. **Image Download Failures**
   - Check image URLs are accessible
   - Verify Firebase Storage permissions
   - Monitor network connectivity

### Logs and Monitoring
- Check browser console for web interface errors
- Monitor command line output for CLI operations
- Review Firebase console for storage/database errors

## Best Practices

### Backup Strategy
1. **Daily Backups**: Create daily backups for recent data
2. **Weekly Archives**: Keep weekly backups for longer retention
3. **Monthly Snapshots**: Create monthly backups for historical data
4. **Test Restores**: Periodically test backup restoration

### Storage Management
1. **Backup Rotation**: Implement automatic cleanup of old backups
2. **Compression**: Consider compressing backup files for storage efficiency
3. **Multiple Locations**: Store backups in multiple locations for redundancy

### Performance Optimization
1. **Batch Processing**: Large imports are processed in batches
2. **Progress Tracking**: Monitor progress for large operations
3. **Error Recovery**: Failed operations can be retried

## API Reference

### BackupService Class

#### Methods

**exportDailyBackup(targetDate: Date): Promise<BackupData>**
- Exports all data for a specific date
- Returns backup data object

**exportDateRangeBackup(startDate: Date, endDate: Date): Promise<BackupData>**
- Exports data for a date range
- Returns backup data object

**importBackup(backupData: BackupData): Promise<BackupImportResult>**
- Imports backup data with validation
- Returns detailed import results

**getBackupStats(targetDate: Date): Promise<BackupStats>**
- Gets backup statistics for a date
- Returns voucher, image, and user counts

**createBackupFile(backupData: BackupData): Promise<Blob>**
- Creates downloadable backup file
- Returns blob for download

**loadBackupFromFile(file: File): Promise<BackupData>**
- Loads backup data from file
- Returns parsed backup data

## Support

For issues or questions about the backup system:
1. Check the troubleshooting section
2. Review Firebase console logs
3. Contact the development team

## Version History

- **v1.0.0**: Initial release with daily backup/restore functionality
- Support for voucher data, images, and users
- Smart import with validation
- Web interface and command line tools
