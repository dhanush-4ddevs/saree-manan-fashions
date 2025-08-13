'use client';

import React, { useState } from 'react';
import { Trash2, Settings as SettingsIcon, AlertTriangle } from 'lucide-react';
import { db } from '@/config/firebase';
import { collection, getDocs, deleteDoc, writeBatch } from 'firebase/firestore';

interface StatusMessage {
    type: '' | 'success' | 'error';
    message: string;
}

export default function SystemSettings() {
    const [isClearingData, setIsClearingData] = useState(false);
    const [clearProgress, setClearProgress] = useState(0);
    const [saveMessage, setSaveMessage] = useState<StatusMessage>({ type: '', message: '' });
    const [showClearConfirmation, setShowClearConfirmation] = useState(false);
    const [showDeleteAllConfirmation, setShowDeleteAllConfirmation] = useState(false);
    const [deletingAllUsers, setDeletingAllUsers] = useState(false);


    const handleClearAllData = async () => {
        try {
            setIsClearingData(true);
            setClearProgress(0);
            setSaveMessage({ type: '', message: 'Starting data clearance process...' });

            const collectionsToClear = [
                'vouchers',
                'payments',
                'notifications',
                'vendorNotifications',
                'passwordChangeRequests'
            ];

            let totalDeleted = 0;
            let totalDocuments = 0;

            for (const collectionName of collectionsToClear) {
                const collectionRef = collection(db, collectionName);
                const snapshot = await getDocs(collectionRef);
                totalDocuments += snapshot.size;
            }

            if (totalDocuments === 0) {
                setSaveMessage({ type: 'success', message: 'No data found to clear. All collections are already empty.' });
                setIsClearingData(false);
                setClearProgress(0);
                return;
            }

            for (const collectionName of collectionsToClear) {
                setSaveMessage({ type: '', message: `Clearing ${collectionName} collection...` });
                const collectionRef = collection(db, collectionName);
                const snapshot = await getDocs(collectionRef);

                const batchSize = 50;
                const documents = snapshot.docs;

                for (let i = 0; i < documents.length; i += batchSize) {
                    const batch = documents.slice(i, i + batchSize);
                    for (const docSnapshot of batch) {
                        await deleteDoc(docSnapshot.ref);
                        totalDeleted++;
                        const progress = (totalDeleted / totalDocuments) * 100;
                        setClearProgress(progress);
                    }
                    if (i + batchSize < documents.length) {
                        await new Promise((resolve) => setTimeout(resolve, 100));
                    }
                }
            }

            setSaveMessage({
                type: 'success',
                message: `Successfully cleared all data! Deleted ${totalDeleted} documents from ${collectionsToClear.length} collections.`
            });
            setClearProgress(100);
        } catch (error) {
            console.error('Error clearing data:', error);
            setSaveMessage({ type: 'error', message: 'Failed to clear data. Please try again or contact support if the issue persists.' });
        } finally {
            setIsClearingData(false);
            setTimeout(() => {
                setClearProgress(0);
                setSaveMessage({ type: '', message: '' });
            }, 5000);
        }
    };

    const handleDeleteAllUsers = async () => {
        try {
            setDeletingAllUsers(true);
            // Fetch all users
            const usersRef = collection(db, 'users');
            const usersSnapshot = await getDocs(usersRef);

            // Protect master admin by phone number 9876543210
            const usersToDelete = usersSnapshot.docs.filter((docSnap) => {
                const data = docSnap.data() as any;
                return data?.phone !== '9876543210';
            });

            if (usersToDelete.length === 0) {
                setSaveMessage({ type: 'error', message: 'No users to delete.' });
                return;
            }

            const batch = writeBatch(db);
            usersToDelete.forEach((docSnap) => batch.delete(docSnap.ref));
            await batch.commit();

            setSaveMessage({
                type: 'success',
                message: `Successfully deleted ${usersToDelete.length} user(s). The user with phone number 9876543210 was protected and not deleted.`
            });
            setShowDeleteAllConfirmation(false);
        } catch (error) {
            console.error('Error deleting all users:', error);
            setSaveMessage({ type: 'error', message: 'Failed to delete users. Please try again.' });
        } finally {
            setDeletingAllUsers(false);
            setTimeout(() => {
                setSaveMessage({ type: '', message: '' });
            }, 5000);
        }
    };



    return (
        <div className="max-w-6xl mx-auto p-0 lg:p-8 space-y-8">


            {/* Status Messages */}
            {saveMessage.message && (
                <div
                    className={`p-4 rounded-lg border flex items-start gap-3 ${saveMessage.type === 'success'
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : 'bg-red-50 text-red-800 border-red-200'
                        }`}
                >
                    {saveMessage.type === 'success' ? (
                        <div className="h-6 w-6 bg-green-500/90 rounded-full flex items-center justify-center flex-none">
                            <div className="h-2.5 w-2.5 bg-white rounded-full" />
                        </div>
                    ) : (
                        <AlertTriangle className="h-6 w-6 flex-none" />
                    )}
                    <div className="text-sm leading-6">{saveMessage.message}</div>
                </div>
            )}
            {/* Primary Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Clear All Data */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="h-10 w-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Clear All Data</h3>
                            <p className="text-sm text-gray-600">Permanently delete all system data (users are preserved).</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-red-50 p-4 rounded-md border border-red-200">
                            <h4 className="font-semibold text-red-800 mb-2 text-sm">Warning</h4>
                            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                                <li> This action is IRREVERSIBLE</li>
                                <li> All vouchers and events will be deleted</li>
                                <li> All payment records will be removed</li>
                                <li> All notifications will be cleared</li>
                                <li> All vendor notifications will be removed</li>
                                <li> All password change requests will be deleted</li>
                            </ul>
                            <p className="text-sm text-red-600 mt-2 font-medium">User accounts will be preserved.</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowClearConfirmation(true)}
                                disabled={isClearingData}
                                className="group relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {isClearingData ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                        Clearing Data... {clearProgress.toFixed(0)}%
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-5 w-5" />
                                        Clear All Data
                                    </>
                                )}
                            </button>
                        </div>

                        {isClearingData && (
                            <div className="w-full bg-white rounded-full h-2 border border-red-200">
                                <div className="bg-red-500 h-2 rounded-full transition-all duration-300" style={{ width: `${clearProgress}%` }}></div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Delete All Users Data */}
                <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start gap-3 mb-4">
                        <div className="h-10 w-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
                            <Trash2 className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">Delete All Users Data</h3>
                            <p className="text-sm text-gray-600">Permanently remove all user accounts and profile data. Master Admin will be preserved.</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="bg-red-50 p-4 rounded-md border border-red-200">
                            <h4 className="font-semibold text-red-800 mb-2 text-sm">Warning</h4>
                            <ul className="text-sm text-red-700 space-y-1 list-disc list-inside">
                                <li> This action is IRREVERSIBLE</li>
                                <li> All user accounts (admins and vendors) will be deleted</li>
                                <li> All profile information and settings stored with users will be removed</li>
                                <li> Login access for deleted users will be revoked</li>
                            </ul>
                            <p className="text-sm text-red-600 mt-2 font-medium">The Master Admin account will be preserved.</p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowDeleteAllConfirmation(true)}
                                className="group relative inline-flex w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-5 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
                                disabled={deletingAllUsers}
                            >
                                {deletingAllUsers ? (
                                    <>
                                        <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                                        Deleting Users...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-5 w-5" />
                                        Delete All Users Data
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>


            {/* Clear Data Confirmation Modal */}
            {showClearConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Confirm Data Deletion</h3>
                                <p className="text-red-600 text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
                            <h4 className="font-semibold text-red-800 mb-2">The following will be permanently deleted:</h4>
                            <ul className="text-sm text-red-700 space-y-1">
                                <li>• All voucher records and events</li>
                                <li>• All payment transactions</li>
                                <li>• All notifications</li>
                                <li>• All vendor notifications</li>
                                <li>• All password change requests</li>
                            </ul>
                            <p className="text-sm text-red-600 mt-2 font-medium">Only User accounts will be preserved.</p>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowClearConfirmation(false)}
                                className="flex-1 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    setShowClearConfirmation(false);
                                    handleClearAllData();
                                }}
                                className="flex-1 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                            >
                                Delete All Data
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete All Users Confirmation Modal */}
            {showDeleteAllConfirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl max-w-md w-full p-6 shadow-2xl">
                        <div className="flex items-center mb-4">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                                <AlertTriangle className="h-6 w-6 text-red-600" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">Confirm Users Deletion</h3>
                                <p className="text-red-600 text-sm">This action cannot be undone</p>
                            </div>
                        </div>

                        <div className="bg-red-50 p-4 rounded-lg border border-red-200 mb-6">
                            <h4 className="font-semibold text-red-800 mb-2">The following will be permanently deleted:</h4>
                            <ul className="text-sm text-red-700 space-y-1">
                                <li>• All user accounts (admins and vendors)</li>
                                <li>• All profile details saved with users</li>
                                <li>• Sign-in access for deleted users</li>
                            </ul>
                            <p className="text-sm text-red-600 mt-2 font-medium">The Master Admin account (phone 9876543210) will be preserved.</p>
                        </div>

                        <div className="flex space-x-3">
                            <button
                                onClick={() => setShowDeleteAllConfirmation(false)}
                                className="flex-1 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                                disabled={deletingAllUsers}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDeleteAllUsers}
                                className="flex-1 inline-flex items-center justify-center rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={deletingAllUsers}
                            >
                                {deletingAllUsers ? (
                                    <>
                                        <div className="animate-spin mr-2 h-5 w-5 border-2 border-white border-t-transparent rounded-full inline-block align-middle"></div>
                                        Deleting...
                                    </>
                                ) : (
                                    'Delete All Users Data'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}



