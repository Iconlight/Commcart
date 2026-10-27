/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../../types/database.types.ts';

/**
 * Normalizes and sanitizes Supabase URL to guarantee a valid HTTP/HTTPS protocol.
 * Strips accidental whitespace and recovers from postgresql connection strings.
 */
function resolveSupabaseUrl(rawUrl?: string): string {
  const fallback = 'https://nrbshsdcjkoixfdexjic.supabase.co';
  if (!rawUrl || typeof rawUrl !== 'string') return fallback;

  // Remove any whitespace or linebreaks
  const cleaned = rawUrl.trim().replace(/\s+/g, '');

  if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
    try {
      const parsed = new URL(cleaned);
      if (['http:', 'https:'].includes(parsed.protocol)) {
        return parsed.origin;
      }
    } catch {
      // Fall through to recovery
    }
  }

  // If a postgresql connection string was inadvertently provided
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

const rawSupabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  '';

const rawSupabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  '';

export const supabaseUrl = resolveSupabaseUrl(rawSupabaseUrl);
export const supabaseAnonKey = resolveSupabaseAnonKey(rawSupabaseAnonKey);

export function createClient() {
  return createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
}

export const supabase = createClient();
