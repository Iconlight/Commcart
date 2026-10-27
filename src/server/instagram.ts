/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { authenticateSeller, getRequestUser } from './auth.ts';
import { serverPool } from './db.ts';
import {
  GRAPH_API_VERSION,
  INSTAGRAM_OAUTH_SCOPES,
  extractPageCandidates,
  getOAuthRedirectUri,
  graphGet,
  InstagramPageCandidate,
  signOAuthState,
  verifyOAuthState,
} from './meta.ts';

export const instagramRouter = Router();

function publicAccount(row: Record<string, unknown>) {
  return {
    id: row.id,
    organization_id: row.organization_id,
    platform: row.platform,
    external_account_id: row.external_account_id,
    username: row.username,
    connection_status: row.connection_status,
    facebook_page_id: row.facebook_page_id,
    facebook_page_name: row.facebook_page_name,
    last_error: row.last_error,
    is_demo: row.is_demo,
    connected_at: row.connected_at,
    last_synced_at: row.last_synced_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function metaSetupHelp() {
  const redirectUri = getOAuthRedirectUri();
  return [
    `Add this Exact OAuth Redirect URI in Meta for Developers → Facebook Login → Settings: ${redirectUri}`,
    'Products required: Instagram Graph API (or Instagram API), Facebook Login, Webhooks.',
    'Permissions: instagram_basic, instagram_manage_comments, instagram_manage_messages, pages_show_list, pages_read_engagement, pages_manage_metadata.',
    'The Instagram account must be Professional (Creator or Business) and linked to a Facebook Page you admin.',
    'While the app is in Development mode, only Meta app admins, developers, and testers can complete OAuth.',
  ].join(' ');
}

async function persistInstagramAccount(params: {
  organizationId: string;
  candidate: InstagramPageCandidate;
  scopes?: string[];
  expiresAt?: Date | null;
}) {
  const { organizationId, candidate, scopes, expiresAt } = params;

  const insertAccount = await serverPool.query(
    `INSERT INTO public.social_accounts (
      organization_id, platform, external_account_id, username, connection_status,
      facebook_page_id, facebook_page_name, last_error, is_demo, connected_at, updated_at
    )
    VALUES ($1, 'instagram', $2, $3, 'connected', $4, $5, NULL, false, now(), now())
    ON CONFLICT (platform, external_account_id)
    DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      username = EXCLUDED.username,
      connection_status = 'connected',
      facebook_page_id = EXCLUDED.facebook_page_id,
      facebook_page_name = EXCLUDED.facebook_page_name,
      last_error = NULL,
      is_demo = false,
      connected_at = now(),
      updated_at = now()
    RETURNING *`,
    [organizationId, candidate.igUserId, candidate.igUsername, candidate.pageId, candidate.pageName]
  );

  const socialAccount = insertAccount.rows[0];

  await serverPool.query(
    `INSERT INTO public.social_account_tokens (
      social_account_id, access_token, token_type, expires_at, scopes, updated_at
    )
    VALUES ($1, $2, 'bearer', $3, $4, now())
    ON CONFLICT (social_account_id)
    DO UPDATE SET
      access_token = EXCLUDED.access_token,
      expires_at = EXCLUDED.expires_at,
      scopes = EXCLUDED.scopes,
      updated_at = now()`,
    [socialAccount.id, candidate.pageAccessToken, expiresAt || null, scopes || INSTAGRAM_OAUTH_SCOPES.split(',')]
  );

  return socialAccount;
}

async function discoverFromToken(token: string, pageIdHint?: string) {
  if (pageIdHint) {
    const pageData = await graphGet(`/${pageIdHint}`, {
      fields: 'id,name,access_token,instagram_business_account{id,username,name}',
      access_token: token,
    });
    if (pageData.error) {
      return { error: pageData.error, candidates: [] as InstagramPageCandidate[] };
    }
    if (!pageData.instagram_business_account?.id) {
      return {
        error: {
          message: `The Facebook Page "${pageData.name}" is not linked to an Instagram Professional account. In Instagram: Settings → Account type → Switch to Professional, then link this Facebook Page.`,
          code: 'unlinked_page',
        },
        candidates: [],
      };
    }
    return {
      error: null,
      candidates: [
        {
          pageId: pageData.id,
          pageName: pageData.name,
          pageAccessToken: pageData.access_token || token,
          igUserId: pageData.instagram_business_account.id,
          igUsername:
            pageData.instagram_business_account.username ||
            pageData.instagram_business_account.name ||
            'instagram',
        },
      ],
    };
  }

  const meData = await graphGet('/me', {
    fields:
      'id,name,accounts{id,name,access_token,instagram_business_account{id,username,name}}',
    access_token: token,
  });

  if (meData.error) {
    return { error: meData.error, candidates: [] as InstagramPageCandidate[] };
  }

  const candidates = extractPageCandidates(meData.accounts);
  if (candidates.length === 0) {
    return {
      error: {
        message:
          'No Instagram Professional accounts were found on Facebook Pages this user manages. Switch the Instagram account to Creator/Business and link it to a Facebook Page.',
        code: 'no_instagram',
      },
      candidates: [],
    };
  }
  return { error: null, candidates };
}

instagramRouter.get('/config', async (_req: Request, res: Response) => {
  const metaAppId = process.env.META_APP_ID || '';
  const metaAppSecret = process.env.META_APP_SECRET || '';
  const pageId = process.env.INSTAGRAM_PAGE_ID || '';
  const pageToken = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN || '';

  res.json({
    hasAppId: Boolean(metaAppId && !metaAppId.includes('your_')),
    appId: metaAppId && !metaAppId.includes('your_') ? metaAppId : null,
    hasAppSecret: Boolean(metaAppSecret && !metaAppSecret.includes('your_')),
    hasPageId: Boolean(pageId && !pageId.includes('your_')),
    hasPageAccessToken: Boolean(pageToken && !pageToken.includes('your_')),
    apiVersion: GRAPH_API_VERSION,
    callbackUrl: getOAuthRedirectUri(),
    appUrl: process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    oauthScopes: INSTAGRAM_OAUTH_SCOPES,
    setupHelp: metaSetupHelp(),
    oauthReady: Boolean(
      metaAppId &&
        !metaAppId.includes('your_') &&
        metaAppSecret &&
        !metaAppSecret.includes('your_')
    ),
  });
});

instagramRouter.get('/accounts', async (req: Request, res: Response) => {
  const organizationId = String(req.query.organizationId || '');
  if (!organizationId) return res.status(400).json({ error: 'Missing organizationId' });

  const auth = await authenticateSeller(req, res, organizationId);
  if (!auth.authorized) return res.status(401).json({ error: auth.error });

  const result = await serverPool.query(
    `SELECT id, organization_id, platform, external_account_id, username, connection_status,
            facebook_page_id, facebook_page_name, last_error, is_demo, connected_at, last_synced_at,
            created_at, updated_at
     FROM public.social_accounts
     WHERE organization_id = $1 AND platform = 'instagram'
     ORDER BY is_demo ASC, connected_at DESC NULLS LAST, created_at DESC`,
    [organizationId]
  );

  res.json({ accounts: result.rows.map(publicAccount) });
});

instagramRouter.get('/oauth/start', async (req: Request, res: Response) => {
  const organizationId = String(req.query.organizationId || '');
  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';

  if (!organizationId) {
    return res.redirect('/dashboard/posts?auth_error=' + encodeURIComponent('Missing organizationId'));
  }

  const auth = await authenticateSeller(req, res, organizationId);
  if (!auth.authorized || !auth.user) {
    return res.redirect(
      '/dashboard/posts?auth_error=' + encodeURIComponent(auth.error || 'Please sign in first.')
    );
  }

  if (!appId || appId.includes('your_') || !appSecret || appSecret.includes('your_')) {
    return res.redirect(
      '/dashboard/posts?auth_error=' +
        encodeURIComponent(
          'META_APP_ID and META_APP_SECRET must be set before OAuth can start. ' + metaSetupHelp()
        )
    );
  }

  const state = signOAuthState({
    orgId: organizationId,
    userId: auth.user.id,
    nonce: crypto.randomUUID(),
    exp: String(Date.now() + 15 * 60 * 1000),
  });

  res.cookie('commcart_ig_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 15 * 60 * 1000,
  });

  const dialog = new URL(`https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`);
  dialog.searchParams.set('client_id', appId);
  dialog.searchParams.set('redirect_uri', getOAuthRedirectUri());
  dialog.searchParams.set('state', state);
  dialog.searchParams.set('scope', INSTAGRAM_OAUTH_SCOPES);
  dialog.searchParams.set('response_type', 'code');

  return res.redirect(dialog.toString());
});

export async function completeInstagramOAuth(req: Request, res: Response) {
  const { code, state, error, error_description } = req.query;
  const dashboard = '/dashboard/posts';

  if (error) {
    return res.redirect(
      `${dashboard}?auth_error=${encodeURIComponent(String(error_description || error))}`
    );
  }

  if (!code || !state) {
    return res.redirect(`${dashboard}?auth_error=${encodeURIComponent('OAuth callback missing code or state.')}`);
  }

  const payload = verifyOAuthState(String(state));
  const cookieState = req.cookies?.commcart_ig_oauth_state;
  if (!payload || (cookieState && cookieState !== String(state))) {
    return res.redirect(`${dashboard}?auth_error=${encodeURIComponent('OAuth state mismatch. Please try Connect Instagram again.')}`);
  }

  const appId = process.env.META_APP_ID || '';
  const appSecret = process.env.META_APP_SECRET || '';
  const redirectUri = getOAuthRedirectUri();

  const tokenData = await graphGet('/oauth/access_token', {
    client_id: appId,
    redirect_uri: redirectUri,
    client_secret: appSecret,
    code: String(code),
  });

  if (tokenData.error || !tokenData.access_token) {
    return res.redirect(
      `${dashboard}?auth_error=${encodeURIComponent(
        tokenData.error?.message ||
          'Token exchange failed. Confirm the redirect URI in Meta matches: ' + redirectUri
      )}`
    );
  }

  let longLived = tokenData.access_token;
  let expiresAt: Date | null = tokenData.expires_in
    ? new Date(Date.now() + Number(tokenData.expires_in) * 1000)
    : null;

  const exchange = await graphGet('/oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: tokenData.access_token,
  });

  if (exchange.access_token) {
    longLived = exchange.access_token;
    if (exchange.expires_in) {
      expiresAt = new Date(Date.now() + Number(exchange.expires_in) * 1000);
    }
  }

  const discovered = await discoverFromToken(longLived);
  if (discovered.error) {
    return res.redirect(
      `${dashboard}?auth_error=${encodeURIComponent(discovered.error.message || 'Could not list Instagram pages.')}`
    );
  }

  if (discovered.candidates.length === 1) {
    const account = await persistInstagramAccount({
      organizationId: payload.orgId,
      candidate: discovered.candidates[0],
      expiresAt,
    });
    res.clearCookie('commcart_ig_oauth_state');
    return res.redirect(
      `${dashboard}?auth=instagram_connected&accountId=${account.id}&username=${encodeURIComponent(account.username)}`
    );
  }

  const pending = await serverPool.query(
    `INSERT INTO public.instagram_oauth_pending (organization_id, user_id, pages, expires_at)
     VALUES ($1, $2, $3::jsonb, now() + interval '15 minutes')
     RETURNING id`,
    [payload.orgId, payload.userId, JSON.stringify(discovered.candidates)]
  );

  res.clearCookie('commcart_ig_oauth_state');
  return res.redirect(`${dashboard}?select_account=${pending.rows[0].id}`);
}

