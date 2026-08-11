import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Eye, EyeOff, ScanFace } from 'lucide-react';
import { User as UserType } from '../../types';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

interface LoginScreenProps {
  onLogin: (user: UserType) => void;
}

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const getPasskeyLabel = () => {
    const platform = window.navigator?.platform?.toUpperCase() || '';
    const userAgent = window.navigator?.userAgent || '';
    if (platform.indexOf('MAC') >= 0 || /iPad|iPhone|iPod/.test(userAgent)) return 'Face ID / Touch ID';
    if (platform.indexOf('WIN') >= 0) return 'Windows Hello';
    if (/Android/.test(userAgent)) return 'Biometrics';
    return 'Passkey';
  };

  const safeJsonFetch = async (url: string, options?: any) => {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const text = await res.text();
      throw new Error(`Server error (${res.status}): ${text.slice(0, 100)}`);
    }
    return res.json();
  };

  const handleFaceIdLogin = async () => {
    setError('');
    try {
      const options = await safeJsonFetch('/api/auth/generate-authentication-options', {
        method: 'POST',
      });
      if (options.error) throw new Error(options.error);

      const authResp = await startAuthentication(options);
      
      const verification = await safeJsonFetch('/api/auth/verify-authentication', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResp, challenge: options.challenge }),
      });
      
      if (verification.verified && verification.user) {
        onLogin(verification.user);
      } else {
        setError(verification.error || 'Face ID verification failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Face ID / Passkey authentication failed.');
    }
  };

  const handleRegisterPasskey = async (username: string, email: string) => {
    try {
      const regData = await safeJsonFetch('/api/auth/register-passkey-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email })
      });
      if (regData.error) throw new Error(regData.error);

      const options = await safeJsonFetch('/api/auth/generate-registration-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      });
      
      const attResp = await startRegistration(options);
      
      const verification = await safeJsonFetch('/api/auth/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, response: attResp }),
      });
      if (verification.verified) {
        onLogin(regData.user);
      } else {
        setError(verification.error || 'Registration verification failed.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to register Passkey.');
    }
  };

  const handleRegisterPassword = async () => {
    try {
      const regResp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: formData.username, 
          email: formData.email, 
          password: formData.password 
        })
      });
      const contentType = regResp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await regResp.text();
        throw new Error(`Server error (${regResp.status}): ${text.slice(0, 100)}`);
      }
      const regData = await regResp.json();
      if (regData.error) throw new Error(regData.error);

      // Successfully registered with password
      onLogin(regData.user);
    } catch (err: any) {
      setError(err.message || 'Failed to register.');
    }
  };

  const handleLoginPassword = async () => {
    try {
      const logResp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: formData.username, 
          password: formData.password 
        })
      });
      const contentType = logResp.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await logResp.text();
        throw new Error(`Server error (${logResp.status}): ${text.slice(0, 100)}`);
      }
      const logData = await logResp.json();
      if (logData.error) throw new Error(logData.error);

      // Successfully logged in
      onLogin(logData.user);
    } catch (err: any) {
      setError(err.message || 'Failed to log in.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.username.trim().length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(formData.username)) {
      setError('Username can only contain letters, numbers, and underscores.');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!isLogin) {
      if (!formData.email.includes('@')) {
        setError('Please enter a valid email address.');
        return;
      }
      
      await handleRegisterPassword();
    } else {
      await handleLoginPassword();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="w-full bg-white/80 backdrop-blur-2xl rounded-[32px] shadow-[0_32px_64px_rgba(0,0,0,0.15)] border border-white p-6 sm:p-8 flex flex-col items-center max-h-[90vh] overflow-y-auto"
    >
      <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-2xl shadow-xl flex items-center justify-center mb-4 sm:mb-6 flex-shrink-0">
        <ShieldCheck size={36} className="text-white" strokeWidth={2} />
      </div>
      
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
        {isLogin ? 'Access Portal' : 'Initialize Link'}
      </h1>
      <p className="text-xs sm:text-sm text-gray-500 mb-6 text-center">
        {isLogin ? 'Authenticate to access encrypted messages.' : 'Create your end-to-end encrypted profile to begin.'}
      </p>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        {/* Username */}
        <div className="space-y-1">
          <label className={`text-[11px] font-bold ${!isLogin ? 'text-blue-600' : 'text-gray-400'} uppercase tracking-widest ml-1`}>
            Unique Identity
          </label>
          <div className="relative">
            <span className="absolute left-4 top-3 text-gray-400 font-medium">@</span>
            <input
              type="text"
              placeholder="username"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="w-full bg-white/50 border border-black/5 rounded-xl py-3 pl-8 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-medium placeholder:font-normal"
            />
          </div>
        </div>

        {/* Email */}
        <AnimatePresence mode="popLayout">
          {!isLogin && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1 overflow-hidden"
            >
              <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1 mt-1 block">
                Email Address
              </label>
              <input
                type="email"
                placeholder="name@domain.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full bg-white/50 border border-black/5 rounded-xl py-3 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Password */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest ml-1">
            Master Key
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-white/50 border border-black/5 rounded-xl py-3 px-4 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-blue-500 hover:text-blue-600"
            >
              {showPassword ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
            </button>
          </div>
          
          {/* Password strength visual */}
          {!isLogin && (
            <div className="flex gap-1 mt-2 px-1">
              <div className={`h-1 flex-1 rounded-full ${formData.password.length > 2 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
              <div className={`h-1 flex-1 rounded-full ${formData.password.length > 4 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
              <div className={`h-1 flex-1 rounded-full ${formData.password.length >= 6 ? 'bg-green-500' : 'bg-gray-200'}`}></div>
              <div className={`h-1 flex-1 rounded-full ${formData.password.length > 8 && formData.password.match(/[A-Z]/) && formData.password.match(/[0-9]/) ? 'bg-green-500' : 'bg-gray-200'}`}></div>
            </div>
          )}
        </div>

        {error && <p className="text-red-500 text-xs px-2 text-center pt-2 font-medium">{error}</p>}

        <button 
          type="submit" 
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-blue-500/30 transition-transform active:scale-[0.98] mt-6"
        >
          {isLogin ? 'Authenticate' : 'Create Secure Account'}
        </button>

        {isLogin && (
          <>
            <div className="flex items-center gap-3 w-full my-5 opacity-60">
              <div className="h-px flex-1 bg-gray-400"></div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Or Access With</span>
              <div className="h-px flex-1 bg-gray-400"></div>
            </div>
            
            <button
              type="button"
              onClick={handleFaceIdLogin}
              className="w-full bg-white/60 hover:bg-white/80 text-gray-800 font-bold py-3.5 rounded-2xl shadow-sm border border-white/50 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ScanFace size={20} strokeWidth={2.5} className="text-blue-600" />
              {getPasskeyLabel()}
            </button>
          </>
        )}
        
        {!isLogin && (
          <>
            <div className="flex items-center gap-3 w-full my-5 opacity-60">
              <div className="h-px flex-1 bg-gray-400"></div>
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Or Create With</span>
              <div className="h-px flex-1 bg-gray-400"></div>
            </div>
            
            <button
              type="button"
              onClick={() => {
                if (formData.username.trim().length < 3) {
                  setError('Username must be at least 3 characters.');
                  return;
                }
                if (!formData.email.includes('@')) {
                  setError('Please enter a valid email address.');
                  return;
                }
                handleRegisterPasskey(formData.username, formData.email);
              }}
              className="w-full bg-white/60 hover:bg-white/80 text-gray-800 font-bold py-3.5 rounded-2xl shadow-sm border border-white/50 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <ScanFace size={20} strokeWidth={2.5} className="text-blue-600" />
              {getPasskeyLabel()}
            </button>
          </>
        )}
      </form>

      <p className="mt-6 text-xs text-gray-500 font-medium">
        {isLogin ? 'No account yet?' : 'Already registered?'}
        <button 
          onClick={() => { setIsLogin(!isLogin); setError(''); }}
          className="text-blue-600 font-semibold cursor-pointer ml-1 hover:underline"
        >
          {isLogin ? 'Initialize link' : 'Sign In'}
        </button>
      </p>
    </motion.div>
  );
}

