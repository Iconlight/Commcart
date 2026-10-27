/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase/client.ts';
import { Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    async function handleAuth() {
      try {
        // Parse code from URL search params if present
        const searchParams = new URLSearchParams(window.location.search);
        const code = searchParams.get('code');
        const error = searchParams.get('error_description') || searchParams.get('error');

        if (error) {
          setStatus('error');
          setErrorMessage(error);
          return;
        }

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            setStatus('error');
            setErrorMessage(exchangeError.message);
            return;
          }
        }

        // Check if session exists (hash or code)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          setStatus('error');
          setErrorMessage(sessionError.message);
          return;
        }

        const proceedToApp = async (userId: string) => {
          try {
            const { data: memberships } = await supabase
              .from('organization_members')
              .select('organization_id')
              .eq('user_id', userId)
              .limit(1);

            if (memberships && memberships.length > 0) {
              window.location.href = '/dashboard';
            } else {
              window.location.href = '/onboarding';
            }
          } catch {
            window.location.href = '/onboarding';
          }
        };

        if (session?.user) {
          setStatus('success');
          setTimeout(() => {
            proceedToApp(session.user.id);
          }, 1200);
        } else {
          // If no session found yet, wait for onAuthStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (newSession?.user) {
              subscription.unsubscribe();
              setStatus('success');
              setTimeout(() => {
                proceedToApp(newSession.user.id);
              }, 1200);
            }
          });
        }
      } catch (err: unknown) {
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Authentication verification failed.');
      }
    }

    handleAuth();
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm text-center">
        {status === 'verifying' && (
          <div className="py-6">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Verifying your account...</h2>
            <p className="mt-2 text-xs text-slate-500">Completing authentication handshake with Supabase</p>
          </div>
        )}

        {status === 'success' && (
          <div className="py-6">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Email verified successfully!</h2>
            <p className="mt-2 text-xs text-slate-500">Redirecting to your merchant dashboard...</p>
          </div>
        )}

        {status === 'error' && (
          <div className="py-6">
            <AlertCircle className="mx-auto h-10 w-10 text-red-600" />
            <h2 className="mt-4 text-lg font-semibold text-slate-900">Verification Link Error</h2>
            <p className="mt-2 text-xs text-slate-600">{errorMessage || 'The verification link may have expired or is invalid.'}</p>
            <div className="mt-6">
              <a
                href="/login"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <span>Back to Sign In</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
