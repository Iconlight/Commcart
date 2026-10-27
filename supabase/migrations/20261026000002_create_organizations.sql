-- Migration: 20261026000002_create_organizations.sql
-- Description: Creates organizations and organization_members tables with RLS and atomic creation function.

-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_currency TEXT NOT NULL DEFAULT 'KES',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create organization_members table
CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(organization_id, user_id)
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON public.organizations(slug);
CREATE INDEX IF NOT EXISTS idx_organization_members_user ON public.organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org ON public.organization_members(organization_id);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- Helper security function to verify membership
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
$$;

-- Helper security function to verify owner role
CREATE OR REPLACE FUNCTION public.is_org_owner(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = org_id AND user_id = auth.uid() AND role = 'owner'
  );
$$;

-- RLS Policies for organizations
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(id));

DROP POLICY IF EXISTS "Owners can update their organization" ON public.organizations;
CREATE POLICY "Owners can update their organization"
  ON public.organizations
  FOR UPDATE
  TO authenticated
  USING (public.is_org_owner(id))
  WITH CHECK (public.is_org_owner(id));

-- RLS Policies for organization_members
DROP POLICY IF EXISTS "Members can view members of their organization" ON public.organization_members;
CREATE POLICY "Members can view members of their organization"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

-- Updated_at trigger for organizations
DROP TRIGGER IF EXISTS set_organizations_updated_at ON public.organizations;
CREATE TRIGGER set_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Atomic stored procedure: create_organization_with_owner
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  org_name TEXT,
  org_slug TEXT,
  org_currency TEXT DEFAULT 'KES'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id UUID;
  current_user_id UUID;
  clean_slug TEXT;
  result_row RECORD;
BEGIN
  current_user_id := auth.uid();
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF trim(org_name) IS NULL OR length(trim(org_name)) < 2 THEN
    RAISE EXCEPTION 'Organization name must be at least 2 characters';
  END IF;

  -- Clean slug format
  clean_slug := lower(trim(org_slug));
  clean_slug := regexp_replace(clean_slug, '[^a-z0-9-]+', '-', 'g');
  clean_slug := regexp_replace(clean_slug, '^-+|-+$', '', 'g');

  IF length(clean_slug) < 2 THEN
    RAISE EXCEPTION 'Slug must contain at least 2 alphanumeric characters';
  END IF;

  -- Validate uniqueness
  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = clean_slug) THEN
    RAISE EXCEPTION 'The workspace slug "%" is already taken. Please choose another.', clean_slug;
  END IF;

  -- Insert into organizations table
  INSERT INTO public.organizations (name, slug, owner_id, default_currency)
  VALUES (trim(org_name), clean_slug, current_user_id, COALESCE(org_currency, 'KES'))
  RETURNING id INTO new_org_id;

  -- Atomically register creator as owner member
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, current_user_id, 'owner');

  -- Fetch created organization record
  SELECT id, name, slug, owner_id, default_currency, created_at, updated_at
  INTO result_row
  FROM public.organizations
  WHERE id = new_org_id;

  RETURN to_jsonb(result_row);
END;
$$;
