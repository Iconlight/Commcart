/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase/client.ts';
import { navigateTo } from '../../lib/navigation.ts';
import type { User } from '@supabase/supabase-js';
import type { Profile, Organization, OrganizationRole } from '../../types/database.types.ts';
import {
  User as UserIcon,
  LogOut,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  ShieldCheck,
  Save,
  Globe,
  Coins,
  Copy,
  ExternalLink,
} from 'lucide-react';

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [memberRole, setMemberRole] = useState<OrganizationRole | null>(null);

  // Profile form state
  const [fullName, setFullName] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Organization form state
  const [orgName, setOrgName] = useState('');
  const [orgCurrency, setOrgCurrency] = useState('KES');
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgSuccess, setOrgSuccess] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState(false);

  // Page state
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'workspace' | 'profile'>('workspace');

  useEffect(() => {
    async function loadDashboard() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session?.user) {
          navigateTo('/login');
          return;
        }

        const currentUser = session.user;
        setUser(currentUser);

        // 1. Fetch Organization Membership
        const { data: memberships, error: memberError } = await supabase
          .from('organization_members')
          .select('organization_id, role')
          .eq('user_id', currentUser.id)
          .limit(1);

        if (memberError) {
          console.error('Error fetching membership:', memberError);
          setErrorMessage('Failed to load organization access: ' + memberError.message);
        } else if (!memberships || memberships.length === 0) {
          // Unonboarded seller - redirect to onboarding
          navigateTo('/onboarding');
          return;
        } else {
          const membership = (memberships as any[])[0] as { organization_id: string; role: OrganizationRole };
          setMemberRole(membership.role);

          // 2. Fetch Organization Details
          const { data: orgData, error: orgError } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', membership.organization_id)
            .maybeSingle();

          if (orgError) {
            console.error('Error loading organization:', orgError);
            setErrorMessage('Could not load workspace settings: ' + orgError.message);
          } else if (orgData) {
            const typedOrg = orgData as unknown as Organization;
            setOrganization(typedOrg);
            setOrgName(typedOrg.name);
            setOrgCurrency(typedOrg.default_currency);
          }
        }

        // 3. Fetch User Profile
        const { data: profileData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', currentUser.id)
          .maybeSingle();

        if (profileData) {
          const typedProfile = profileData as unknown as Profile;
          setProfile(typedProfile);
          setFullName(typedProfile.full_name || '');
        } else {
          const metaName = currentUser.user_metadata?.full_name || '';
          setFullName(metaName);
        }
      } catch (err: unknown) {
        console.error('Session load error:', err);
        window.location.href = '/login';
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  // Update Organization Handler (Owner only)
  const handleUpdateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    if (orgName.trim().length < 2) {
      setErrorMessage('Store name must be at least 2 characters.');
      return;
    }

    setSavingOrg(true);
    setOrgSuccess(false);
    setErrorMessage(null);

    try {
      const { data, error } = await (supabase.from('organizations') as any)
        .update({
          name: orgName.trim(),
          default_currency: orgCurrency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organization.id)
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message);
      } else {
        setOrganization(data as Organization);
        setOrgSuccess(true);
        setTimeout(() => setOrgSuccess(false), 3000);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update organization.');
    } finally {
      setSavingOrg(false);
    }
  };

  // Update Profile Handler
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSavingProfile(true);
    setProfileSuccess(false);
    setErrorMessage(null);

    try {
      const { data, error } = await (supabase.from('profiles') as any)
        .upsert({
          id: user.id,
          full_name: fullName.trim(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message);
      } else {
        setProfile(data as Profile);
        setProfileSuccess(true);
        setTimeout(() => setProfileSuccess(false), 3000);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleCopySlug = () => {
    if (!organization) return;
    navigator.clipboard.writeText(`https://commcart.co/store/${organization.slug}`);
    setCopiedSlug(true);
    setTimeout(() => setCopiedSlug(false), 2000);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigateTo('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-slate-600">Loading merchant workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 animate-fadeIn">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-6 lg:px-8">
          <div className="flex items-center gap-4 sm:gap-6">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Home</span>
            </a>
            <div className="h-4 w-px bg-slate-200 hidden sm:block" />
            <a
              href="/"
              className="text-xl font-bold tracking-tight text-slate-950 hover:text-emerald-700 transition-colors"
            >
              CommCart
            </a>
            {organization && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-900">{organization.name}</span>
                <span>·</span>
                <span className="font-mono text-emerald-700">{organization.default_currency}</span>
                <span>·</span>
                <span className="capitalize text-slate-500 font-medium">({memberRole})</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline-block text-xs font-medium text-slate-600 truncate max-w-[200px]">
              {user?.email}
            </span>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <div className="max-w-4xl">
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 uppercase tracking-wider">
                <span>Verified Workspace</span>
                <span>·</span>
                <span className="capitalize">{memberRole} Access</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                {organization?.name || 'Merchant Dashboard'}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Manage your store profile, checkout currency, and seller settings.
              </p>
            </div>

            {organization && (
              <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1.5 text-xs font-mono text-slate-700">
                <Globe className="h-4 w-4 text-slate-500 shrink-0 ml-1" />
                <span className="truncate max-w-[180px]">commcart.co/store/{organization.slug}</span>
                <button
                  onClick={handleCopySlug}
                  title="Copy Store URL"
                  className="rounded p-1 hover:bg-white text-slate-600 hover:text-slate-900 transition-colors shrink-0"
                >
                  {copiedSlug ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="mt-6 flex border-b border-slate-200 gap-6 text-sm font-medium">
            <a
              href="/dashboard/products"
              className="pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-900 transition-colors flex items-center gap-1.5"
            >
              <span>Products</span>
            </a>
            <button
              onClick={() => setActiveTab('workspace')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'workspace'
                  ? 'border-emerald-600 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Organization Settings
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`pb-3 border-b-2 transition-colors ${
                activeTab === 'profile'
                  ? 'border-emerald-600 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-500 hover:text-slate-900'
              }`}
            >
              Seller Profile
            </button>
          </div>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {/* Tab 1: Organization Settings */}
          {activeTab === 'workspace' && organization && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Store & Currency Settings</h2>
                  <p className="text-xs text-slate-500">
                    Protected by RLS: Only organization owners can modify settings.
                  </p>
                </div>
              </div>

              {orgSuccess && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>Workspace settings updated successfully!</div>
                </div>
              )}

              <form onSubmit={handleUpdateOrganization} className="mt-6 space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Business / Store Name
                  </label>
                  <input
                    type="text"
                    required
                    disabled={memberRole !== 'owner'}
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="e.g. Nairobi Streetwear"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50 disabled:text-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Default Currency
                  </label>
                  <select
                    disabled={memberRole !== 'owner'}
                    value={orgCurrency}
                    onChange={(e) => setOrgCurrency(e.target.value)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    <option value="KES">KES — Kenyan Shilling (M-Pesa native)</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                    <option value="GBP">GBP — British Pound</option>
                    <option value="TZS">TZS — Tanzanian Shilling</option>
                    <option value="UGX">UGX — Ugandan Shilling</option>
                  </select>
                  <p className="mt-1 text-xs text-slate-500">
                    Used as the default transaction currency for checkout links and M-Pesa prompts.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Workspace Identifier (Slug)
                  </label>
                  <div className="mt-1.5 flex rounded-lg shadow-sm">
                    <span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-200 bg-slate-50 text-slate-500 text-xs font-mono">
                      commcart.co/store/
                    </span>
                    <input
                      type="text"
                      disabled
                      value={organization.slug}
                      className="block w-full font-mono rounded-r-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600 cursor-not-allowed"
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Workspace slugs are immutable to preserve active Instagram DM checkout links.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Organization ID (UUID)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={organization.id}
                    className="mt-1.5 block w-full font-mono rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-400">
                    Created on {new Date(organization.created_at).toLocaleDateString()}
                  </div>

                  {memberRole === 'owner' ? (
                    <button
                      type="submit"
                      disabled={savingOrg}
                      className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors disabled:opacity-60"
                    >
                      {savingOrg ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>Saving...</span>
                        </>
                      ) : (
                        <>
                          <Save className="h-3.5 w-3.5" />
                          <span>Update Settings</span>
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="text-xs text-slate-400 italic">
                      Only organization owners can modify workspace settings.
                    </div>
                  )}
                </div>
              </form>
            </div>
          )}

          {/* Tab 2: Seller Profile Settings */}
          {activeTab === 'profile' && (
            <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <UserIcon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Personal Profile</h2>
                  <p className="text-xs text-slate-500">Stored in public.profiles with Row Level Security</p>
                </div>
              </div>

              {profileSuccess && (
                <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                  <div>Personal profile updated successfully!</div>
                </div>
              )}

              <form onSubmit={handleUpdateProfile} className="mt-6 space-y-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your Full Name"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Account Email
                  </label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || ''}
                    className="mt-1.5 block w-full rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-500 cursor-not-allowed"
                  />
                  <p className="mt-1 text-xs text-slate-400">Email is managed by Supabase Auth</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    User ID (UUID)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user?.id || ''}
                    className="mt-1.5 block w-full font-mono rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-500 cursor-not-allowed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-400">
                    {profile?.created_at && (
                      <span>Registered on {new Date(profile.created_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors disabled:opacity-60"
                  >
                    {savingProfile ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Profile</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Architecture Status Card */}
          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Platform Milestones</h3>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Step 1 & 2 Active</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Seller Auth & Profiles with Row Level Security.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                  <Building2 className="h-4 w-4" />
                  <span>Step 3 Active</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Organizations & atomic owner membership with KES currency default.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-slate-500 text-xs font-semibold">
                  <Coins className="h-4 w-4" />
                  <span>Step 4 Upcoming</span>
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  Product catalog management & Instagram checkout links.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
