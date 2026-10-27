/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import RootLayout from './app/layout.tsx';
import LandingPage from './app/page.tsx';
import LoginPage from './app/login/page.tsx';
import SignupPage from './app/signup/page.tsx';
import AuthCallbackPage from './app/auth/callback/page.tsx';
import DashboardPage from './app/dashboard/page.tsx';
import OnboardingPage from './app/onboarding/page.tsx';
import ProductsPage from './app/dashboard/products/page.tsx';
import NewProductPage from './app/dashboard/products/new/page.tsx';
import EditProductPage from './app/dashboard/products/edit/page.tsx';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { subscribeToNavigation, navigateTo } from './lib/navigation.ts';
import { Loader2 } from 'lucide-react';

function AppRouter() {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname || '/';
    }
    return '/';
  });

  const { user, organization, loading } = useAuth();

  // Listen to popstate and synchronous navigateTo calls
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };

    const unsubscribeNav = subscribeToNavigation((newPath) => {
      setCurrentPath(newPath);
    });

    // Intercept internal <a> clicks for seamless client-side SPA routing
    const handleClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement)?.closest('a');
      if (!target) return;
      const href = target.getAttribute('href');
      if (
        href &&
        href.startsWith('/') &&
        !href.startsWith('//') &&
        !target.getAttribute('target') &&
        !target.getAttribute('download')
      ) {
        e.preventDefault();
        navigateTo(href);
      }
    };

    window.addEventListener('popstate', handlePopState);
    document.addEventListener('click', handleClick);

    return () => {
      unsubscribeNav();
      window.removeEventListener('popstate', handlePopState);
      document.removeEventListener('click', handleClick);
    };
  }, []);

  const pathname = currentPath.split('?')[0] || '/';
  const normalizedPath =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname;

  // Route enforcement based on auth & organization status
  useEffect(() => {
    if (loading) return;

    const isDashboardRoute = normalizedPath.startsWith('/dashboard');

    if (user) {
      if (!organization) {
        // Authenticated without organization: must be on /onboarding
        if (normalizedPath === '/login' || normalizedPath === '/signup' || isDashboardRoute) {
          navigateTo('/onboarding');
        }
      } else {
        // Authenticated with organization: redirect away from auth and onboarding to products dashboard
        if (normalizedPath === '/login' || normalizedPath === '/signup' || normalizedPath === '/onboarding') {
          navigateTo('/dashboard/products');
        }
      }
    } else {
      // Unauthenticated: redirect protected views to /login
      if (isDashboardRoute || normalizedPath === '/onboarding') {
        navigateTo('/login');
      }
    }
  }, [user, organization, loading, normalizedPath]);

  // Only show initial spinner on cold-start refresh on protected pages before session resolves
  const isProtectedPath = normalizedPath.startsWith('/dashboard') || normalizedPath === '/onboarding';
  if (loading && isProtectedPath && !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-slate-600">Verifying merchant workspace...</p>
        </div>
      </div>
    );
  }

  const renderRoute = () => {
    switch (normalizedPath) {
      case '/login':
        return <LoginPage />;
      case '/signup':
        return <SignupPage />;
      case '/auth/callback':
        return <AuthCallbackPage />;
      case '/onboarding':
        return <OnboardingPage />;
      case '/dashboard/products':
        return <ProductsPage />;
      case '/dashboard/products/new':
        return <NewProductPage />;
      case '/dashboard/products/edit':
        return <EditProductPage />;
      case '/dashboard':
        return <DashboardPage />;
      default:
        return <LandingPage />;
    }
  };

  return <RootLayout>{renderRoute()}</RootLayout>;
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
