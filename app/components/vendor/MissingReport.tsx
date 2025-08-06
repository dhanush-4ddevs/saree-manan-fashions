'use client';

import React from 'react';
import Image from 'next/image';
import { FileText } from 'lucide-react';

export default function MissingReport() {
  return (
    <div className="space-y-8 bg-white rounded-lg shadow-md border border-blue-100 p-4">
      <div className="p-4 bg-blue-600 text-white rounded-t-lg mb-4">
        <div className="flex items-center justify-center">
          <FileText className="h-6 w-6 mr-2" />
          <h1 className="text-2xl font-bold text-center">VENDOR MISSING REPORTS</h1>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-blue-800 flex items-center mb-4">
          <FileText className="h-5 w-5 mr-2 text-blue-600" />
          DAMAGE ON ARRIVAL
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-blue-200">
            <thead className="bg-blue-50">
              <tr>
                <th className="border border-blue-200 p-2 text-blue-700">SN</th>
                <th className="border border-blue-200 p-2 text-blue-700">PHOTO</th>
                <th className="border border-blue-200 p-2 text-blue-700">VOUCHER NO</th>
                <th className="border border-blue-200 p-2 text-blue-700">VOUCHER DT</th>
                <th className="border border-blue-200 p-2 text-blue-700">ITEM</th>
                <th className="border border-blue-200 p-2 text-blue-700">QTY</th>
                <th className="border border-blue-200 p-2 text-blue-700">JOB WORK</th>
                <th className="border border-blue-200 p-2 text-blue-700">VENDOR'S NAME</th>
                <th className="border border-blue-200 p-2 text-blue-700">VENDOR CODE</th>
                <th className="border border-blue-200 p-2 text-blue-700">LR DATE</th>
                <th className="border border-blue-200 p-2 text-blue-700">LR NUMBER</th>
                <th className="border border-blue-200 p-2 text-blue-700">TRANSPORT NAME</th>
                <th className="border border-blue-200 p-2 text-blue-700">STATUS</th>
                <th className="border border-blue-200 p-2 text-blue-700">COMMENT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-blue-200 p-2">1</td>
                <td className="border border-blue-200 p-2">-</td>
                <td className="border border-blue-200 p-2">MFV20250421-0001</td>
                <td className="border border-blue-200 p-2">21-Apr-2025</td>
                <td className="border border-blue-200 p-2">Saree</td>
                <td className="border border-blue-200 p-2">10</td>
                <td className="border border-blue-200 p-2">Dying Chaap</td>
                <td className="border border-blue-200 p-2">Vendor 1</td>
                <td className="border border-blue-200 p-2">VAB987654321</td>
                <td className="border border-blue-200 p-2">21-Apr-2025</td>
                <td className="border border-blue-200 p-2">LR20250421-1234</td>
                <td className="border border-blue-200 p-2">Transport 1</td>
                <td className="border border-blue-200 p-2">In Stock</td>
                <td className="border border-blue-200 p-2">Awaiting further instructions</td>
              </tr>
              {/* Additional rows with sample data */}
              {[2, 3, 4, 5].map(num => (
                <tr key={num}>
                  <td className="border border-blue-200 p-2">{num}</td>
                  <td className="border border-blue-200 p-2">-</td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2">{num === 2 ? '0' : num === 3 ? '25' : num === 4 ? '35' : '11'}</td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                </tr>
              ))}
              <tr className="font-bold bg-blue-50">
                <td className="border border-blue-200 p-2 text-blue-700" colSpan={5}>Total</td>
                <td className="border border-blue-200 p-2 text-blue-700">81</td>
                <td className="border border-blue-200 p-2" colSpan={8}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold text-blue-800 flex items-center mb-4">
          <FileText className="h-5 w-5 mr-2 text-blue-600" />
          DAMAGE AFTER JOB WORK
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-blue-200">
            <thead className="bg-blue-50">
              <tr>
                <th className="border border-blue-200 p-2 text-blue-700">SN</th>
                <th className="border border-blue-200 p-2 text-blue-700">PHOTO</th>
                <th className="border border-blue-200 p-2 text-blue-700">VOUCHER NO</th>
                <th className="border border-blue-200 p-2 text-blue-700">VOUCHER DT</th>
                <th className="border border-blue-200 p-2 text-blue-700">ITEM</th>
                <th className="border border-blue-200 p-2 text-blue-700">QTY</th>
                <th className="border border-blue-200 p-2 text-blue-700">JOB WORK</th>
                <th className="border border-blue-200 p-2 text-blue-700">VENDOR'S NAME</th>
                <th className="border border-blue-200 p-2 text-blue-700">VENDOR CODE</th>
                <th className="border border-blue-200 p-2 text-blue-700">STATUS</th>
                <th className="border border-blue-200 p-2 text-blue-700">COMMENT</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-blue-200 p-2">1</td>
                <td className="border border-blue-200 p-2">-</td>
                <td className="border border-blue-200 p-2">MFV20250421-0001</td>
                <td className="border border-blue-200 p-2">21-Apr-2025</td>
                <td className="border border-blue-200 p-2">Saree</td>
                <td className="border border-blue-200 p-2">5</td>
                <td className="border border-blue-200 p-2">Dying Chaap</td>
                <td className="border border-blue-200 p-2">Vendor 1</td>
                <td className="border border-blue-200 p-2">VAB987654321</td>
                <td className="border border-blue-200 p-2">In Stock</td>
                <td className="border border-blue-200 p-2">Awaiting further instructions</td>
              </tr>
              {/* Additional rows with sample data */}
              {[2, 3, 4, 5].map(num => (
                <tr key={num}>
                  <td className="border border-blue-200 p-2">{num}</td>
                  <td className="border border-blue-200 p-2">-</td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2">{num === 2 ? '0' : num === 3 ? '10' : num === 4 ? '11' : '24'}</td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                  <td className="border border-blue-200 p-2"></td>
                </tr>
              ))}
              <tr className="font-bold bg-blue-50">
                <td className="border border-blue-200 p-2 text-blue-700" colSpan={5}>Total</td>
                <td className="border border-blue-200 p-2 text-blue-700">50</td>
                <td className="border border-blue-200 p-2" colSpan={5}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
