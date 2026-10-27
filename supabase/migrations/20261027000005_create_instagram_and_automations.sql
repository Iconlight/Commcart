-- Migration: 20261027000005_create_instagram_and_automations.sql
-- Description: Creates social_accounts, social_account_tokens (server-only), instagram_posts, post_product_links, and automation_rules tables with cross-organization consistency triggers and ambiguity prevention.

-- 1. Create social_accounts table
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'instagram' CHECK (platform IN ('instagram', 'facebook', 'tiktok')),
  external_account_id TEXT NOT NULL,
  username TEXT NOT NULL,
  connection_status TEXT NOT NULL DEFAULT 'connected' CHECK (connection_status IN ('connected', 'expired', 'disconnected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_social_accounts_org_external UNIQUE (organization_id, platform, external_account_id),
  CONSTRAINT uq_social_accounts_platform_external UNIQUE (platform, external_account_id)
);

-- 2. Server-side only table for access tokens (isolated from public/client queries)
CREATE TABLE IF NOT EXISTS public.social_account_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  social_account_id UUID NOT NULL UNIQUE REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  token_type TEXT DEFAULT 'bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create instagram_posts table
CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  external_media_id TEXT NOT NULL,
  caption TEXT,
  media_type TEXT NOT NULL,
  media_url TEXT,
  permalink TEXT,
  thumbnail_url TEXT,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_instagram_posts_account_media UNIQUE (social_account_id, external_media_id)
);

-- 4. Create post_product_links table
CREATE TABLE IF NOT EXISTS public.post_product_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  instagram_post_id UUID NOT NULL REFERENCES public.instagram_posts(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_post_product_link UNIQUE (instagram_post_id, product_id)
);

