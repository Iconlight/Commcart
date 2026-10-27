/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Safaricom Daraja Lipa Na M-Pesa Online (STK Push) Request
 */
export interface MpesaStkPushRequest {
  BusinessShortCode: string;
  Password: string;
  Timestamp: string;
  TransactionType: 'CustomerPayBillOnline' | 'CustomerBuyGoodsOnline';
  Amount: number;
  PartyA: string; // Customer phone number (format: 2547XXXXXXXX)
  PartyB: string; // Business shortcode or till
  PhoneNumber: string; // Customer phone number (format: 2547XXXXXXXX)
  CallBackURL: string;
  AccountReference: string; // e.g. Order ID / Reference
  TransactionDesc: string; // e.g. "CommCart Checkout"
}

/**
 * Safaricom Daraja STK Push Initial Response
 */
export interface MpesaStkPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

/**
 * Safaricom Daraja STK Push Callback Payload
 */
export interface MpesaCallbackPayload {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: 'Amount' | 'MpesaReceiptNumber' | 'Balance' | 'TransactionDate' | 'PhoneNumber';
          Value?: string | number;
        }>;
      };
    };
  };
}
