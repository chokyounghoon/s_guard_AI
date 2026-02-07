import React, { useState } from 'react';
import { Shield, Eye, AtSign, ArrowRight, UserPlus, Lock, User, CheckSquare } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GoogleLogin } from '@react-oauth/google';
import { jwtDecode } from 'jwt-decode';

export default function SignupPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });

  const handleSignup = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      alert('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    setLoading(true);
    // Simulate signup
    setTimeout(() => {
      setLoading(false);
      const userProfile = {
        name: formData.name,
        email: formData.email,
        picture: null,
      };
      localStorage.setItem('sguard_user', JSON.stringify(userProfile));
      navigate('/dashboard');
    }, 1500);
  };

  const handleGoogleSuccess = (credentialResponse) => {
    const details = jwtDecode(credentialResponse.credential);
    const userProfile = {
      name: details.name,
      email: details.email,
      picture: details.picture,
    };
    localStorage.setItem('sguard_user', JSON.stringify(userProfile));
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen font-sans flex flex-col bg-[#0f111a] text-white relative overflow-hidden">
      
      {/* Background Patterns */}
      <div className="absolute inset-0 z-0 opacity-20" 
           style={{ backgroundImage: 'radial-gradient(circle, #3b82f6 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>
      <div className="absolute -bottom-[20%] -right-[20%] w-[70%] h-[70%] bg-blue-600/10 blur-[120px] rounded-full pointer-events-none" />

      {/* Top Bar */}
      <div className="relative z-10 p-6 flex items-center justify-between">
         <div className="flex items-center">
            <div className="bg-blue-600 p-1.5 rounded-lg mr-3 shadow-[0_0_15px_rgba(37,99,235,0.5)]">
                <Shield className="w-4 h-4 text-white fill-current" />
            </div>
            <span className="font-bold text-lg tracking-wide">S-Guard AI</span>
         </div>
         <button 
           onClick={() => navigate('/')}
           className="text-sm text-slate-400 hover:text-white transition-colors flex items-center space-x-1"
         >
           <span>Login</span>
           <ArrowRight className="w-4 h-4" />
         </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 relative z-10 w-full max-w-md mx-auto">
        
        {/* Headlines */}
        <div className="text-center mb-10 w-full">
            <h1 className="text-3xl font-bold mb-3 text-white tracking-tight">Create Account</h1>
            <p className="text-slate-400 text-sm">지능형 보안 관제 시스템의 일원이 되어보세요</p>
        </div>

        {/* Google Signup */}
        <div className="w-full mb-8">
            <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => alert('구글 가입에 실패했습니다.')}
                useOneTap
                theme="filled_blue"
                shape="pill"
                size="large"
                width="100%"
                text="signup_with"
            />
        </div>

        <div className="w-full flex items-center mb-8">
            <div className="flex-1 h-[1px] bg-white/5"></div>
            <span className="px-4 text-[10px] text-slate-500 font-bold uppercase tracking-wider">Or register with email</span>
            <div className="flex-1 h-[1px] bg-white/5"></div>
        </div>

        {/* Form */}
        <form onSubmit={handleSignup} className="w-full space-y-5">
            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Full Name</label>
                <div className="relative group">
                    <input 
                        required
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        placeholder="Enter your name"
                        className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-4 pl-12 pr-5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white shadow-inner"
                    />
                    <User className="absolute left-4 top-4 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
            </div>

            <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 ml-1">Email Address</label>
                <div className="relative group">
                    <input 
                        required
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="name@company.com"
                        className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-4 pl-12 pr-5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all text-white shadow-inner"
                    />
                    <AtSign className="absolute left-4 top-4 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 ml-1">Password</label>
                    <div className="relative group">
                        <input 
                            required
                            type="password" 
                            value={formData.password}
                            onChange={(e) => setFormData({...formData, password: e.target.value})}
                            placeholder="••••••••"
                            className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-4 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all text-white shadow-inner"
                        />
                        <Lock className="absolute left-4 top-4 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300 ml-1">Confirm</label>
                    <div className="relative group">
                        <input 
                            required
                            type="password" 
                            value={formData.confirmPassword}
                            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})}
                            placeholder="••••••••"
                            className="w-full bg-[#1a1f2e] border border-blue-500/20 rounded-xl py-4 pl-11 pr-4 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-all text-white shadow-inner"
                        />
                        <CheckSquare className="absolute left-4 top-4 w-4 h-4 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    </div>
                </div>
            </div>

            <div className="flex items-center space-x-2 pt-2">
                <input type="checkbox" id="terms" required className="rounded border-blue-500/30 bg-[#1a1f2e] text-blue-600 focus:ring-blue-500" />
                <label htmlFor="terms" className="text-xs text-slate-400 leading-none">
                    I agree to the <span className="text-blue-400 cursor-pointer">Terms of Service</span> and <span className="text-blue-400 cursor-pointer">Privacy Policy</span>
                </label>
            </div>

            <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 shadow-[0_4px_20px_rgba(37,99,235,0.4)] transition-all transform active:scale-[0.98] mt-4"
            >
                <span>{loading ? 'Creating Account...' : 'Continue'}</span>
                {!loading && <UserPlus className="w-5 h-5 ml-1" />}
            </button>
        </form>

        <div className="mt-8 text-center text-sm text-slate-400">
            Already have an account? <span onClick={() => navigate('/')} className="text-blue-400 font-semibold cursor-pointer hover:text-blue-300 transition-colors">Log In</span>
        </div>

      </div>

      <div className="relative z-10 py-6 w-full flex items-center justify-center opacity-40">
        <span className="text-[10px] tracking-[0.2em] font-medium text-slate-400 uppercase">Enterprise Grade Security</span>
      </div>
    </div>
  ); 
}
