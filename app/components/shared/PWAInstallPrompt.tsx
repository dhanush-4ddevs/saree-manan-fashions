"use client";

import { useEffect, useRef, useState } from "react";

type BeforeInstallPromptEvent = Event & {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export default function PWAInstallPrompt() {
    const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);
    const [show, setShow] = useState(false);

    useEffect(() => {
        const onBeforeInstall = (e: Event) => {
            e.preventDefault();
            deferredPromptRef.current = e as BeforeInstallPromptEvent;
            setShow(true);
        };

        window.addEventListener("beforeinstallprompt", onBeforeInstall as EventListener);

        // iOS: show hint if not standalone
        if (typeof window !== 'undefined' && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
            // iOS doesn't fire beforeinstallprompt; we could show a hint, but keep simple for now
        }

        return () => {
            window.removeEventListener("beforeinstallprompt", onBeforeInstall as EventListener);
        };
    }, []);

    useEffect(() => {
        if ("serviceWorker" in navigator) {
            navigator.serviceWorker.register("/sw.js").catch(() => { });
        }
    }, []);

    const onInstallClick = async () => {
        const deferred = deferredPromptRef.current;
        if (!deferred) return;
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome !== "dismissed") {
            setShow(false);
            deferredPromptRef.current = null;
        }
    };

    const onClose = () => setShow(false);

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-4 text-center">
                <div className="flex justify-center mb-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/logo_kraj.png" alt="App icon" className="w-16 h-16 rounded" />
                </div>
                <h2 className="text-lg font-semibold mb-1">Install Manan Fashions</h2>
                <p className="text-sm text-gray-600 mb-4">Install this app on your device for a faster, full-screen experience.</p>
                <div className="flex gap-2 justify-center">
                    <button onClick={onClose} className="px-4 py-2 rounded-md border">Not now</button>
                    <button onClick={onInstallClick} className="px-4 py-2 rounded-md bg-blue-600 text-white">Install</button>
                </div>
            </div>
        </div>
    );
}


