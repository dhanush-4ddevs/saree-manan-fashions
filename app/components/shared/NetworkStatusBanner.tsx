'use client';

import { useEffect, useState } from 'react';

export default function NetworkStatusBanner() {
    const [online, setOnline] = useState(
        typeof navigator !== 'undefined' ? navigator.onLine : true
    );

    useEffect(() => {
        const up = () => setOnline(true);
        const down = () => setOnline(false);
        window.addEventListener('online', up);
        window.addEventListener('offline', down);
        return () => {
            window.removeEventListener('online', up);
            window.removeEventListener('offline', down);
        };
    }, []);

    if (online) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-50">
            <div className="mx-auto max-w-screen-xl px-4 py-2 bg-red-600 text-white text-center">
                You are offline. Some features may not work until you reconnect.
            </div>
        </div>
    );
}


