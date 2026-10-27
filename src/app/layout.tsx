/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

export const metadata = {
  title: 'CommCart — Social Commerce via Instagram & M-Pesa Checkout',
  description:
    'CommCart enables businesses to sell products directly through Instagram direct messages with automated checkout and M-Pesa payments.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 antialiased selection:bg-emerald-100 selection:text-emerald-900">
      {children}
    </div>
  );
}
