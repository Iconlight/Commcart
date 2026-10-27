/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext.tsx';
import {
  Package,
  Instagram,
  Zap,
  MessageSquare,
  Building2,
  ArrowLeft,
  LogOut,
} from 'lucide-react';

interface DashboardNavProps {
  activeTab: 'products' | 'posts' | 'automations' | 'messages' | 'workspace';
  productCount?: number;
  postsCount?: number;
  automationsCount?: number;
  messagesCount?: number;
}

export default function DashboardNav({
  activeTab,
  productCount,
  postsCount,
  automationsCount,
  messagesCount,
}: DashboardNavProps) {
  const { user, organization, signOut } = useAuth();

  return (
    <>
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
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <span className="hidden md:inline-block text-xs font-medium text-slate-600 truncate max-w-[200px]">
              {user?.email}
            </span>
            <button
              onClick={signOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:text-slate-900 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5 text-slate-500" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs Bar */}
      <div className="border-b border-slate-200 bg-white shadow-2xs">
        <div className="mx-auto flex max-w-6xl items-center gap-2 sm:gap-6 px-6 lg:px-8 text-sm font-medium overflow-x-auto py-2">
          {/* 1. Products Tab */}
          <a
            href="/dashboard/products"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'products'
                ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/80 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Package
              className={`h-4 w-4 ${
                activeTab === 'products' ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
            <span>Products</span>
            {typeof productCount === 'number' && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === 'products'
                    ? 'bg-emerald-200/60 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {productCount}
              </span>
            )}
          </a>

          {/* 2. Instagram Accounts & Posts Tab */}
          <a
            href="/dashboard/posts"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'posts'
                ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/80 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Instagram
              className={`h-4 w-4 ${
                activeTab === 'posts' ? 'text-pink-600' : 'text-slate-400'
              }`}
            />
            <span>Instagram Accounts & Posts</span>
            {typeof postsCount === 'number' && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === 'posts'
                    ? 'bg-emerald-200/60 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {postsCount}
              </span>
            )}
          </a>

          {/* 3. Automations Tab */}
          <a
            href="/dashboard/automations"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'automations'
                ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/80 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Zap
              className={`h-4 w-4 ${
                activeTab === 'automations' ? 'text-amber-500' : 'text-slate-400'
              }`}
            />
            <span>Automations</span>
            {typeof automationsCount === 'number' && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === 'automations'
                    ? 'bg-emerald-200/60 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {automationsCount}
              </span>
            )}
          </a>

          {/* 4. Messages Tab */}
          <a
            href="/dashboard/messages"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'messages'
                ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/80 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <MessageSquare
              className={`h-4 w-4 ${
                activeTab === 'messages' ? 'text-blue-600' : 'text-slate-400'
              }`}
            />
            <span>Messages</span>
            {typeof messagesCount === 'number' && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  activeTab === 'messages'
                    ? 'bg-emerald-200/60 text-emerald-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {messagesCount}
              </span>
            )}
          </a>

          {/* 5. Workspace Settings Tab */}
          <a
            href="/dashboard"
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors whitespace-nowrap ${
              activeTab === 'workspace'
                ? 'bg-emerald-50 text-emerald-900 font-semibold border border-emerald-200/80 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <Building2
              className={`h-4 w-4 ${
                activeTab === 'workspace' ? 'text-emerald-600' : 'text-slate-400'
              }`}
            />
            <span>Store Settings</span>
          </a>
        </div>
      </div>
    </>
  );
}
