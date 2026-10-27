/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { Request, Response } from 'express';
import type { Database } from '../../types/database.types.ts';

function resolveSupabaseUrl(rawUrl?: string): string {
  const fallback = 'https://nrbshsdcjkoixfdexjic.supabase.co';
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;

  const cleaned = rawUrl.trim().replace(/\s+/g, '');
  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const parsed = new URL(cleaned);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return parsed.origin;
      }
    } catch {}
  }

  const projectRefMatch =
    cleaned.match(/postgres\.([a-z0-9]+):/i) ||
    cleaned.match(/([a-z0-9]{20})/i);

  if (projectRefMatch && projectRefMatch[1]) {
    return `https://${projectRefMatch[1]}.supabase.co`;
  }

  return fallback;
}

function resolveSupabaseAnonKey(rawKey?: string): string {
  const fallback =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yYnNoc2RjamtvaXhmZGV4amljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI4MDE1ODUsImV4cCI6MjEwODM3NzU4NX0.PzVJg0b9qiYA3KqSPFqV7Atii-jfQsIpkpuzJZSxAK0';

  if (!rawKey || typeof rawKey !== 'string') return fallback;
  const cleaned = rawKey.trim().replace(/\s+/g, '');
  return cleaned || fallback;
}

const supabaseUrl = resolveSupabaseUrl(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL
);
const supabaseAnonKey = resolveSupabaseAnonKey(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

/**
 * Creates a server-side Supabase client for Express / Node.js HTTP requests
 */
export function createExpressServerClient(req: Request, res: Response) {
  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return Object.keys(req.cookies || {}).map((name) => ({
            name,
            value: req.cookies[name] || '',
          }));
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookie(name, value, options as CookieOptions);
          });
        },
      },
    }
  );
}
