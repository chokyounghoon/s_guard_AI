/* eslint-disable */
import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function ChatPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-black text-white p-10 flex flex-col items-center justify-center">
      <h1 className="text-3xl font-bold text-red-500 mb-4">🚨 Emergency Debug Mode</h1>
      <div className="bg-gray-800 p-6 rounded-lg border border-gray-700 max-w-md text-center">
        <p className="mb-4">If you are seeing this screen, the deployment pipeline is working correctly.</p>
        <p className="text-sm text-gray-400">The original ChatPage code has been temporarily removed to isolate the crash.</p>
        <p className="text-xs text-slate-500 mt-4">Version: Isolation-Check-v1</p>
      </div>
      <button 
        onClick={() => navigate('/dashboard')}
        className="mt-8 px-6 py-3 bg-blue-600 rounded-full font-bold hover:bg-blue-500 transition-colors"
      >
        Return to Dashboard
      </button>
    </div>
  );
}