instagramRouter.get('/oauth/pending', async (req: Request, res: Response) => {
  const pendingId = String(req.query.pendingId || '');
  if (!pendingId) return res.status(400).json({ error: 'Missing pendingId' });

  const pending = await serverPool.query(
    `SELECT * FROM public.instagram_oauth_pending WHERE id = $1 AND expires_at > now()`,
    [pendingId]
  );
  if (pending.rows.length === 0) {
    return res.status(404).json({ error: 'This Instagram selection expired. Start Connect Instagram again.' });
  }

  const auth = await authenticateSeller(req, res, pending.rows[0].organization_id);
  if (!auth.authorized || auth.user?.id !== pending.rows[0].user_id) {
    return res.status(401).json({ error: auth.error || 'Not allowed to complete this connection.' });
  }

  const pages = (pending.rows[0].pages as InstagramPageCandidate[]).map((p) => ({
    pageId: p.pageId,
    pageName: p.pageName,
    igUserId: p.igUserId,
    igUsername: p.igUsername,
  }));

  res.json({ pendingId, organizationId: pending.rows[0].organization_id, pages });
});

instagramRouter.post('/oauth/select', async (req: Request, res: Response) => {
  try {
    const { pendingId, pageId } = req.body || {};
    if (!pendingId || !pageId) {
      return res.status(400).json({ error: 'Missing pendingId or pageId' });
    }

    const pending = await serverPool.query(
      `SELECT * FROM public.instagram_oauth_pending WHERE id = $1 AND expires_at > now()`,
      [pendingId]
    );
    if (pending.rows.length === 0) {
      return res.status(404).json({ error: 'Selection expired. Start Connect Instagram again.' });
    }

    const auth = await authenticateSeller(req, res, pending.rows[0].organization_id);
    if (!auth.authorized || auth.user?.id !== pending.rows[0].user_id) {
      return res.status(401).json({ error: auth.error || 'Not allowed' });
    }

    const pages = pending.rows[0].pages as InstagramPageCandidate[];
    const chosen = pages.find((p) => p.pageId === pageId);
    if (!chosen) {
      return res.status(400).json({ error: 'That Facebook Page was not in the authorized list.' });
    }

    const account = await persistInstagramAccount({
      organizationId: pending.rows[0].organization_id,
      candidate: chosen,
    });

    await serverPool.query('DELETE FROM public.instagram_oauth_pending WHERE id = $1', [pendingId]);

    return res.json({
      success: true,
      account: publicAccount(account),
      message: `Connected Instagram @${account.username}`,
    });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to complete Instagram selection',
    });
  }
});

