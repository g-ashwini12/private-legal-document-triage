'use client';

import React, { useState, useEffect } from 'react';
import { Lock, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { adminLogin } from '@/lib/api';
import NotFound from '@/app/not-found';

interface AdminAuthWrapperProps {
  children: (token: string) => React.ReactNode;
}

export default function AdminAuthWrapper({ children }: AdminAuthWrapperProps) {
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [is404, setIs404] = useState(false);

  useEffect(() => {
    const saved = sessionStorage.getItem('admin_token');
    if (saved) {
      setToken(saved);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await adminLogin(password);
      sessionStorage.setItem('admin_token', res.token);
      setToken(res.token);
    } catch (err: any) {
      if (err.message === '404') {
        setIs404(true);
      } else {
        setErrorMsg('Incorrect admin password');
      }
    } finally {
      setLoading(false);
    }
  };

  if (is404) {
    return <NotFound />;
  }

  if (!token) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-950">
        <div className="w-full max-w-md p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-md">
          <div className="w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-300 mb-4 mx-auto">
            <Lock className="w-6 h-6" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white text-center mb-1">
            Admin Authentication
          </h2>
          <p className="text-xs text-slate-500 text-center mb-6">
            Enter the admin password to access system monitoring and evaluations.
          </p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <input
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                className="w-full px-4 py-2.5 text-sm rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {errorMsg && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white dark:text-slate-900 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Unlock Admin Portal'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Public Workspace</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{children(token)}</>;
}
