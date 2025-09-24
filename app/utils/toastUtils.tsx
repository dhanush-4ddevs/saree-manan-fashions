'use client';

import React, { useEffect, useState } from 'react';
import toast, { Toast } from 'react-hot-toast';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';

function TimedToast({ t, message, type, durationMs = 10000 }: { t: Toast; message: string; type: ToastKind; durationMs?: number }) {
  const [remaining, setRemaining] = useState(durationMs);

  useEffect(() => {
    const startedAt = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const left = Math.max(durationMs - elapsed, 0);
      setRemaining(left);
      if (left === 0) {
        clearInterval(interval);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [durationMs]);

  const pct = Math.max(0, Math.min(100, (remaining / durationMs) * 100));

  const icon = type === 'success' ? (
    <CheckCircle className="h-5 w-5 text-green-600" />
  ) : type === 'error' ? (
    <AlertCircle className="h-5 w-5 text-red-600" />
  ) : (
    <Info className="h-5 w-5 text-blue-600" />
  );

  const colorClasses = type === 'success'
    ? 'bg-green-50 border-green-200 text-green-800'
    : type === 'error'
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-blue-50 border-blue-200 text-blue-800';

  const barColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} w-[92vw] sm:w-auto max-w-[96vw] sm:max-w-md`}>
      <div className={`flex items-start p-3 sm:p-4 rounded-lg shadow-lg border ${colorClasses} relative overflow-hidden`}>
        <div className="flex-shrink-0 mt-0.5">{icon}</div>
        <div className="ml-3 mr-8">
          <p className="text-sm font-medium">{message}</p>
          <p className="mt-0.5 text-[10px] text-gray-500">Closes in {(remaining / 1000).toFixed(1)}s</p>
        </div>
        <button
          onClick={() => toast.dismiss(t.id)}
          className="absolute top-2 right-2 inline-flex text-gray-500 hover:text-gray-700"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="absolute left-0 right-0 bottom-0 h-1 bg-black/10">
          <div className={`h-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function showCountdownToast(message: string, type: ToastKind = 'success', durationMs = 10000) {
  toast.custom((t) => (
    <TimedToast t={t} message={message} type={type} durationMs={durationMs} />
  ), { position: 'bottom-center', duration: durationMs });
}
