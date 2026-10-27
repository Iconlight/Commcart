/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase/client.ts';
import { navigateTo } from '../../lib/navigation.ts';
import { useAuth } from '../../context/AuthContext.tsx';
import type { Organization } from '../../types/database.types.ts';
import {
  Store,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Globe,
  Coins,
  LogOut,
} from 'lucide-react';

export default function OnboardingPage() {
  const { user, organization, signOut, refreshOrg, setManualOrganization } = useAuth();
  const [storeName, setStoreName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEditedManually, setSlugEditedManually] = useState(false);
  const [currency, setCurrency] = useState('KES');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // If organization exists, navigate smoothly to products dashboard
  useEffect(() => {
    if (organization) {
      navigateTo('/dashboard/products');
    }
  }, [organization]);

  // Helper to slugify a name
  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  // Auto-generate slug as storeName changes unless edited manually
  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setStoreName(val);
    if (!slugEditedManually) {
      setSlug(slugify(val));
    }
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEditedManually(true);
    setSlug(slugify(e.target.value));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = storeName.trim();
    const cleanSlug = slug.trim();

    if (cleanName.length < 2) {
      setErrorMsg('Store name must be at least 2 characters.');
      return;
    }
    if (cleanSlug.length < 2) {
      setErrorMsg('Workspace slug must be at least 2 characters.');
      return;
    }

    setSubmitting(true);

    try {
      // Call atomic stored procedure: create_organization_with_owner
      const { data, error } = await (supabase.rpc as any)('create_organization_with_owner', {
        org_name: cleanName,
        org_slug: cleanSlug,
        org_currency: currency,
      });

      if (error) {
        setErrorMsg(error.message);
        setSubmitting(false);
        return;
      }

      console.log('Organization created successfully:', data);
      if (data) {
        setManualOrganization(data as Organization);
      }
      await refreshOrg();
      navigateTo('/dashboard/products');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during workspace creation.';
      setErrorMsg(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col justify-center bg-slate-50 py-12 sm:px-6 lg:px-8 animate-fadeIn">
      {/* Top back & signout bar */}
      <div className="sm:mx-auto sm:w-full sm:max-w-lg px-4 sm:px-0 mb-6 flex items-center justify-between">
        <a
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Home</span>
        </a>
        <button
          onClick={signOut}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-red-600 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Sign Out</span>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-lg">
        <div className="text-center">
          <a
            href="/"
            className="text-2xl font-bold tracking-tight text-slate-950 hover:text-emerald-700 transition-colors"
          >
            CommCart
          </a>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Set up your business workspace
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Create your store profile to start receiving automated Instagram orders and M-Pesa payments.
          </p>
        </div>

        <div className="mt-8 bg-white px-6 py-8 shadow-sm border border-slate-200 rounded-2xl sm:px-10">
          {errorMsg && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Business / Store Name
              </label>
              <div className="mt-1.5 relative rounded-lg shadow-sm">
                <input
                  type="text"
                  required
                  value={storeName}
                  onChange={handleStoreNameChange}
                  placeholder="e.g. Nairobi Streetwear"
                  className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                The name your customers will see during checkout.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Workspace Slug
              </label>
              <div className="mt-1.5 flex rounded-lg shadow-sm">
                <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 text-slate-500 text-xs font-mono">
                  commcart.co/
                </span>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={handleSlugChange}
                  placeholder="nairobi-streetwear"
                  className="block w-full rounded-r-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Used in your checkout links (letters, numbers, and dashes only).
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Default Currency
              </label>
              <div className="mt-1.5 relative">
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                >
                  <option value="KES">KES — Kenyan Shilling (M-Pesa native)</option>
                  <option value="USD">USD — US Dollar</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GBP">GBP — British Pound</option>
                  <option value="TZS">TZS — Tanzanian Shilling</option>
                  <option value="UGX">UGX — Ugandan Shilling</option>
                </select>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Initial MVP transactions settle natively in Kenyan Shillings (KES) via M-Pesa.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900">
                  <span className="font-semibold">Atomic Workspace Protection:</span> You will be registered as the verified Organization Owner with full administrative control.
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Create Business Workspace</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
