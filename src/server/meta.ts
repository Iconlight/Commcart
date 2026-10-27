/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';

export const GRAPH_API_VERSION = process.env.INSTAGRAM_GRAPH_API_VERSION || 'v21.0';

export const INSTAGRAM_OAUTH_SCOPES = [
  'instagram_basic',
  'instagram_manage_comments',
  'instagram_manage_messages',
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_metadata',
].join(',');

export function getAppUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(
    /\/$/,
    ''
  );
}

export function getOAuthRedirectUri() {
  return `${getAppUrl()}/api/auth/instagram/callback`;
}

export function graphUrl(path: string, params: Record<string, string> = {}) {
  const url = new URL(`https://graph.facebook.com/${GRAPH_API_VERSION}${path}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

export async function graphGet<T = any>(path: string, params: Record<string, string> = {}): Promise<T> {
  const res = await fetch(graphUrl(path, params));
  return (await res.json()) as T;
}

export async function graphPost<T = any>(
  path: string,
  body: Record<string, unknown>,
  accessToken: string
): Promise<T> {
  const res = await fetch(graphUrl(path, { access_token: accessToken }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as T;
}

export function signOAuthState(payload: Record<string, string>) {
  const secret = process.env.META_APP_SECRET || process.env.META_APP_ID || 'commcart-oauth';
  const json = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(json).digest('base64url');
  return `${json}.${sig}`;
}

export function verifyOAuthState(state: string): Record<string, string> | null {
  const secret = process.env.META_APP_SECRET || process.env.META_APP_ID || 'commcart-oauth';
  const [json, sig] = state.split('.');
  if (!json || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(json).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(json, 'base64url').toString('utf8')) as Record<string, string>;
    if (payload.exp && Number(payload.exp) < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function verifyMetaSignature(rawBody: Buffer | string, signatureHeader?: string) {
  const appSecret = process.env.META_APP_SECRET || '';
  if (!appSecret || appSecret.includes('your_')) {
    return { ok: false, reason: 'META_APP_SECRET is not configured; refusing unsigned webhooks.' };
  }
  if (!signatureHeader) {
    return { ok: false, reason: 'Missing X-Hub-Signature-256 header.' };
  }
  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');
  const received = signatureHeader.trim();
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return { ok: false, reason: 'Invalid Meta webhook signature.' };
  }
  return { ok: true, reason: null };
}

export type InstagramPageCandidate = {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  igUserId: string;
  igUsername: string;
};

export function extractPageCandidates(accountsPayload: any): InstagramPageCandidate[] {
  const pages = accountsPayload?.data || [];
  const candidates: InstagramPageCandidate[] = [];
  for (const page of pages) {
    const ig = page.instagram_business_account;
    if (ig?.id) {
      candidates.push({
        pageId: page.id,
        pageName: page.name || 'Facebook Page',
        pageAccessToken: page.access_token,
        igUserId: ig.id,
        igUsername: ig.username || ig.name || 'instagram',
      });
    }
  }
  return candidates;
}

export function renderTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>
) {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = vars[key];
    return value === undefined || value === null ? '' : String(value);
  });
}
