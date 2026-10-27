/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Meta / Instagram Webhook Event Structure
 */
export interface InstagramWebhookEvent {
  object: 'instagram';
  entry: Array<{
    id: string; // Instagram business account ID
    time: number;
    messaging: Array<{
      sender: {
        id: string; // Customer Instagram-scoped ID (IGSID)
      };
      recipient: {
        id: string; // Page ID
      };
      timestamp: number;
      message?: {
        mid: string;
        text?: string;
        quick_reply?: {
          payload: string;
        };
        attachments?: Array<{
          type: 'image' | 'video' | 'audio' | 'file' | 'fallback' | 'share';
          payload: {
            url?: string;
          };
        }>;
      };
      postback?: {
        mid: string;
        title: string;
        payload: string;
      };
    }>;
  }>;
}

/**
 * CommCart Checkout Link Intent generated for Instagram DM responses
 */
export interface InstagramCheckoutSession {
  sessionId: string;
  merchantId: string;
  instagramUserId: string;
  productId: string;
  quantity: number;
  totalAmount: number;
  currency: string;
  expiresAt: string;
}
