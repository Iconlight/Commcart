/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Supabase Edge Function: instagram-webhook
 * This function runs directly on Supabase's global edge network (no Google login gate).
 * Meta's servers can reach this URL directly from anywhere in the world.
 */

// Follow this setup guide to deploy:
// supabase functions deploy instagram-webhook --no-verify-jwt

const VERIFY_TOKEN = Deno.env.get('INSTAGRAM_WEBHOOK_VERIFY_TOKEN') || 'commcart_ig_verify_token_2026';

Deno.serve(async (req) => {
  const url = new URL(req.url);

  // 1. Handle Meta Webhook Verification (GET request)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('[Instagram Webhook] Verification successful.');
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    return new Response('Verification failed', { status: 403 });
  }

  // 2. Handle Incoming Instagram Messages & Webhook Events (POST request)
  if (req.method === 'POST') {
    try {
      const payload = await req.json();
      console.log('[Instagram Webhook] Event payload:', JSON.stringify(payload));

      // Return 200 OK immediately to acknowledge receipt
      return new Response('EVENT_RECEIVED', { status: 200 });
    } catch (err) {
      console.error('[Instagram Webhook] Error parsing event:', err);
      return new Response('Invalid JSON', { status: 400 });
    }
  }

  return new Response('Method Not Allowed', { status: 405 });
});
