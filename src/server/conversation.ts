/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { serverPool } from './db.ts';
import { renderTemplate } from './meta.ts';
import { sendInstagramText, sendPrivateReply } from './messaging.ts';
import { initiateStkPush, mpesaConfigured, normalizeMsisdn } from './mpesa.ts';

export { sendInstagramText };

function matchKeyword(text: string, keywords: string[], mode: string) {
  const raw = (text || '').trim();
  const upper = raw.toUpperCase();
  for (const kw of keywords || []) {
    const needle = kw.trim().toUpperCase();
    if (!needle) continue;
    if (mode === 'whole_word') {
      const re = new RegExp(`\\b${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (re.test(raw)) return kw;
    } else if (upper === needle) {
      return kw;
    }
  }
  return null;
}

async function templateDefaults(organizationId: string) {
  const tmplQ = await serverPool.query(
    `SELECT template_type, content FROM public.message_templates
     WHERE organization_id = $1 AND is_default = true`,
    [organizationId]
  );
  const defaults: Record<string, string> = {};
  for (const t of tmplQ.rows) defaults[t.template_type] = t.content;
  return defaults;
}

function varsFrom(row: Record<string, any>) {
  const price = Number(row.product_price || row.total_amount || 0);
  const currency = row.currency || 'KES';
  return {
    customer_name: row.customer_name || row.instagram_username || 'there',
    product_name: row.product_name || 'this product',
    product_price: `${currency} ${price.toLocaleString()}`,
    store_name: row.store_name || 'our store',
    order_number: row.order_number || '',
    checkout_link: `Reply YES in this chat to continue`,
    quantity: row.quantity || 1,
    customer_phone: row.customer_phone || '',
  };
}

export async function handleCommentEvent(value: any, igAccountId: string) {
  const commentId = value.id;
  const text = value.text || '';
  const mediaId = value.media?.id || value.media_id;
  const fromId = value.from?.id;
  const fromUsername = value.from?.username;

  if (!commentId || !mediaId || !fromId) return { skipped: true, reason: 'incomplete comment payload' };

  const insert = await serverPool.query(
    `INSERT INTO public.instagram_webhook_events (event_key, event_type, payload, processed)
     VALUES ($1, 'comment', $2::jsonb, false)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [`comment:${commentId}`, JSON.stringify(value)]
  );
  if (insert.rows.length === 0) return { skipped: true, reason: 'duplicate comment' };

  const postQ = await serverPool.query(
    `SELECT p.*, sa.connection_status, sa.id AS social_account_id, sa.organization_id AS org_id
     FROM public.instagram_posts p
     JOIN public.social_accounts sa ON sa.id = p.social_account_id
     WHERE p.external_media_id = $1 AND sa.external_account_id = $2 AND sa.is_demo = false
     LIMIT 1`,
    [String(mediaId), String(igAccountId)]
  );
  if (postQ.rows.length === 0) {
    return { skipped: true, reason: 'media not linked in CommCart' };
  }

  const post = postQ.rows[0];
  if (post.connection_status !== 'connected') {
    return { skipped: true, reason: 'instagram account not connected' };
  }

  const rulesQ = await serverPool.query(
    `SELECT * FROM public.automation_rules
     WHERE instagram_post_id = $1 AND is_enabled = true AND organization_id = $2`,
    [post.id, post.org_id]
  );

  let matched: any = null;
  for (const rule of rulesQ.rows) {
    if (matchKeyword(text, rule.keywords, rule.match_mode)) {
      matched = rule;
      break;
    }
  }
  if (!matched) return { skipped: true, reason: 'no matching keyword' };

  let productId = matched.product_id;
  if (!productId) {
    const linkQ = await serverPool.query(
      `SELECT product_id FROM public.post_product_links WHERE instagram_post_id = $1 LIMIT 2`,
      [post.id]
    );
    if (linkQ.rows.length === 1) productId = linkQ.rows[0].product_id;
  }
  if (!productId) {
    return { skipped: true, reason: 'automation has no product to sell' };
  }

  const productQ = await serverPool.query(
    `SELECT p.*, o.name AS store_name FROM public.products p
     JOIN public.organizations o ON o.id = p.organization_id
     WHERE p.id = $1`,
    [productId]
  );
  const product = productQ.rows[0];
  if (!product) return { skipped: true, reason: 'product missing' };

  const existing = await serverPool.query(
    `SELECT id FROM public.checkout_sessions WHERE comment_id = $1 LIMIT 1`,
    [commentId]
  );
  if (existing.rows.length > 0) return { skipped: true, reason: 'session already exists for comment' };

  const session = await serverPool.query(
    `INSERT INTO public.checkout_sessions (
      organization_id, social_account_id, automation_rule_id, instagram_post_id, product_id,
      instagram_user_id, instagram_username, comment_id, media_id, private_reply_sent, step
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,false,'private_reply_sent')
    RETURNING *`,
    [
      post.org_id,
      post.social_account_id,
      matched.id,
      post.id,
      productId,
      String(fromId),
      fromUsername || null,
      commentId,
      String(mediaId),
    ]
  );

  const defaults = await templateDefaults(post.org_id);
  const message = renderTemplate(
    matched.private_reply_message ||
      defaults.private_reply ||
      'Hi {{customer_name}}! Reply YES to buy {{product_name}} ({{product_price}}).',
    varsFrom({
      instagram_username: fromUsername,
      product_name: product.name,
      product_price: product.price,
      currency: product.currency,
      store_name: product.store_name,
    })
  );

  const sent = await sendPrivateReply(post.social_account_id, commentId, message);
  if (!sent.ok) {
    await serverPool.query(
      `UPDATE public.instagram_webhook_events SET error = $2 WHERE event_key = $1`,
      [`comment:${commentId}`, sent.error]
    );
    return { skipped: false, error: sent.error };
  }

  await serverPool.query(
    `UPDATE public.checkout_sessions
     SET private_reply_sent = true, step = 'awaiting_dm_reply', last_message_at = now(), updated_at = now()
     WHERE id = $1`,
    [session.rows[0].id]
  );
  await serverPool.query(
    `UPDATE public.instagram_webhook_events SET processed = true WHERE event_key = $1`,
    [`comment:${commentId}`]
  );

  return { skipped: false, sessionId: session.rows[0].id };
}

export async function handleDirectMessage(entryId: string, messaging: any) {
  const senderId = messaging?.sender?.id;
  const recipientId = messaging?.recipient?.id;
  const text = messaging?.message?.text || '';
  const mid = messaging?.message?.mid;
  if (!senderId || !text) return { skipped: true, reason: 'not a text DM' };

  const eventKey = mid ? `dm:${mid}` : `dm:${senderId}:${messaging.timestamp || Date.now()}`;
  const insert = await serverPool.query(
    `INSERT INTO public.instagram_webhook_events (event_key, event_type, payload, processed)
     VALUES ($1, 'message', $2::jsonb, false)
     ON CONFLICT (event_key) DO NOTHING
     RETURNING id`,
    [eventKey, JSON.stringify(messaging)]
  );
  if (insert.rows.length === 0) return { skipped: true, reason: 'duplicate message' };

  const accQ = await serverPool.query(
    `SELECT * FROM public.social_accounts
     WHERE platform = 'instagram' AND (external_account_id = $1 OR facebook_page_id = $1) AND is_demo = false
     LIMIT 1`,
    [String(entryId || recipientId)]
  );
  if (accQ.rows.length === 0) return { skipped: true, reason: 'unknown instagram account' };
  const account = accQ.rows[0];

  const sessionQ = await serverPool.query(
    `SELECT s.*, p.name AS product_name, p.price AS product_price, p.currency, o.name AS store_name,
            a.checkout_intro_message, a.product_details_message, a.variant_quantity_message,
            a.delivery_details_message, a.payment_instructions_message, ord.order_number
     FROM public.checkout_sessions s
     JOIN public.products p ON p.id = s.product_id
     JOIN public.organizations o ON o.id = s.organization_id
     LEFT JOIN public.automation_rules a ON a.id = s.automation_rule_id
     LEFT JOIN public.orders ord ON ord.id = s.order_id
     WHERE s.social_account_id = $1 AND s.instagram_user_id = $2
       AND s.step NOT IN ('paid', 'cancelled')
     ORDER BY s.created_at DESC
     LIMIT 1`,
    [account.id, String(senderId)]
  );

  if (sessionQ.rows.length === 0) {
    return { skipped: true, reason: 'no open checkout session' };
  }

  const session = sessionQ.rows[0];
  await serverPool.query(
    `UPDATE public.checkout_sessions
     SET messaging_window_expires_at = now() + interval '24 hours', last_message_at = now()
     WHERE id = $1`,
    [session.id]
  );

  const defaults = await templateDefaults(session.organization_id);
  const upper = text.trim().toUpperCase();

  const reply = async (content: string, nextStep?: string, extra: Record<string, unknown> = {}) => {
    await sendInstagramText(session.social_account_id, String(senderId), content);
    if (nextStep) {
      const keys = Object.keys(extra);
      if (keys.length > 0) {
        const sets = keys.map((k, i) => `${k} = $${i + 3}`).join(', ');
        await serverPool.query(
          `UPDATE public.checkout_sessions SET step = $2, ${sets}, updated_at = now() WHERE id = $1`,
          [session.id, nextStep, ...keys.map((k) => extra[k])]
        );
      } else {
        await serverPool.query(
          `UPDATE public.checkout_sessions SET step = $2, updated_at = now() WHERE id = $1`,
          [session.id, nextStep]
        );
      }
    }
  };

  if (session.step === 'awaiting_dm_reply' || session.step === 'private_reply_sent') {
    const intro = renderTemplate(
      session.checkout_intro_message || defaults.checkout_intro || 'Welcome to {{store_name}}!',
      varsFrom(session)
    );
    const details = renderTemplate(
      session.product_details_message ||
        defaults.product_details ||
        '{{product_name}} is {{product_price}}.',
      varsFrom(session)
    );
    const qty = renderTemplate(
      session.variant_quantity_message || defaults.variant_quantity || 'How many would you like?',
      varsFrom(session)
    );
    await reply(`${intro}\n\n${details}\n\n${qty}`, 'collecting_quantity');
    return { skipped: false };
  }

  if (session.step === 'collecting_quantity') {
    const qty = parseInt(text.replace(/[^\d]/g, ''), 10);
    if (!qty || qty < 1 || qty > 99) {
      await reply('Please reply with a quantity between 1 and 99.');
      return { skipped: false };
    }
    await reply('What name should we put on the order?', 'collecting_name', { quantity: qty });
    return { skipped: false };
  }

  if (session.step === 'collecting_name') {
    const name = text.trim().slice(0, 80);
    if (name.length < 2) {
      await reply('Please send your name.');
      return { skipped: false };
    }
    await reply(
      'Please send the M-Pesa phone number to charge (e.g. 07XXXXXXXX).',
      'collecting_phone',
      { customer_name: name }
    );
    return { skipped: false };
  }

  if (session.step === 'collecting_phone') {
    const phone = normalizeMsisdn(text);
    if (!/^2547\d{8}$/.test(phone) && !/^2541\d{8}$/.test(phone)) {
      await reply('That does not look like a Kenyan mobile number. Example: 0712345678');
      return { skipped: false };
    }
    const delivery = renderTemplate(
      session.delivery_details_message ||
        defaults.delivery_details ||
        'Reply DELIVERY plus your address, or PICKUP plus a location.',
      varsFrom({ ...session, customer_phone: phone })
    );
    await reply(delivery, 'collecting_delivery', { customer_phone: phone });
    return { skipped: false };
  }

  if (session.step === 'collecting_delivery') {
    const method = upper.startsWith('PICKUP') ? 'pickup' : 'delivery';
    const details = text.trim().slice(0, 240);
    const unit = Number(session.product_price);
    const qty = Number(session.quantity || 1);
    const total = unit * qty;
    const orderNumber = `CC-${Date.now().toString().slice(-8)}`;

    const order = await serverPool.query(
      `INSERT INTO public.orders (
        organization_id, checkout_session_id, product_id, order_number, customer_name, customer_phone,
        instagram_user_id, quantity, unit_price, total_amount, currency, delivery_method, delivery_details, status
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
      RETURNING *`,
      [
        session.organization_id,
        session.id,
        session.product_id,
        orderNumber,
        session.customer_name,
        session.customer_phone,
        session.instagram_user_id,
        qty,
        unit,
        total,
        session.currency || 'KES',
        method,
        details,
      ]
    );

    await serverPool.query(
      `UPDATE public.checkout_sessions
       SET delivery_method = $2, delivery_details = $3, order_id = $4, step = 'confirming_summary', updated_at = now()
       WHERE id = $1`,
      [session.id, method, details, order.rows[0].id]
    );

    await reply(
      `Order ${orderNumber}: ${qty} × ${session.product_name} = ${session.currency} ${total.toLocaleString()}. Reply PAY to receive the M-Pesa prompt.`
    );
    return { skipped: false };
  }

  if (session.step === 'confirming_summary' || session.step === 'failed' || session.step === 'awaiting_payment') {
    if (upper !== 'PAY' && upper !== 'YES') {
      await reply('Reply PAY to send the M-Pesa STK prompt, or CANCEL to stop.');
      if (upper === 'CANCEL') {
        await serverPool.query(
          `UPDATE public.checkout_sessions SET step = 'cancelled', updated_at = now() WHERE id = $1`,
          [session.id]
        );
      }
      return { skipped: false };
    }

    if (!mpesaConfigured()) {
      await reply(
        'M-Pesa is not configured on this CommCart server yet. The merchant must set Daraja credentials. Your order is saved as pending.'
      );
      return { skipped: false, error: 'mpesa_not_configured' };
    }

    const orderQ = await serverPool.query(`SELECT * FROM public.orders WHERE id = $1`, [session.order_id]);
    const order = orderQ.rows[0];
    if (!order) {
      await reply('We could not find your order. Please comment on the post again.');
      return { skipped: false };
    }

    try {
      await initiateStkPush({
        organizationId: session.organization_id,
        orderId: order.id,
        checkoutSessionId: session.id,
        amount: Number(order.total_amount),
        phone: session.customer_phone,
        accountRef: order.order_number,
        description: 'CommCart',
      });
      await serverPool.query(
        `UPDATE public.checkout_sessions SET step = 'awaiting_payment', updated_at = now() WHERE id = $1`,
        [session.id]
      );
      const payMsg = renderTemplate(
        session.payment_instructions_message ||
          defaults.payment_instructions ||
          'Enter your M-Pesa PIN to pay {{product_price}}.',
        varsFrom({ ...session, product_price: order.total_amount, currency: order.currency })
      );
      await reply(payMsg);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'STK Push failed';
      await reply(`Could not start M-Pesa: ${message}. Reply PAY to try again.`);
    }
    return { skipped: false };
  }

  await serverPool.query(
    `UPDATE public.instagram_webhook_events SET processed = true WHERE event_key = $1`,
    [eventKey]
  );
  return { skipped: false };
}

export async function processInstagramWebhook(body: any) {
  const results: unknown[] = [];
  if (!body?.entry) return results;

  for (const entry of body.entry) {
    const igId = String(entry.id || '');
    if (Array.isArray(entry.changes)) {
      for (const change of entry.changes) {
        if (change.field === 'comments' || change.field === 'live_comments') {
          results.push(await handleCommentEvent(change.value, igId));
        }
      }
    }
    if (Array.isArray(entry.messaging)) {
      for (const msg of entry.messaging) {
        if (msg.message?.is_echo) continue;
        results.push(await handleDirectMessage(igId, msg));
      }
    }
  }
  return results;
}
