-- Migration: 20261027000004_create_products.sql
-- Description: Creates the products table with numeric pricing, status constraints, organization-based RLS, and updated_at trigger.

-- 1. Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'KES',
  image_url TEXT,
  sku TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Performance & lookup indexes
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON public.products(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(organization_id, sku);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON public.products(organization_id, created_at DESC);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- SELECT: Members can only view products belonging to their organization
DROP POLICY IF EXISTS "Members can view organization products" ON public.products;
CREATE POLICY "Members can view organization products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

-- INSERT: Members can insert products into their organization
DROP POLICY IF EXISTS "Members can insert organization products" ON public.products;
CREATE POLICY "Members can insert organization products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

-- UPDATE: Members can update products within their organization
DROP POLICY IF EXISTS "Members can update organization products" ON public.products;
CREATE POLICY "Members can update organization products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

-- NOTE: No DELETE policy is granted to authenticated clients.
-- Products must be archived rather than hard-deleted to preserve future order references.

-- 5. Trigger for updated_at
DROP TRIGGER IF EXISTS set_products_updated_at ON public.products;
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();