instagramRouter.post('/connect', async (req: Request, res: Response) => {
  try {
    const { organizationId, customToken, customPageId } = req.body || {};
    if (!organizationId) {
      return res.status(400).json({ error: 'Missing organizationId' });
    }

    const auth = await authenticateSeller(req, res, organizationId);
    if (!auth.authorized) {
      return res.status(401).json({ error: auth.error });
    }

    const tokenToUse = String(customToken || '').trim();
    const pageIdToUse = String(customPageId || '').trim();

    if (!tokenToUse) {
      return res.status(400).json({
        error:
          'Connect Instagram uses Meta OAuth. Open Connect Instagram, or paste a Page access token from Graph API Explorer as an advanced option.',
        requiresOAuth: true,
        setupHelp: metaSetupHelp(),
      });
    }

    const discovered = await discoverFromToken(tokenToUse, pageIdToUse || undefined);
    if (discovered.error) {
      const code = discovered.error.code;
      return res.status(400).json({
        error: discovered.error.message,
        code,
        subcode: discovered.error.error_subcode,
        metaType: discovered.error.type,
        help:
          code === 190
            ? 'The Meta access token has expired or is invalid. Use Connect Instagram (OAuth) or generate a new Page token in Graph API Explorer.'
            : metaSetupHelp(),
      });
    }

    if (discovered.candidates.length > 1 && !pageIdToUse) {
      return res.json({
        success: false,
        requiresSelection: true,
        pages: discovered.candidates.map((p) => ({
          pageId: p.pageId,
          pageName: p.pageName,
          igUserId: p.igUserId,
          igUsername: p.igUsername,
        })),
        message: 'Select which Instagram professional account to connect.',
      });
    }

    const candidate =
      discovered.candidates.find((c) => c.pageId === pageIdToUse) || discovered.candidates[0];
    const socialAccount = await persistInstagramAccount({
      organizationId,
      candidate,
    });

    return res.status(200).json({
      success: true,
      account: publicAccount(socialAccount),
      message: `Successfully connected Instagram professional account @${socialAccount.username}`,
    });
  } catch (err: unknown) {
    console.error('[Meta Connect Error]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Server error connecting Instagram account',
    });
  }
});

