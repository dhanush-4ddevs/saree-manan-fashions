import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./styles/globals.css";
import FirebaseInitializer from "./components/shared/FirebaseInitializer";
import PWAInstallPrompt from "./components/shared/PWAInstallPrompt";
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "react-hot-toast";


const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Manan Fashions - Saree Management",
  description: "Job-Work tracking system for Manan Fashions",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/logo_for_app.png" />
        <link rel="apple-touch-icon" href="/logo_for_app.png" />
        <meta name="theme-color" content="#2563eb" />
      </head>
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} antialiased bg-blue-50/80`}
      >
        <FirebaseInitializer />
        <Analytics />
        <PWAInstallPrompt />
        <Toaster />
        {children}
      </body>
    </html>
  );
}
