/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: { id: string; full_name?: string | null; created_at?: string; updated_at?: string };
        Update: { id?: string; full_name?: string | null; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      organizations: {
        Row: Organization;
        Insert: { id?: string; name: string; slug: string; owner_id: string; default_currency?: string; created_at?: string; updated_at?: string };
        Update: { id?: string; name?: string; slug?: string; owner_id?: string; default_currency?: string; created_at?: string; updated_at?: string };
        Relationships: [];
      };
      organization_members: {
        Row: OrganizationMember;
        Insert: { id?: string; organization_id: string; user_id: string; role?: 'owner' | 'admin' | 'staff'; created_at?: string };
        Update: { id?: string; organization_id?: string; user_id?: string; role?: 'owner' | 'admin' | 'staff'; created_at?: string };
        Relationships: [];
      };
      merchants: {
        Row: Merchant;
        Insert: Omit<Merchant, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Merchant, 'id'>>;
        Relationships: [];
      };
      products: {
        Row: Product;
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          description?: string | null;
          price: number;
          currency?: string;
          image_url?: string | null;
          sku?: string | null;
          status?: 'active' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          description?: string | null;
          price?: number;
          currency?: string;
          image_url?: string | null;
          sku?: string | null;
          status?: 'active' | 'archived';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Order, 'id'>>;
        Relationships: [];
      };
      mpesa_transactions: {
        Row: MpesaTransactionRecord;
        Insert: Omit<MpesaTransactionRecord, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<MpesaTransactionRecord, 'id'>>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_organization_with_owner: {
        Args: {
          org_name: string;
          org_slug: string;
          org_currency?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

export interface Profile {
  id: string;
  full_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

export type OrganizationRole = 'owner' | 'admin' | 'staff';

export interface OrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationRole;
  created_at: string;
}

export interface Merchant {
  id: string;
  business_name: string;
  instagram_username: string;
  instagram_page_id?: string;
  phone_number: string;
  currency: string;
  mpesa_paybill_or_till?: string;
  created_at: string;
  updated_at: string;
}

export type ProductStatus = 'active' | 'archived';

export interface Product {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  image_url: string | null;
  sku: string | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export type OrderStatus = 'pending' | 'awaiting_payment' | 'paid' | 'fulfilled' | 'cancelled';

export interface Order {
  id: string;
  merchant_id: string;
  customer_name?: string;
  customer_phone: string;
  instagram_user_id?: string;
  total_amount: number;
  currency: string;
  status: OrderStatus;
  items: Array<{
    product_id: string;
    title: string;
    price: number;
    quantity: number;
  }>;
  shipping_address?: string;
  created_at: string;
  updated_at: string;
}

export interface MpesaTransactionRecord {
  id: string;
  order_id: string;
  merchant_id: string;
  merchant_request_id: string;
  checkout_request_id: string;
  amount: number;
  phone_number: string;
  mpesa_receipt_number?: string;
  status: 'initiated' | 'completed' | 'failed' | 'cancelled';
  result_code?: number;
  result_desc?: string;
  transaction_date?: string;
  created_at: string;
  updated_at: string;
}