instagramRouter.post('/sync-media', async (req: Request, res: Response) => {
  try {
    const { organizationId, socialAccountId } = req.body || {};
    if (!organizationId || !socialAccountId) {
      return res.status(400).json({ error: 'Missing organizationId or socialAccountId' });
    }

    const auth = await authenticateSeller(req, res, organizationId);
    if (!auth.authorized) {
      return res.status(401).json({ error: auth.error });
    }

    const accQuery = await serverPool.query(
      `SELECT * FROM public.social_accounts WHERE id = $1 AND organization_id = $2`,
      [socialAccountId, organizationId]
    );

    if (accQuery.rows.length === 0) {
      return res.status(404).json({ error: 'Social account not found for this organization.' });
    }

    const socialAcc = accQuery.rows[0];
    if (socialAcc.is_demo) {
      return res.status(400).json({
        error: 'This is a development demo account. Connect a real Instagram professional account to sync posts.',
      });
    }

    const tokenQuery = await serverPool.query(
      'SELECT access_token FROM public.social_account_tokens WHERE social_account_id = $1',
      [socialAcc.id]
    );

    const accessToken = tokenQuery.rows[0]?.access_token || '';
    if (!accessToken) {
      await serverPool.query(
        `UPDATE public.social_accounts SET connection_status = 'disconnected', last_error = $2, updated_at = now() WHERE id = $1`,
        [socialAcc.id, 'No access token stored. Reconnect Instagram.']
      );
      return res.status(400).json({
        error: 'No active access token found for this account. Reconnect Instagram with OAuth.',
      });
    }

    const mediaData = await graphGet(`/${socialAcc.external_account_id}/media`, {
      fields: 'id,caption,media_type,media_url,permalink,thumbnail_url,timestamp',
      limit: '50',
      access_token: accessToken,
    });

    if (mediaData.error) {
      const expired = mediaData.error.code === 190;
      await serverPool.query(
        `UPDATE public.social_accounts
         SET connection_status = $2, last_error = $3, updated_at = now()
         WHERE id = $1`,
        [socialAcc.id, expired ? 'expired' : 'error', mediaData.error.message]
      );
      return res.status(400).json({
        error: mediaData.error.message,
        code: mediaData.error.code,
        subcode: mediaData.error.error_subcode,
        metaType: mediaData.error.type,
        help: expired
          ? 'The stored Page token expired. Click Connect Instagram again to re-authenticate.'
          : 'Meta could not list media. Confirm instagram_basic is granted and the account is Professional.',
      });
    }

    const items = mediaData.data || [];
    let syncedCount = 0;

    for (const item of items) {
      await serverPool.query(
        `INSERT INTO public.instagram_posts (
          organization_id, social_account_id, external_media_id,
          caption, media_type, media_url, permalink, thumbnail_url, published_at, is_demo, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, now())
        ON CONFLICT (social_account_id, external_media_id)
        DO UPDATE SET
          caption = EXCLUDED.caption,
          media_type = EXCLUDED.media_type,
          media_url = EXCLUDED.media_url,
          permalink = EXCLUDED.permalink,
          thumbnail_url = EXCLUDED.thumbnail_url,
          published_at = EXCLUDED.published_at,
          is_demo = false,
          updated_at = now()`,
        [
          organizationId,
          socialAcc.id,
          item.id,
          item.caption || null,
          item.media_type || 'IMAGE',
          item.media_url || null,
          item.permalink || null,
          item.thumbnail_url || null,
          item.timestamp ? new Date(item.timestamp).toISOString() : null,
        ]
      );
      syncedCount++;
    }

    await serverPool.query(
      `UPDATE public.social_accounts
       SET connection_status = 'connected', last_error = NULL, last_synced_at = now(), updated_at = now()
       WHERE id = $1`,
      [socialAcc.id]
    );

    const updatedPosts = await serverPool.query(
      `SELECT * FROM public.instagram_posts
       WHERE social_account_id = $1
       ORDER BY published_at DESC NULLS LAST, created_at DESC`,
      [socialAcc.id]
    );

    return res.status(200).json({
      success: true,
      syncedCount,
      totalCount: updatedPosts.rows.length,
      posts: updatedPosts.rows,
    });
  } catch (err: unknown) {
    console.error('[Meta Sync Media Error]', err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Server error retrieving Instagram posts',
    });
  }
});

