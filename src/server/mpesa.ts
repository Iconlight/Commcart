/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response } from 'express';
import { serverPool } from './db.ts';
import { sendInstagramText } from './messaging.ts';
import { renderTemplate } from './meta.ts';

function darajaBase() {
  return process.env.MPESA_ENVIRONMENT === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
}

function timestampNow() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export function normalizeMsisdn(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('254') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 10) return '254' + digits.slice(1);
  if (digits.length === 9) return '254' + digits;
  return digits;
}

export function mpesaConfigured() {
  const key = process.env.MPESA_CONSUMER_KEY || '';
  const secret = process.env.MPESA_CONSUMER_SECRET || '';
  const shortcode = process.env.MPESA_SHORTCODE || '';
  const passkey = process.env.MPESA_PASSKEY || '';
  return Boolean(
    key &&
      !key.includes('your_') &&
      secret &&
      !secret.includes('your_') &&
      shortcode &&
      passkey &&
      !passkey.includes('your_')
  );
}

async function darajaToken() {
  const key = process.env.MPESA_CONSUMER_KEY || '';
  const secret = process.env.MPESA_CONSUMER_SECRET || '';
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.errorMessage || data.error_description || 'Daraja OAuth failed');
  }
  return data.access_token as string;
}

export async function initiateStkPush(params: {
  organizationId: string;
  orderId: string;
  checkoutSessionId: string;
  amount: number;
  phone: string;
  accountRef: string;
  description: string;
}) {
  if (!mpesaConfigured()) {
    throw new Error(
      'M-Pesa Daraja is not configured. Set MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET, MPESA_SHORTCODE, and MPESA_PASSKEY.'
    );
  }

  const shortcode = process.env.MPESA_SHORTCODE as string;
  const passkey = process.env.MPESA_PASSKEY as string;
  const timestamp = timestampNow();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  const phone = normalizeMsisdn(params.phone);
  const callbackUrl =
    process.env.MPESA_CALLBACK_URL || `${process.env.APP_URL || 'http://localhost:3000'}/api/webhooks/mpesa/callback`;

  const token = await darajaToken();
  const res = await fetch(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(params.amount),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: params.accountRef.slice(0, 12),
      TransactionDesc: params.description.slice(0, 13),
    }),
  });

  const data = await res.json();
  if (data.ResponseCode !== '0' && data.ResponseCode !== 0) {
    throw new Error(data.errorMessage || data.CustomerMessage || data.ResponseDescription || 'STK Push failed');
  }

  const inserted = await serverPool.query(
    `INSERT INTO public.mpesa_transactions (
      organization_id, order_id, checkout_session_id, merchant_request_id, checkout_request_id,
      amount, phone_number, status
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,'pending')
    RETURNING *`,
    [
      params.organizationId,
      params.orderId,
      params.checkoutSessionId,
      data.MerchantRequestID,
      data.CheckoutRequestID,
      params.amount,
      phone,
    ]
  );

  await serverPool.query(
    `UPDATE public.orders SET status = 'awaiting_payment', updated_at = now() WHERE id = $1`,
    [params.orderId]
  );

  return inserted.rows[0];
}

