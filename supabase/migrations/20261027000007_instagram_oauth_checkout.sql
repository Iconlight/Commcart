-- Migration: 20261027000007_instagram_oauth_checkout.sql
-- OAuth pending state, connection metadata, demo flags, checkout sessions, orders, payments, webhook dedup.

-- 1. Social account connection metadata
ALTER TABLE public.social_accounts DROP CONSTRAINT IF EXISTS social_accounts_connection_status_check;
ALTER TABLE public.social_accounts
  ADD CONSTRAINT social_accounts_connection_status_check
  CHECK (connection_status IN ('disconnected', 'connecting', 'connected', 'expired', 'error'));

ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS facebook_page_id TEXT;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS facebook_page_name TEXT;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS connected_at TIMESTAMPTZ;
ALTER TABLE public.social_accounts ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;

-- 2. Short-lived OAuth page selection (server-only)
CREATE TABLE IF NOT EXISTS public.instagram_oauth_pending (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pages JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.instagram_oauth_pending ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_instagram_oauth_pending_org ON public.instagram_oauth_pending(organization_id);

-- 3. Webhook event deduplication (server-only)
CREATE TABLE IF NOT EXISTS public.instagram_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.instagram_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_instagram_webhook_events_created ON public.instagram_webhook_events(created_at DESC);

-- 4. Checkout sessions for comment → DM conversation
CREATE TABLE IF NOT EXISTS public.checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  social_account_id UUID NOT NULL REFERENCES public.social_accounts(id) ON DELETE CASCADE,
  automation_rule_id UUID REFERENCES public.automation_rules(id) ON DELETE SET NULL,
  instagram_post_id UUID REFERENCES public.instagram_posts(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  order_id UUID,
  instagram_user_id TEXT NOT NULL,
  instagram_username TEXT,
  comment_id TEXT,
  media_id TEXT,
  private_reply_sent BOOLEAN NOT NULL DEFAULT false,
  step TEXT NOT NULL DEFAULT 'awaiting_dm_reply'
    CHECK (step IN (
      'private_reply_sent',
      'awaiting_dm_reply',
      'collecting_quantity',
      'collecting_name',
      'collecting_phone',
      'collecting_delivery',
      'confirming_summary',
      'awaiting_payment',
      'paid',
      'failed',
      'cancelled'
    )),
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  customer_name TEXT,
  customer_phone TEXT,
  delivery_method TEXT CHECK (delivery_method IS NULL OR delivery_method IN ('delivery', 'pickup')),
  delivery_details TEXT,
  last_message_at TIMESTAMPTZ,
  messaging_window_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_checkout_sessions_org ON public.checkout_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_ig_user ON public.checkout_sessions(social_account_id, instagram_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_checkout_sessions_comment ON public.checkout_sessions(comment_id);

ALTER TABLE public.checkout_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view organization checkout sessions" ON public.checkout_sessions;
CREATE POLICY "Members can view organization checkout sessions"
  ON public.checkout_sessions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP TRIGGER IF EXISTS set_checkout_sessions_updated_at ON public.checkout_sessions;
CREATE TRIGGER set_checkout_sessions_updated_at
  BEFORE UPDATE ON public.checkout_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  checkout_session_id UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  instagram_user_id TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12, 2) NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'KES',
  delivery_method TEXT,
  delivery_details TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'fulfilled', 'cancelled', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT uq_orders_org_number UNIQUE (organization_id, order_number)
);

CREATE INDEX IF NOT EXISTS idx_orders_org ON public.orders(organization_id, created_at DESC);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view organization orders" ON public.orders;
CREATE POLICY "Members can view organization orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP TRIGGER IF EXISTS set_orders_updated_at ON public.orders;
CREATE TRIGGER set_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.checkout_sessions
  DROP CONSTRAINT IF EXISTS checkout_sessions_order_id_fkey;
ALTER TABLE public.checkout_sessions
  ADD CONSTRAINT checkout_sessions_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- 6. M-Pesa transactions (server-written; merchants may read)
CREATE TABLE IF NOT EXISTS public.mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  checkout_session_id UUID REFERENCES public.checkout_sessions(id) ON DELETE SET NULL,
  merchant_request_id TEXT,
  checkout_request_id TEXT,
  amount NUMERIC(12, 2) NOT NULL,
  phone_number TEXT NOT NULL,
  mpesa_receipt_number TEXT,
  status TEXT NOT NULL DEFAULT 'initiated'
    CHECK (status IN ('initiated', 'pending', 'completed', 'failed', 'cancelled')),
  result_code INTEGER,
  result_desc TEXT,
  transaction_date TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_mpesa_checkout_request
  ON public.mpesa_transactions(checkout_request_id)
  WHERE checkout_request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_mpesa_org ON public.mpesa_transactions(organization_id);

ALTER TABLE public.mpesa_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view organization mpesa transactions" ON public.mpesa_transactions;
CREATE POLICY "Members can view organization mpesa transactions"
  ON public.mpesa_transactions FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP TRIGGER IF EXISTS set_mpesa_transactions_updated_at ON public.mpesa_transactions;
CREATE TRIGGER set_mpesa_transactions_updated_at
  BEFORE UPDATE ON public.mpesa_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 7. Extra automation / template fields
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS variant_quantity_message TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS delivery_details_message TEXT;

ALTER TABLE public.message_templates DROP CONSTRAINT IF EXISTS message_templates_template_type_check;
ALTER TABLE public.message_templates
  ADD CONSTRAINT message_templates_template_type_check
  CHECK (template_type IN (
    'private_reply',
    'checkout_intro',
    'product_details',
    'variant_quantity',
    'delivery_details',
    'payment_instructions',
    'payment_confirmation',
    'payment_failed',
    'order_confirmation',
    'custom'
  ));

CREATE OR REPLACE FUNCTION public.seed_default_templates_for_org(org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'private_reply') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'Standard Private Reply', 'private_reply',
      'Hi {{customer_name}}! Thanks for your interest in {{product_name}} ({{product_price}}). Reply YES in this chat to continue checkout.', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'checkout_intro') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'Welcome & Store Intro', 'checkout_intro',
      'Welcome to {{store_name}}! We will help you order {{product_name}}.', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'product_details') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'Item Description & Pricing', 'product_details',
      '{{product_name}} is {{product_price}}. Reply with the quantity you want (e.g. 1).', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'variant_quantity') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'Quantity Prompt', 'variant_quantity',
      'How many units of {{product_name}} would you like? Reply with a number.', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'delivery_details') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'Delivery or Pickup Details', 'delivery_details',
      'Please reply DELIVERY plus your address, or PICKUP plus your preferred location.', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'payment_instructions') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'M-Pesa Payment Instructions', 'payment_instructions',
      'We will send an M-Pesa STK prompt of {{product_price}} to {{customer_phone}}. Enter your PIN on your phone to pay.', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'payment_confirmation') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'Payment Success Notice', 'payment_confirmation',
      'Payment received for order {{order_number}}. Thank you for shopping with {{store_name}}!', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'payment_failed') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'Payment Pending or Failed', 'payment_failed',
      'We could not confirm M-Pesa payment for {{product_name}}. Reply PAY to try again.', true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'order_confirmation') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (org_id, 'Order Confirmed', 'order_confirmation',
      'Order {{order_number}} is confirmed. We are preparing {{product_name}} (qty {{quantity}}).', true);
  END IF;
