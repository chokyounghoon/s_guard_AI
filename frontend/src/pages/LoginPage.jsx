import React, { useState } from 'react';
import { Shield, Eye, AtSign, ArrowRight, LogIn } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate login
    setTimeout(() => {
      setLoading(false);
      navigate('/dashboard');
    }, 1000);
  };

  return (
    <div className="min-h-screen font-sans flex flex-col bg-[#0f111a] text-white relative overflow-hidden">
      
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
      
      {/* Background Glow */}
      <div className="absolute inset-0 z-0 bg-gradient-to-b from-blue-900/10 via-transparent to-blue-900/20 pointer-events-none" />
      <div className="absolute -top-[20%] -left-[20%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <div className="relative z-10 p-6 flex items-center">
         <div className="bg-blue-600 p-1.5 rounded-lg mr-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            <Shield className="w-4 h-4 text-white fill-current" />
         </div>
         <span className="font-bold text-lg tracking-wide">S-Guard AI</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 relative z-10 w-full max-w-md mx-auto">
        
        {/* Main Icon */}
        <div className="mb-8 relative">
            <div className="w-24 h-24 bg-blue-900/20 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-[0_0_30px_rgba(37,99,235,0.1)]">
                <Shield className="w-10 h-10 text-blue-500 fill-blue-500/20" />
            </div>
            <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full -z-10" />
        </div>

        {/* Headlines */}
        <div className="text-center mb-10">
            <h1 className="text-3xl font-bold mb-3 text-white tracking-tight">Secure Login</h1>
            <p className="text-slate-400 text-sm">AI Agent 기반 지능형 장애 예방 및 통합 관리 시스템</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="w-full space-y-6">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">ID/Email</label>
                <div className="relative group">
                    <input 
                        type="text" 
                        placeholder="Enter your ID or Email"
                        className="w-full bg-[#1a1f2e] border border-blue-500/30 rounded-xl py-4 pl-5 pr-12 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white shadow-inner"
                    />
                    <AtSign className="absolute right-4 top-4 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                <div className="relative group">
                    <input 
                        type="password" 
                        placeholder="Enter your password"
                        className="w-full bg-[#1a1f2e] border border-blue-500/30 rounded-xl py-4 pl-5 pr-12 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white shadow-inner"
                    />
                    <Eye className="absolute right-4 top-4 w-5 h-5 text-slate-500 cursor-pointer hover:text-white transition-colors" />
                </div>
            </div>

            <div className="flex justify-end">
                <button type="button" className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors">
                    Forgot Password?
                </button>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 shadow-[0_4px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_6px_25px_rgba(37,99,235,0.5)] transition-all transform active:scale-[0.98]"
            >
                <span>{loading ? 'Authenticating...' : 'Login to Dashboard'}</span>
                {!loading && <LogIn className="w-5 h-5 ml-1" />}
            </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400">
            Don't have an account? <span className="text-blue-400 font-semibold cursor-pointer hover:text-blue-300 transition-colors">Sign Up</span>
        </div>

      </div>

      <div className="relative z-10 py-8 w-full flex items-center justify-center opacity-40">
        <div className="h-[1px] w-12 bg-slate-500"></div>
        <span className="mx-4 text-[10px] tracking-[0.2em] font-medium text-slate-400 uppercase">End-to-End Encryption</span>
        <div className="h-[1px] w-12 bg-slate-500"></div>
      </div>
    </div>
  ); 
}
