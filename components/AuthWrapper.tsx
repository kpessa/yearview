'use client';

import { db } from '@/lib/instant';
import { ReactNode, useState } from 'react';

export default function AuthWrapper({ children }: { children: ReactNode }) {
  const { isLoading, user, error } = db.useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-neutral-50 to-zinc-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-stone-300 mx-auto"></div>
          <p className="mt-4 text-stone-500 font-light">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-stone-50 via-neutral-50 to-zinc-50">
        <div className="bg-white/95 backdrop-blur-md p-8 rounded-3xl border border-red-200 max-w-md">
          <h2 className="text-2xl font-light tracking-tight text-red-600 mb-4">Authentication Error</h2>
          <p className="text-stone-600 font-light">{error.message}</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <>{children}</>;
}

function AuthScreen() {
  const handleGoogleLogin = () => {
    const url = (db.auth as any).createAuthorizationURL({
      clientName: 'google-web',
      redirectURL: window.location.href,
    });
    window.location.href = url;
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-stone-50 via-neutral-50 to-zinc-50">
      <div className="bg-white/95 backdrop-blur-md rounded-3xl border border-neutral-200/50 w-full max-w-md overflow-hidden">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-neutral-50 to-stone-50 p-12 text-center border-b border-neutral-200/50">
          <div className="w-20 h-20 bg-gradient-to-br from-stone-200 to-neutral-300 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-stone-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-4xl font-light tracking-tight text-stone-700 mb-2">
            YearView
          </h1>
          <p className="text-stone-500 font-light">Plan your year beautifully</p>
        </div>

        {/* Action Section */}
        <div className="p-10">
          <button
            onClick={handleGoogleLogin}
            className="w-full bg-white border border-neutral-300 text-neutral-700 py-4 rounded-xl font-medium hover:bg-neutral-50 transition-all flex items-center justify-center gap-3 shadow-sm"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>

          <div className="mt-8 pt-6 border-t border-neutral-200/50 text-center space-y-2">
            <p className="text-xs text-stone-400 font-light">
              Secure authentication via Google • No password required
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