instagramRouter.post('/disconnect', async (req: Request, res: Response) => {
  try {
    const { organizationId, socialAccountId } = req.body || {};
    if (!organizationId || !socialAccountId) {
      return res.status(400).json({ error: 'Missing organizationId or socialAccountId' });
    }

    const auth = await authenticateSeller(req, res, organizationId);
    if (!auth.authorized) {
      return res.status(401).json({ error: auth.error });
    }

    await serverPool.query(
      `UPDATE public.social_accounts
       SET connection_status = 'disconnected', last_error = NULL, updated_at = now()
       WHERE id = $1 AND organization_id = $2`,
      [socialAccountId, organizationId]
    );
    await serverPool.query('DELETE FROM public.social_account_tokens WHERE social_account_id = $1', [
      socialAccountId,
    ]);

    return res.status(200).json({
      success: true,
      message: 'Instagram account successfully disconnected.',
    });
  } catch (err: unknown) {
    return res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to disconnect account',
    });
  }
});

instagramRouter.get('/oauth/start-url', async (req: Request, res: Response) => {
  const organizationId = String(req.query.organizationId || '');
  if (!organizationId) return res.status(400).json({ error: 'Missing organizationId' });
  const user = await getRequestUser(req, res);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({ url: `/api/instagram/oauth/start?organizationId=${encodeURIComponent(organizationId)}` });
});
