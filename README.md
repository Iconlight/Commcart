# CommCart

> **Sell directly through Instagram conversations with automated checkout and instant M-Pesa payments.**

CommCart is a social-commerce platform engineered for merchants and digital sellers. It transforms Instagram direct messages into high-converting sales channels by generating instant, frictionless checkout links and triggering real-time Safaricom M-Pesa STK push prompts on buyer phones.

---

## Tech Stack & Architecture

- **Frontend & App Structure**: Modern Next.js App Router architecture (`src/app/layout.tsx`, `src/app/page.tsx`) with React 19.
- **Styling**: Tailwind CSS v4 with responsive layouts and typographic hierarchy.
- **Backend & Database Readiness**: Supabase client (`@supabase/supabase-js`) initialized with graceful fallback.
- **Payment Gateway**: Safaricom M-Pesa Daraja API 2.0 (Lipa Na M-Pesa Online STK Push).
- **Messaging Integration**: Meta / Instagram Graph API & Webhook events.
- **Language**: TypeScript with strict typing.

---

## Project Structure

```text
├── .env.example              # Environment variables template with documentation
├── .env.local                # Local environment placeholders (git-ignored)
├── .gitignore                # Git ignore rules protecting local secrets
├── package.json              # Project dependencies & scripts
├── README.md                 # Project guide & architecture overview
├── index.html                # HTML entry point with synchronized metadata
├── metadata.json             # AI Studio app metadata
├── tsconfig.json             # TypeScript configuration
├── src/
│   ├── app/
│   │   ├── layout.tsx        # App root layout with global styling
│   │   └── page.tsx          # Minimal, polished landing page
│   ├── assets/
│   │   └── images/           # High-resolution generated media assets
│   ├── lib/
│   │   └── supabase.ts       # Supabase client singleton with environment checks
│   ├── types/
│   │   ├── database.types.ts # Entities for merchants, products, orders, transactions
│   │   ├── instagram.ts      # Meta webhook & DM message schemas
│   │   └── mpesa.ts          # Daraja STK push request, response, and callback types
│   ├── App.tsx               # Root application entry
│   ├── main.tsx              # React DOM mounting
│   └── index.css             # Tailwind CSS imports
```

---

## Getting Started

### 1. Installation

Install all required dependencies:

```bash
npm install
```

### 2. Environment Configuration

Copy the example environment configuration into `.env.local`:

```bash
cp .env.example .env.local
```

Configure your API keys in `.env.local`:
- **Supabase**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (from Supabase dashboard).
- **Meta / Instagram API**: `META_APP_ID`, `META_APP_SECRET`, and `INSTAGRAM_WEBHOOK_VERIFY_TOKEN`.
- **M-Pesa Daraja API**: `MPESA_CONSUMER_KEY`, `MPESA_CONSUMER_SECRET`, `MPESA_PASSKEY`, and `MPESA_SHORTCODE` (e.g. `174379` for sandbox testing).

### 3. Development Server

Start the development server:

```bash
npm run dev
```

The application will be running at [http://localhost:3000](http://localhost:3000).

### 4. Build & Production Check

To verify compilation and create an optimized production build:

```bash
npm run build
```

---

## Authentication & Database (Step 2)

CommCart implements seller authentication with Supabase Auth and `@supabase/ssr`:

- **Pages**:
  - `/signup`: Register with full name, email, and password. Supports immediate session or email confirmation handling.
  - `/login`: Sign in with email and password with client and server redirection.
  - `/auth/callback`: Handles verification callbacks and exchanges tokens.
  - `/dashboard`: Protected merchant dashboard shell displaying the seller's profile, email, and update mutation.
- **Server Route Protection**: Express routes protect `/dashboard` on the server by inspecting Supabase session cookies; unauthenticated requests are redirected (HTTP 302) to `/login`.
- **Database Migration**:
  - `supabase/migrations/20261026000001_create_profiles.sql`: Creates `public.profiles` referencing `auth.users(id)`.
  - Row Level Security (RLS) ensures sellers can only read and update their own profile.
  - Automatically triggered via `handle_new_user()` when a new user is inserted into `auth.users`.
  - Executable anytime with `npm run migrate`.

---

## Organization Setup & Management (Step 3)

CommCart features multi-tenant organization workspaces with atomic owner registration and Row Level Security:

- **Onboarding Page (`/onboarding`)**:
  - Automatically redirects authenticated sellers who do not yet belong to an organization.
  - Generates live slug previews (`commcart.co/store/{slug}`) with lowercase formatting and duplicate validation.
  - Sets default currency (`KES` for M-Pesa MVP, with multi-currency readiness).
- **Atomic Stored Procedure (`create_organization_with_owner`)**:
  - PostgreSQL transaction (`SECURITY DEFINER`) that simultaneously validates inputs, inserts into `public.organizations`, and attaches the authenticated user as the verified `owner` in `public.organization_members`.
  - Prevents race conditions and guarantees users cannot register themselves into another seller's organization.
- **Row Level Security (RLS)**:
  - `is_org_member(org_id)`: Limits read access strictly to verified organization members.
  - `is_org_owner(org_id)`: Enforces that only owners can modify organization business settings and currency.
- **Organization Settings in Dashboard (`/dashboard`)**:
  - Displays active organization title, slug link, member role, and currency.
  - Allows owners to update business name and default currency with immediate feedback.
- **Route Guards**:
  - Both client and server intercept unonboarded sellers navigating to `/dashboard` and redirect them to `/onboarding`.
  - Onboarded sellers navigating to `/onboarding` are redirected back to `/dashboard`.

---

## Product Management (Step 4)

CommCart features complete inventory and catalog management for sellers:

- **Database Table (`public.products`)**:
  - `id`: UUID primary key (`gen_random_uuid()`)
  - `organization_id`: References `public.organizations(id)`
  - `name`: Required text (2-120 chars)
  - `description`: Optional detailed description
  - `price`: Exact `NUMERIC(12, 2)` monetary amount (positive, max 2 decimals)
  - `currency`: Defaulted to workspace currency (`KES`)
  - `image_url`: Optional HTTP/HTTPS image URL with live thumbnail previews
  - `sku`: Optional stock keeping unit / barcode
  - `status`: `'active'` or `'archived'`
- **Row Level Security (RLS)**:
  - Members can only view, insert, and update products belonging to their organization (`is_org_member(organization_id)`).
  - Hard deletions are prevented by RLS so products can be safely referenced by future orders; products are archived instead.
- **Views**:
  - `/dashboard/products`: Catalog listing with search (name/SKU/description), status tabs (All/Active/Archived), quick archival toggles, and detail inspection modal.
  - `/dashboard/products/new`: Create product form with Zod schema validation and sample presets.
  - `/dashboard/products/edit`: Edit product form with real-time updates and status toggle.

---

## MVP Incremental Roadmap

1. **Step 1 (Completed)**: Project initialization, App Router layout, Supabase client setup, environment configuration, and verification landing page.
2. **Step 2 (Completed)**: Seller authentication, `@supabase/ssr` integration, `profiles` table migration with RLS & signup triggers, and protected `/dashboard`.
3. **Step 3 (Completed)**: Seller organization onboarding (`/onboarding`), `organizations` & `organization_members` tables, atomic creation RPC, and workspace settings.
4. **Step 4 (Completed)**: Product management (`/dashboard/products`), numeric price precision, Zod validation, archival flow, and organization RLS.
5. **Step 5 (Next)**: Meta/Instagram DM webhook listener & automated checkout intent parsing.
6. **Step 6**: Safaricom M-Pesa Daraja STK Push trigger, callback listener, and verified order fulfillment.