END;
$$;

-- Seed extra templates for existing orgs
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_templates_for_org(org.id);
  END LOOP;
END;
$$;

-- 8. Seed templates when a workspace is created
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

  clean_slug := lower(trim(org_slug));
  clean_slug := regexp_replace(clean_slug, '[^a-z0-9-]+', '-', 'g');
  clean_slug := regexp_replace(clean_slug, '^-+|-+$', '', 'g');

  IF length(clean_slug) < 2 THEN
    RAISE EXCEPTION 'Slug must contain at least 2 alphanumeric characters';
  END IF;

  IF EXISTS (SELECT 1 FROM public.organizations WHERE slug = clean_slug) THEN
    RAISE EXCEPTION 'The workspace slug "%" is already taken. Please choose another.', clean_slug;
  END IF;

  INSERT INTO public.organizations (name, slug, owner_id, default_currency)
  VALUES (trim(org_name), clean_slug, current_user_id, COALESCE(org_currency, 'KES'))
  RETURNING id INTO new_org_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_org_id, current_user_id, 'owner');

  PERFORM public.seed_default_templates_for_org(new_org_id);

  SELECT id, name, slug, owner_id, default_currency, created_at, updated_at
  INTO result_row
  FROM public.organizations
  WHERE id = new_org_id;

  RETURN to_jsonb(result_row);
END;
$$;
