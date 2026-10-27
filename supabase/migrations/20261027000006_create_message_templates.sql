-- Migration: 20261027000006_create_message_templates.sql
-- Description: Creates message_templates table with RLS and adds message sequence columns to automation_rules.

-- 1. Create message_templates table
CREATE TABLE IF NOT EXISTS public.message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL CHECK (template_type IN (
    'private_reply',
    'checkout_intro',
    'product_details',
    'payment_instructions',
    'payment_confirmation',
    'payment_failed',
    'order_confirmation',
    'custom'
  )),
  content TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Indexes for message_templates
CREATE INDEX IF NOT EXISTS idx_message_templates_org ON public.message_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_message_templates_type ON public.message_templates(organization_id, template_type);

-- 3. Enable RLS on message_templates
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view organization message templates" ON public.message_templates;
CREATE POLICY "Members can view organization message templates"
  ON public.message_templates FOR SELECT TO authenticated
  USING (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can insert organization message templates" ON public.message_templates;
CREATE POLICY "Members can insert organization message templates"
  ON public.message_templates FOR INSERT TO authenticated
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can update organization message templates" ON public.message_templates;
CREATE POLICY "Members can update organization message templates"
  ON public.message_templates FOR UPDATE TO authenticated
  USING (public.is_org_member(organization_id))
  WITH CHECK (public.is_org_member(organization_id));

DROP POLICY IF EXISTS "Members can delete organization message templates" ON public.message_templates;
CREATE POLICY "Members can delete organization message templates"
  ON public.message_templates FOR DELETE TO authenticated
  USING (public.is_org_member(organization_id));

-- 4. Updated_at trigger for message_templates
DROP TRIGGER IF EXISTS set_message_templates_updated_at ON public.message_templates;
CREATE TRIGGER set_message_templates_updated_at
  BEFORE UPDATE ON public.message_templates
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- 5. Extend automation_rules with message configuration columns
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS private_reply_message TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS checkout_intro_message TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS product_details_message TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS payment_instructions_message TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS payment_confirmation_message TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS payment_failed_message TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS order_confirmation_message TEXT;
ALTER TABLE public.automation_rules ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES public.message_templates(id) ON DELETE SET NULL;

-- 6. Seed function for default organization message templates
CREATE OR REPLACE FUNCTION public.seed_default_templates_for_org(org_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Private Reply (Comment response)
  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'private_reply') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (
      org_id,
      'Standard Private Reply',
      'private_reply',
      'Hi {{customer_name}}! Thanks for inquiring about {{product_name}} ({{product_price}}). Here is your secure checkout link: {{checkout_link}}',
      true
    );
  END IF;

  -- 2. Checkout Introduction
  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'checkout_intro') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (
      org_id,
      'Welcome & Store Intro',
      'checkout_intro',
      'Welcome to {{store_name}}! We are delighted to assist you with {{product_name}}.',
      true
    );
  END IF;

  -- 3. Product Details
  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'product_details') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (
      org_id,
      'Item Description & Pricing',
      'product_details',
      '{{product_name}} is currently in stock for {{product_price}}. Instant delivery arrangement available upon order.',
      true
    );
  END IF;

  -- 4. Payment Instructions (M-Pesa STK Push)
  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'payment_instructions') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (
      org_id,
      'M-Pesa Payment Instructions',
      'payment_instructions',
      'We support Lipa Na M-Pesa Online! Simply enter your M-Pesa mobile number and you will receive an STK prompt on your phone to complete your payment of {{product_price}}.',
      true
    );
  END IF;

  -- 5. Payment Confirmation
  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'payment_confirmation') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (
      org_id,
      'Payment Success Notice',
      'payment_confirmation',
      'Payment Received! We have confirmed your payment of {{product_price}} via M-Pesa. Thank you!',
      true
    );
  END IF;

  -- 6. Payment Failed / Pending
  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'payment_failed') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (
      org_id,
      'Payment Pending or Failed',
      'payment_failed',
      'Your payment for {{product_name}} was not completed. Please verify your phone number and M-Pesa PIN, then tap here to try again: {{checkout_link}}',
      true
    );
  END IF;

  -- 7. Order Confirmation
  IF NOT EXISTS (SELECT 1 FROM public.message_templates WHERE organization_id = org_id AND template_type = 'order_confirmation') THEN
    INSERT INTO public.message_templates (organization_id, name, template_type, content, is_default)
    VALUES (
      org_id,
      'Order Dispatched & Confirmed',
      'order_confirmation',
      'Order #{{order_number}} is confirmed! Our team is preparing {{product_name}} for delivery. You will receive updates as soon as it ships.',
      true
    );
  END IF;
END;
$$;

-- 7. Backfill default templates for all existing organizations
DO $$
DECLARE
  org RECORD;
BEGIN
  FOR org IN SELECT id FROM public.organizations LOOP
    PERFORM public.seed_default_templates_for_org(org.id);
  END LOOP;
END;
$$;