-- 5. Create automation_rules table
CREATE TABLE IF NOT EXISTS public.automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  instagram_post_id UUID NOT NULL REFERENCES public.instagram_posts(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL DEFAULT 'comment_keyword' CHECK (trigger_type IN ('comment_keyword', 'dm_keyword')),
  keywords TEXT[] NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'exact' CHECK (match_mode IN ('exact', 'whole_word')),
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_social_accounts_org ON public.social_accounts(organization_id);
CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON public.social_accounts(organization_id, connection_status);

CREATE INDEX IF NOT EXISTS idx_instagram_posts_org ON public.instagram_posts(organization_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_account ON public.instagram_posts(social_account_id);
CREATE INDEX IF NOT EXISTS idx_instagram_posts_published ON public.instagram_posts(organization_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_post_product_links_org ON public.post_product_links(organization_id);
CREATE INDEX IF NOT EXISTS idx_post_product_links_post ON public.post_product_links(instagram_post_id);
CREATE INDEX IF NOT EXISTS idx_post_product_links_product ON public.post_product_links(product_id);

CREATE INDEX IF NOT EXISTS idx_automation_rules_org ON public.automation_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_post ON public.automation_rules(instagram_post_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_active ON public.automation_rules(instagram_post_id, is_enabled);

-- 7. Enable Row Level Security
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_account_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_product_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;

-- Notice: social_account_tokens has NO policy for authenticated or anon.
-- Only the backend service_role key can access social_account_tokens.

-- RLS Policies for social_accounts
DROP POLICY IF EXISTS "Members can view organization social accounts" ON public.social_accounts;
CREATE POLICY "Members can view organization social accounts"
  ON public.social_accounts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can insert organization social accounts" ON public.social_accounts;
CREATE POLICY "Members can insert organization social accounts"
  ON public.social_accounts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can update organization social accounts" ON public.social_accounts;
CREATE POLICY "Members can update organization social accounts"
  ON public.social_accounts FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can delete organization social accounts" ON public.social_accounts;
CREATE POLICY "Members can delete organization social accounts"
  ON public.social_accounts FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

-- RLS Policies for instagram_posts
DROP POLICY IF EXISTS "Members can view organization instagram posts" ON public.instagram_posts;
CREATE POLICY "Members can view organization instagram posts"
  ON public.instagram_posts FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can insert organization instagram posts" ON public.instagram_posts;
CREATE POLICY "Members can insert organization instagram posts"
  ON public.instagram_posts FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can update organization instagram posts" ON public.instagram_posts;
CREATE POLICY "Members can update organization instagram posts"
  ON public.instagram_posts FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can delete organization instagram posts" ON public.instagram_posts;
CREATE POLICY "Members can delete organization instagram posts"
  ON public.instagram_posts FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

-- RLS Policies for post_product_links
DROP POLICY IF EXISTS "Members can view organization post product links" ON public.post_product_links;
CREATE POLICY "Members can view organization post product links"
  ON public.post_product_links FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can insert organization post product links" ON public.post_product_links;
CREATE POLICY "Members can insert organization post product links"
  ON public.post_product_links FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can update organization post product links" ON public.post_product_links;
CREATE POLICY "Members can update organization post product links"
  ON public.post_product_links FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can delete organization post product links" ON public.post_product_links;
CREATE POLICY "Members can delete organization post product links"
  ON public.post_product_links FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

-- RLS Policies for automation_rules
DROP POLICY IF EXISTS "Members can view organization automation rules" ON public.automation_rules;
CREATE POLICY "Members can view organization automation rules"
  ON public.automation_rules FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can insert organization automation rules" ON public.automation_rules;
CREATE POLICY "Members can insert organization automation rules"
  ON public.automation_rules FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can update organization automation rules" ON public.automation_rules;
CREATE POLICY "Members can update organization automation rules"
  ON public.automation_rules FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can delete organization automation rules" ON public.automation_rules;
CREATE POLICY "Members can delete organization automation rules"
  ON public.automation_rules FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

-- 8. Updated_at triggers
DROP TRIGGER IF EXISTS set_social_accounts_updated_at ON public.social_accounts;
CREATE TRIGGER set_social_accounts_updated_at
  BEFORE UPDATE ON public.social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_social_account_tokens_updated_at ON public.social_account_tokens;
CREATE TRIGGER set_social_account_tokens_updated_at
  BEFORE UPDATE ON public.social_account_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_instagram_posts_updated_at ON public.instagram_posts;
CREATE TRIGGER set_instagram_posts_updated_at
  BEFORE UPDATE ON public.instagram_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_post_product_links_updated_at ON public.post_product_links;
CREATE TRIGGER set_post_product_links_updated_at
  BEFORE UPDATE ON public.post_product_links
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_automation_rules_updated_at ON public.automation_rules;
CREATE TRIGGER set_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 9. Consistency Trigger: Post-Product Link Organization Consistency
CREATE OR REPLACE FUNCTION public.check_post_product_link_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  post_org_id UUID;
  product_org_id UUID;
BEGIN
  SELECT organization_id INTO post_org_id FROM public.instagram_posts WHERE id = NEW.instagram_post_id;
  SELECT organization_id INTO product_org_id FROM public.products WHERE id = NEW.product_id;

  IF post_org_id IS NULL THEN
    RAISE EXCEPTION 'Referenced Instagram post does not exist.';
  END IF;

  IF product_org_id IS NULL THEN
    RAISE EXCEPTION 'Referenced product does not exist.';
  END IF;

  IF NEW.organization_id <> post_org_id OR NEW.organization_id <> product_org_id THEN
    RAISE EXCEPTION 'Cross-organization linking is prohibited: Post (%), Product (%), and Link (%) must share the same organization.',
      post_org_id, product_org_id, NEW.organization_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_post_product_link_org ON public.post_product_links;
CREATE TRIGGER trg_check_post_product_link_org
  BEFORE INSERT OR UPDATE ON public.post_product_links
  FOR EACH ROW
  EXECUTE FUNCTION public.check_post_product_link_org();

-- 10. Consistency Trigger & Keyword Ambiguity Prevention: Automation Rules
CREATE OR REPLACE FUNCTION public.check_automation_rule_org()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  acc_org_id UUID;
  post_org_id UUID;
  prod_org_id UUID;
  existing_rule RECORD;
  kw TEXT;
  normalized_kws TEXT[] := '{}';
BEGIN
  IF NEW.keywords IS NULL OR cardinality(NEW.keywords) = 0 THEN
    RAISE EXCEPTION 'An automation rule must contain at least one trigger keyword.';
  END IF;

  -- Normalize keywords to uppercase and trimmed
  FOREACH kw IN ARRAY NEW.keywords LOOP
    IF length(trim(kw)) > 0 THEN
      normalized_kws := array_append(normalized_kws, upper(trim(kw)));
    END IF;
  END LOOP;

  IF cardinality(normalized_kws) = 0 THEN
    RAISE EXCEPTION 'Keywords cannot be empty strings.';
  END IF;

  NEW.keywords := normalized_kws;

  -- Verify social account and post belong to NEW.organization_id
  SELECT organization_id INTO acc_org_id FROM public.social_accounts WHERE id = NEW.social_account_id;
  SELECT organization_id INTO post_org_id FROM public.instagram_posts WHERE id = NEW.instagram_post_id;

  IF acc_org_id IS NULL THEN
    RAISE EXCEPTION 'Referenced social account does not exist.';
  END IF;

  IF post_org_id IS NULL THEN
    RAISE EXCEPTION 'Referenced Instagram post does not exist.';
  END IF;

  IF NEW.organization_id <> acc_org_id OR NEW.organization_id <> post_org_id THEN
    RAISE EXCEPTION 'Organization mismatch: social account and Instagram post must belong to organization %', NEW.organization_id;
  END IF;

  -- Optional product_id validation
  IF NEW.product_id IS NOT NULL THEN
    SELECT organization_id INTO prod_org_id FROM public.products WHERE id = NEW.product_id;
    IF prod_org_id IS NULL OR NEW.organization_id <> prod_org_id THEN
      RAISE EXCEPTION 'Referenced product does not belong to the current organization.';
    END IF;
  END IF;

  -- Ambiguity Prevention: Prevent multiple enabled rules with overlapping keywords on the same post
  IF NEW.is_enabled THEN
    FOR existing_rule IN
      SELECT id, name, keywords
      FROM public.automation_rules
      WHERE instagram_post_id = NEW.instagram_post_id
        AND is_enabled = true
        AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LOOP
      FOREACH kw IN ARRAY NEW.keywords LOOP
        IF kw = ANY(existing_rule.keywords) THEN
          RAISE EXCEPTION 'Ambiguous rule configuration: Keyword "%" is already handled by enabled rule "%" on this post. Please choose a different keyword or disable the conflicting rule.',
            kw, existing_rule.name;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_automation_rule_org ON public.automation_rules;
CREATE TRIGGER trg_check_automation_rule_org
  BEFORE INSERT OR UPDATE ON public.automation_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.check_automation_rule_org();
