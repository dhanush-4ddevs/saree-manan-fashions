import { LoginForm } from "./components/shared/LoginForm";
import { ShoppingBag, Shield } from "lucide-react";
import Link from "next/link";
import Image from "next/image";


export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-blue-100">
      <div className="max-w-md w-full bg-white rounded-xl shadow-md border border-blue-100 overflow-hidden">
        <div className="bg-gradient-to-r from-blue-700 to-blue-600 py-8">
          <div className="flex justify-center">
            <Image
              src="/logo_kraj.png"
              alt="Manan Fashions"
              width={100}
              height={80}
              className="object-contain"
            />
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="text-center mb-6">
            <h2 className="text-xl text-blue-600">Job-Work Tracking</h2>
          </div>
          <LoginForm />
        </div>

        {/* Admin Login Link - Placed after credentials input */}
        {/* <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <Link
              href="/admin-login"
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 hover:text-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              <Shield className="h-4 w-4 mr-2" />
              Go to Admin Login
            </Link>
            <p className="mt-2 text-xs text-gray-500">
              For administrative access only
            </p>
          </div>
        </div> */}
      </div>
    </main>
  );
}
