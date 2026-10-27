-- Migration: 20261026000003_fix_org_members_policy.sql
-- Description: Allows authenticated users to query their own organization memberships directly (user_id = auth.uid()) without circular subquery dependency.

DROP POLICY IF EXISTS "Members can view members of their organization" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view their own memberships" ON public.organization_members;

CREATE POLICY "Users can view their own memberships"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() 
    OR public.is_org_member(organization_id)
  );

-- Also ensure authenticated users can insert through create_organization_with_owner (already SECURITY DEFINER)
-- and view organizations where they are owner_id or member
DROP POLICY IF EXISTS "Members can view their organization" ON public.organizations;
CREATE POLICY "Members can view their organization"
  ON public.organizations
  FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR public.is_org_member(id)
  );