export async function handleMpesaCallback(req: Request, res: Response) {
  try {
    const callback = req.body?.Body?.stkCallback;
    if (!callback) {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const checkoutRequestId = callback.CheckoutRequestID;
    const resultCode = Number(callback.ResultCode);
    const resultDesc = callback.ResultDesc || '';

    const txq = await serverPool.query(
      `SELECT * FROM public.mpesa_transactions WHERE checkout_request_id = $1 LIMIT 1`,
      [checkoutRequestId]
    );
    if (txq.rows.length === 0) {
      console.warn('[M-Pesa] Unknown CheckoutRequestID', checkoutRequestId);
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const tx = txq.rows[0];
    if (tx.status === 'completed') {
      return res.status(200).json({ ResultCode: 0, ResultDesc: 'Already processed' });
    }

    let receipt: string | null = null;
    let phone: string | null = tx.phone_number;
    if (resultCode === 0 && callback.CallbackMetadata?.Item) {
      for (const item of callback.CallbackMetadata.Item) {
        if (item.Name === 'MpesaReceiptNumber') receipt = String(item.Value || '');
        if (item.Name === 'PhoneNumber') phone = String(item.Value || phone);
      }
    }

    const status = resultCode === 0 ? 'completed' : resultCode === 1032 ? 'cancelled' : 'failed';

    await serverPool.query(
      `UPDATE public.mpesa_transactions
       SET status = $2, result_code = $3, result_desc = $4, mpesa_receipt_number = $5, phone_number = COALESCE($6, phone_number), updated_at = now()
       WHERE id = $1`,
      [tx.id, status, resultCode, resultDesc, receipt, phone]
    );

    if (status === 'completed' && tx.order_id) {
      await serverPool.query(
        `UPDATE public.orders SET status = 'paid', updated_at = now() WHERE id = $1 AND status <> 'paid'`,
        [tx.order_id]
      );
      if (tx.checkout_session_id) {
        await serverPool.query(
          `UPDATE public.checkout_sessions SET step = 'paid', updated_at = now() WHERE id = $1`,
          [tx.checkout_session_id]
        );
        await sendPaymentOutcome(tx.checkout_session_id, true);
      }
    } else if (tx.checkout_session_id) {
      await serverPool.query(
        `UPDATE public.checkout_sessions SET step = 'failed', updated_at = now() WHERE id = $1`,
        [tx.checkout_session_id]
      );
      await sendPaymentOutcome(tx.checkout_session_id, false);
    }

    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('[M-Pesa callback error]', err);
    return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}

async function sendPaymentOutcome(sessionId: string, success: boolean) {
  const sessionQ = await serverPool.query(
    `SELECT s.*, o.order_number, o.total_amount, o.currency, p.name AS product_name, p.price AS product_price,
            org.name AS store_name, a.payment_confirmation_message, a.payment_failed_message, a.order_confirmation_message,
            sa.external_account_id
     FROM public.checkout_sessions s
     LEFT JOIN public.orders o ON o.id = s.order_id
     LEFT JOIN public.products p ON p.id = s.product_id
     LEFT JOIN public.organizations org ON org.id = s.organization_id
     LEFT JOIN public.automation_rules a ON a.id = s.automation_rule_id
     LEFT JOIN public.social_accounts sa ON sa.id = s.social_account_id
     WHERE s.id = $1`,
    [sessionId]
  );
  const row = sessionQ.rows[0];
  if (!row) return;

  const vars = {
    customer_name: row.customer_name || row.instagram_username || 'there',
    product_name: row.product_name,
    product_price: `${row.currency || 'KES'} ${Number(row.total_amount || row.product_price || 0).toLocaleString()}`,
    order_number: row.order_number,
    store_name: row.store_name,
    quantity: row.quantity,
    customer_phone: row.customer_phone,
  };

  const tmplQ = await serverPool.query(
    `SELECT template_type, content FROM public.message_templates
     WHERE organization_id = $1 AND is_default = true`,
    [row.organization_id]
  );
  const defaults: Record<string, string> = {};
  for (const t of tmplQ.rows) defaults[t.template_type] = t.content;

  if (success) {
    const payMsg = renderTemplate(
      row.payment_confirmation_message || defaults.payment_confirmation || 'Payment received for {{order_number}}.',
      vars
    );
    const orderMsg = renderTemplate(
      row.order_confirmation_message || defaults.order_confirmation || 'Order {{order_number}} is confirmed.',
      vars
    );
    await sendInstagramText(row.social_account_id, row.instagram_user_id, payMsg);
    await sendInstagramText(row.social_account_id, row.instagram_user_id, orderMsg);
  } else {
    const failMsg = renderTemplate(
      row.payment_failed_message || defaults.payment_failed || 'Payment was not completed. Reply PAY to retry.',
      vars
    );
    await sendInstagramText(row.social_account_id, row.instagram_user_id, failMsg);
  }
}
