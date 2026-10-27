/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { serverPool } from './db.ts';
import { graphPost } from './meta.ts';

export async function getAccountToken(socialAccountId: string) {
  const acc = await serverPool.query(`SELECT * FROM public.social_accounts WHERE id = $1`, [
    socialAccountId,
  ]);
  if (acc.rows.length === 0) return null;
  const token = await serverPool.query(
    `SELECT access_token FROM public.social_account_tokens WHERE social_account_id = $1`,
    [socialAccountId]
  );
  return {
    account: acc.rows[0],
    accessToken: token.rows[0]?.access_token as string | undefined,
  };
}

export async function sendPrivateReply(socialAccountId: string, commentId: string, text: string) {
  const ctx = await getAccountToken(socialAccountId);
  if (!ctx?.accessToken) {
    return { ok: false, error: 'No Instagram access token stored. Reconnect the account.' };
  }

  const result = await graphPost(
    `/${ctx.account.external_account_id}/messages`,
    {
      recipient: { comment_id: commentId },
      message: { text },
    },
    ctx.accessToken
  );

  if (result.error) {
    return { ok: false, error: result.error.message as string, code: result.error.code };
  }
  return { ok: true, error: null, result };
}

export async function sendInstagramText(socialAccountId: string, igsid: string, text: string) {
  const ctx = await getAccountToken(socialAccountId);
  if (!ctx?.accessToken) {
    console.warn('[IG send] missing token');
    return { ok: false, error: 'No Instagram access token stored.' };
  }

  const result = await graphPost(
    `/${ctx.account.external_account_id}/messages`,
    {
      recipient: { id: igsid },
      message: { text },
    },
    ctx.accessToken
  );

  if (result.error) {
    console.warn('[IG send] Meta error', result.error);
    return { ok: false, error: result.error.message as string, code: result.error.code };
  }
  return { ok: true, error: null, result };
}
