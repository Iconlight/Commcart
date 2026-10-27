/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from 'cookie-parser';
import { createExpressServerClient } from './src/lib/supabase/server.ts';

// Load environment variables (.env.local takes precedence)
dotenv.config({ path: '.env.local' });
dotenv.config();

// Guarantee VITE_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL are clean HTTPS URLs
if (process.env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL.startsWith('http')) {
  process.env.VITE_SUPABASE_URL = 'https://nrbshsdcjkoixfdexjic.supabase.co';
} else if (process.env.VITE_SUPABASE_URL) {
  process.env.VITE_SUPABASE_URL = process.env.VITE_SUPABASE_URL.replace(/\s+/g, '');
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\s+/g, '');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const isProd = process.env.NODE_ENV === 'production';

// Standard middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// -----------------------------------------------------------------------------
// Server-Side Authentication Guards
// -----------------------------------------------------------------------------

/**
 * Server-Side Authentication Guards
 * When cookies are present, optimize routing.
 * If cookies are not yet populated (e.g. in an iframe or localStorage-first sessions),
 * call next() so the React SPA loads and client-side Supabase Auth resolves seamlessly.
 */
app.get(['/dashboard', '/dashboard/*'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createExpressServerClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1);

      if (!memberships || memberships.length === 0) {
        return res.redirect('/onboarding');
      }
    }
    // Allow SPA to mount and check client session
    next();
  } catch (err) {
    next();
  }
});

app.get('/onboarding', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createExpressServerClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1);

      if (memberships && memberships.length > 0) {
        return res.redirect('/dashboard');
      }
    }
    // Allow SPA to mount and check client session
    next();
  } catch (err) {
    next();
  }
});

/**
 * Redirect authenticated users away from /login and /signup
 */
app.get(['/login', '/signup'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supabase = createExpressServerClient(req, res);
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const { data: memberships } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1);

      if (memberships && memberships.length > 0) {
        return res.redirect('/dashboard');
      }
      return res.redirect('/onboarding');
    }
    next();
  } catch (err) {
    next();
  }
});

/**
 * API route to check current authenticated seller session on the server
 */
app.get('/api/auth/me', async (req: Request, res: Response) => {
  try {
    const supabase = createExpressServerClient(req, res);
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return res.status(401).json({ authenticated: false, user: null });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    return res.status(200).json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        profile,
      },
    });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Server error' });
  }
});

// -----------------------------------------------------------------------------
// Meta & Instagram Graph API Webhook Endpoints
// -----------------------------------------------------------------------------

app.get('/api/webhooks/instagram', (req: Request, res: Response) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  const expectedToken =
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN || 'commcart_ig_verify_token_2026';

  console.log('[Meta Webhook] Verification request received:', {
    mode,
    tokenReceived: token,
    expectedToken,
    challenge,
  });

  if (mode === 'subscribe' && token === expectedToken) {
    console.log('[Meta Webhook] Successfully validated token. Responding with challenge.');
    res.status(200).send(challenge);
  } else {
    console.warn('[Meta Webhook] Verification failed: Token mismatch or invalid mode.');
    res.status(403).send('Verification token mismatch');
  }
});

app.post('/api/webhooks/instagram', (req: Request, res: Response) => {
  console.log('[Meta Webhook] Event payload received:', JSON.stringify(req.body, null, 2));
  res.status(200).send('EVENT_RECEIVED');
});

app.get('/api/auth/instagram/callback', (req: Request, res: Response) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('[Instagram OAuth] Error callback:', { error, error_description });
    res.status(400).send(`Authentication error: ${error_description || error}`);
    return;
  }

  console.log('[Instagram OAuth] Authorization code received:', { code, state });
  res.redirect('/?auth=instagram_success');
});

// -----------------------------------------------------------------------------
// Safaricom M-Pesa Daraja Webhook Endpoints
// -----------------------------------------------------------------------------

app.post('/api/webhooks/mpesa/callback', (req: Request, res: Response) => {
  console.log('[M-Pesa Webhook] Callback payload received:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      supabase: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      meta: Boolean(process.env.META_APP_ID),
      mpesa: Boolean(process.env.MPESA_CONSUMER_KEY),
    },
  });
});

// -----------------------------------------------------------------------------
// Frontend Integration (Vite Middleware in dev / Static dist in prod)
// -----------------------------------------------------------------------------

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[CommCart Server] Running on http://0.0.0.0:${PORT}`);
    console.log(
      `[Meta Webhook URL] https://ais-dev-n7mcmkrythonellq4byqgl-353218869751.europe-west1.run.app/api/webhooks/instagram`
    );
  });
}

startServer().catch((err) => {
  console.error('[CommCart Server] Startup failed:', err);
  process.exit(1);
});
