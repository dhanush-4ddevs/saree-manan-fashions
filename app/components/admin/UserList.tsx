'use client';

import { useState } from 'react';
import { User, ShieldAlert, Briefcase } from 'lucide-react';

interface UserProps {
  id: string;
  name: string;
  category: 'Admin' | 'Vendor';
  vendorJobWork?: string;
  jobWork?: string;
}

export function UserList({ users }: { users: UserProps[] }) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(user => {
    if (!searchTerm.trim()) return true;

    const searchLower = searchTerm.toLowerCase();

    // Enhanced search across all available fields
    return (
      // Basic user info
      user.id?.toLowerCase().includes(searchLower) ||
      user.name?.toLowerCase().includes(searchLower) ||
      user.category?.toLowerCase().includes(searchLower) ||

      // Job work details
      user.vendorJobWork?.toLowerCase().includes(searchLower) ||
      user.jobWork?.toLowerCase().includes(searchLower) ||

      // Search in any other string fields
      Object.values(user).some(val =>
        typeof val === 'string' && val.toLowerCase().includes(searchLower)
      )
    );
  });

  return (
    <div className="overflow-hidden">
      <div className="p-4 border-b border-blue-100">
        <div className="relative">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-8 py-2 border border-blue-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <svg
            className="absolute right-3 top-3 h-4 w-4 text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      <ul className="divide-y divide-blue-100">
        {filteredUsers.length > 0 ? (
          filteredUsers.map((user) => (
            <li key={user.id} className="p-4 hover:bg-blue-50 transition-colors duration-200">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-full p-2 mr-3">
                  {user.category === 'Admin' ? (
                    <ShieldAlert className="h-5 w-5 text-blue-600" />
                  ) : (
                    <Briefcase className="h-5 w-5 text-blue-600" />
                  )}
                </div>
                <div>
                  <p className="text-base font-medium text-blue-800">{user.name}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      user.category === 'Admin'
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-blue-50 text-blue-600'
                    }`}>
                      {user.category}
                    </span>
                    {user.vendorJobWork && (
                      <span className="text-xs text-blue-500">
                        {user.vendorJobWork}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))
        ) : (
          <li className="p-6 text-center text-blue-700">
            <div className="flex flex-col items-center justify-center">
              <User className="h-8 w-8 text-blue-400 mb-2" />
              <p>No users found matching your search.</p>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
