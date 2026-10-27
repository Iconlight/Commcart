/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, MessageSquare, ShieldCheck, Smartphone, Sparkles } from 'lucide-react';

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setSubmitted(true);
  };

  const steps = [
    {
      index: '01',
      title: 'Customer Inquires via Instagram DM',
      summary:
        'A shopper messages your brand account about a product seen in your story, reel, or feed post.',
      detail:
        'CommCart captures the customer inquiry, recognizes the product SKU or inquiry context, and prepares an instant checkout session.',
    },
    {
      index: '02',
      title: 'Automated 1-Click Checkout Link',
      summary:
        'An interactive, frictionless checkout link is automatically sent back in the DM conversation.',
      detail:
        'No clunky external redirects or cart drop-offs. The buyer selects their quantity and delivery phone number in seconds.',
    },
    {
      index: '03',
      title: 'Instant M-Pesa STK Push Verification',
      summary:
        'A prompt triggers right on the customer’s phone to enter their M-Pesa PIN and authorize the payment.',
      detail:
        'Upon PIN confirmation, Safaricom Daraja notifies CommCart, the order is verified, and instant confirmation is delivered to both merchant and buyer.',
    },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 (Brand Wordmark - Nav Links - 1 Action) */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-8 px-6 lg:px-8">
          {/* Zone 1: Single text wordmark */}
          <a
            href="/"
            className="text-xl font-bold tracking-tight text-slate-950 transition-colors hover:text-emerald-700 whitespace-nowrap shrink-0"
          >
            CommCart
          </a>

          {/* Zone 2: 4 single-line links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#overview"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Overview
            </a>
            <a
              href="#how-it-works"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#mpesa-integration"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              M-Pesa Integration
            </a>
            <a
              href="#architecture"
              className="hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Architecture
            </a>
          </nav>

          {/* Zone 3: 1 primary action block */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/login"
              className="text-xs font-semibold text-slate-700 hover:text-slate-950 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In
            </a>
            <a
              href="/signup"
              className="inline-flex items-center justify-center rounded-lg bg-slate-950 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-all hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-950 whitespace-nowrap shrink-0"
            >
              Seller Sign Up
            </a>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section id="overview" className="border-b border-slate-100 py-16 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12 lg:gap-8">
              {/* Left Column: Heading & Value Prop */}
              <div className="lg:col-span-7">
                {/* Clean unboxed metadata kicker */}
                <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-emerald-700">
                  <span>Social Commerce</span>
                  <span aria-hidden="true">·</span>
                  <span>Instagram Automation</span>
                  <span aria-hidden="true">·</span>
                  <span>M-Pesa Daraja</span>
                </div>

                <h1 className="text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl lg:text-5xl" style={{ textWrap: 'balance' }}>
                  Sell directly inside Instagram conversations.
                </h1>

                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-slate-600">
                  CommCart turns direct messages into instant sales. Automate order intake in Instagram DMs, trigger seamless Safaricom M-Pesa STK prompts on customer phones, and reconcile payments in real time.
                </p>

                {/* Lead Capture Form */}
                <div id="waitlist" className="mt-8 max-w-lg">
                  {submitted ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 text-emerald-950">
                      <div className="flex items-start gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                        <div>
                          <p className="text-sm font-semibold">You’re on the priority merchant list</p>
                          <p className="mt-1 text-xs text-emerald-800">
                            We’ll notify {email} as soon as sandbox and onboarding access goes live.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Enter your business email"
                        className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                      />
                      <button
                        type="submit"
                        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 whitespace-nowrap shrink-0"
                      >
                        <span>Join Early Access</span>
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                  <p className="mt-2.5 text-xs text-slate-500">
                    Free pilot access for early adopters. No credit card required.
                  </p>
                </div>

                {/* Subdued metrics / trust markers */}
                <div className="mt-10 grid grid-cols-3 gap-6 border-t border-slate-200 pt-6">
                  <div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">0s</div>
                    <div className="text-xs text-slate-500">Cart redirect delay</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">M-Pesa</div>
                    <div className="text-xs text-slate-500">Daraja STK push</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-900 tabular-nums">100%</div>
                    <div className="text-xs text-slate-500">Automated DM receipts</div>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Visual Asset */}
              <div className="lg:col-span-5">
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm">
                  <img
                    src="/src/assets/images/commcart_hero_preview_1792825971651.jpg"
                    alt="CommCart Instagram DM checkout with M-Pesa prompt"
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      // Fallback container in case of asset issue
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="p-4 border-t border-slate-200 bg-white">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="font-medium text-slate-900">Live Merchant Preview</span>
                      <span className="tabular-nums">MVP Initialized</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 bg-slate-50/50 border-b border-slate-200">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                How CommCart Powers Social Checkout
              </h2>
              <p className="mt-3 text-slate-600">
                Turn passive followers into buying customers by closing the gap between discovery and payment.
              </p>
            </div>

            <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
              {steps.map((step, idx) => (
                <div
                  key={step.index}
                  onClick={() => setActiveStep(idx)}
                  className={`cursor-pointer rounded-xl border p-6 transition-all ${
                    activeStep === idx
                      ? 'border-emerald-500 bg-white shadow-sm ring-1 ring-emerald-500'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="text-sm font-semibold text-emerald-600 tabular-nums">
                    {step.index}
                  </div>
                  <h3 className="mt-2 text-base font-semibold text-slate-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                    {step.summary}
                  </p>
                  <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                    {step.detail}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* M-Pesa Integration Deep Dive */}
        <section id="mpesa-integration" className="py-20 border-b border-slate-200">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="mb-3 flex items-center gap-2 text-xs font-medium text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Safaricom Daraja API 2.0</span>
                </div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Native M-Pesa checkout built for Kenyan commerce
                </h2>
                <p className="mt-4 text-slate-600 leading-relaxed">
                  Over 90% of social media retail orders in Kenya settle through M-Pesa. Rather than forcing customers to copy-paste till numbers and manually text confirmation codes, CommCart automatically pushes the payment request directly to their phone screen.
                </p>

                <ul className="mt-6 space-y-3 text-sm text-slate-700">
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                    <span>Direct STK push to Paybill or Buy Goods Till number</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                    <span>Automated webhook verification against Safaricom receipts</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                    <span>Zero manual screenshot matching or reconciliation friction</span>
                  </li>
                </ul>
              </div>

              <div className="lg:col-span-6">
                <div className="rounded-xl border border-slate-200 bg-slate-900 p-6 text-slate-100 shadow-md">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3 text-xs text-slate-400">
                    <span className="font-mono">Daraja STK Push Simulation</span>
                    <span className="font-mono text-emerald-400">HTTP 200 OK</span>
                  </div>
                  <pre className="mt-4 overflow-x-auto text-xs font-mono text-slate-300 leading-relaxed">
{`{
  "MerchantRequestID": "29115-34620561-1",
  "CheckoutRequestID": "ws_CO_241020260012",
  "ResponseCode": "0",
  "ResponseDescription": "Success. Request accepted for processing",
  "CustomerMessage": "Success. Request accepted for processing"
}`}
                  </pre>
                  <div className="mt-4 rounded-lg bg-slate-800/80 p-3 text-xs text-slate-300">
                    <p className="font-medium text-emerald-400">Ready for Supabase Webhook Listener</p>
                    <p className="mt-1 text-slate-400">
                      Configured with environment variables in <code className="text-slate-200">.env.local</code>.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture & Next Steps */}
        <section id="architecture" className="py-20 bg-slate-50">
          <div className="mx-auto max-w-6xl px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                Clean Foundation for Incremental Delivery
              </h2>
              <p className="mt-3 text-slate-600">
                The CommCart codebase is prepared with modular TypeScript interfaces, Supabase client hooks, and environment configurations.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phase 1 (Current)</div>
                <div className="mt-2 text-base font-bold text-slate-900">Project Initialization</div>
                <p className="mt-2 text-xs text-slate-600">
                  Next.js App Router style layout, Supabase dependencies, .env.local templates, and build verification.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phase 2</div>
                <div className="mt-2 text-base font-bold text-slate-900">Auth & Database</div>
                <p className="mt-2 text-xs text-slate-600">
                  Supabase Auth for merchants, product catalog schema, and order status tables.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phase 3</div>
                <div className="mt-2 text-base font-bold text-slate-900">Meta Webhooks</div>
                <p className="mt-2 text-xs text-slate-600">
                  Instagram Messaging API integration, DM parsing, and dynamic checkout link dispatch.
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Phase 4</div>
                <div className="mt-2 text-base font-bold text-slate-900">Daraja STK Push</div>
                <p className="mt-2 text-xs text-slate-600">
                  Safaricom M-Pesa token generation, prompt triggers, callback verification, and receipt matching.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row lg:px-8">
          <div className="text-sm font-bold tracking-tight text-slate-900">
            CommCart
          </div>
          <div className="text-xs text-slate-500">
            &copy; {new Date().getFullYear()} CommCart Technologies. Built for conversational commerce.
          </div>
          <div className="flex gap-6 text-xs text-slate-600">
            <a href="#overview" className="hover:text-slate-950 transition-colors">Top</a>
            <a href="#how-it-works" className="hover:text-slate-950 transition-colors">Features</a>
            <a href="#architecture" className="hover:text-slate-950 transition-colors">Roadmap</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
