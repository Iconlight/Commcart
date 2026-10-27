/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Request, Response } from 'express';
import { createExpressServerClient } from '../lib/supabase/server.ts';
import { serverPool } from './db.ts';

export async function getRequestUser(req: Request, res: Response) {
  const supabase = createExpressServerClient(req, res);
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice('Bearer '.length).trim();
    const {
      data: { user },
    } = await supabase.auth.getUser(token);
    if (user) return user;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function authenticateSeller(req: Request, res: Response, organizationId: string) {
  const user = await getRequestUser(req, res);
  if (!user) {
    return { authorized: false as const, user: null, error: 'Unauthorized: Session invalid or expired' };
  }

  const memberCheck = await serverPool.query(
    'SELECT role FROM public.organization_members WHERE organization_id = $1 AND user_id = $2 LIMIT 1',
    [organizationId, user.id]
  );

  if (memberCheck.rows.length === 0) {
    return {
      authorized: false as const,
      user,
      error: 'Forbidden: You do not have access to this organization',
    };
  }

  return { authorized: true as const, user, role: memberCheck.rows[0].role as string };
}
