"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import DashboardPage from "./(dashboard)/page";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div className="flex h-screen items-center justify-center">Loading...</div>;
  }

  // If the user is logged in, show the Dashboard and a Logout button
  if (session) {
    return (
      <div>
        <header className="bg-gray-800 text-white p-4 flex justify-between items-center">
          <h1 className="font-bold text-xl">Amdox ERP</h1>
          <button 
            onClick={() => signOut()} 
            className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded"
          >
            Sign Out
          </button>
        </header>
        <DashboardPage />
      </div>
    );
  }

  // If the user is NOT logged in, show a landing page with a Login button
  return (
    <div className="flex flex-col h-screen items-center justify-center bg-gray-50">
      <h1 className="text-4xl font-bold mb-6 text-gray-800">Welcome to Amdox ERP</h1>
      <p className="text-gray-600 mb-8 text-center max-w-md">
        Please sign in with your corporate account to access the enterprise resource planning suite.
      </p>
      <button 
        onClick={() => signIn("keycloak")} 
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded shadow-lg transition-all"
      >
        Sign In with Keycloak
      </button>
    </div>
  );
}