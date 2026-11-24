'use client';

import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { Sparkles, ArrowRight, Lock, Mail } from 'lucide-react';

interface AuthScreenProps {
  onAuthenticated: () => void;
}

export default function AuthScreen({ onAuthenticated }: AuthScreenProps) {
  const supabase = createClient();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        alert('Registration successful! You can now log in.');
        setIsSignUp(false);
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setErrorMsg(error.message);
      } else {
        onAuthenticated();
      }
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className={`w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl border-2 transition-all ${
        isSignUp ? 'border-emerald-500 shadow-emerald-100' : 'border-blue-500 shadow-blue-100'
      }`}>
        
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl shadow-lg ${
            isSignUp ? 'bg-emerald-600 text-white' : 'bg-blue-600 text-white'
          }`}>
            <Sparkles className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-black text-slate-900">
            {isSignUp ? 'Create Shop Account' : 'Laundry POS Login'}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {isSignUp ? 'Set up your digital laundry tracking system' : 'Sign in to access your active rack & shift ledger'}
          </p>
        </div>

        {/* Mode Switcher Tabs with Distinct Colors */}
        <div className="grid grid-cols-2 gap-2 mb-6 p-1 bg-slate-100 rounded-2xl">
          <button
            type="button"
            onClick={() => { setIsSignUp(false); setErrorMsg(null); }}
            className={`py-3 text-xs font-black uppercase rounded-xl transition ${
              !isSignUp ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsSignUp(true); setErrorMsg(null); }}
            className={`py-3 text-xs font-black uppercase rounded-xl transition ${
              isSignUp ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Register
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-600 text-center">
            {errorMsg}
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="auntie@laundry.com"
                className="w-full rounded-2xl border-2 border-slate-200 pl-12 pr-4 py-3 text-base font-bold text-slate-800 focus:border-slate-900 focus:outline-none bg-slate-50"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-3.5 h-5 w-5 text-slate-400" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-2xl border-2 border-slate-200 pl-12 pr-4 py-3 text-base font-bold text-slate-800 focus:border-slate-900 focus:outline-none bg-slate-50"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-black text-white shadow-lg active:scale-98 disabled:opacity-50 ${
              isSignUp ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {loading ? 'Processing...' : isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN'}
            <ArrowRight className="h-5 w-5" />
          </button>
        </form>

      </div>
    </div>
  );
}