/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { supabase } from '../../../../lib/supabase/client.ts';
import { navigateTo } from '../../../../lib/navigation.ts';
import { useAuth } from '../../../../context/AuthContext.tsx';
import { productSchema, type ProductFormValues } from '../../../../lib/validations/product.ts';
import { ZodError } from 'zod';
import {
  ArrowLeft,
  Package,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Sparkles,
} from 'lucide-react';

const SAMPLE_IMAGES = [
  { label: 'Sneakers', url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80' },
  { label: 'Coffee Beans', url: 'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=600&auto=format&fit=crop&q=80' },
  { label: 'Streetwear Tee', url: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80' },
  { label: 'Leather Bag', url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80' },
];

export default function NewProductPage() {
  const { user, organization } = useAuth();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<'active' | 'archived'>('active');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currency = organization?.default_currency || 'KES';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setErrorMessage(null);

    if (!organization) {
      setErrorMessage('No active organization workspace found.');
      return;
    }

    // Parse and validate with Zod
    const parsedPrice = parseFloat(priceStr);
    const rawValues = {
      name,
      description: description || undefined,
      price: isNaN(parsedPrice) ? -1 : parsedPrice,
      currency,
      sku: sku || undefined,
      image_url: imageUrl || undefined,
      status,
    };

    const result = productSchema.safeParse(rawValues);

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        organization_id: organization.id,
        name: result.data.name,
        description: result.data.description || null,
        price: result.data.price,
        currency: result.data.currency,
        sku: result.data.sku || null,
        image_url: result.data.image_url || null,
        status: result.data.status,
      };

      const { data, error } = await (supabase.from('products') as any)
        .insert(payload)
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message);
        setSubmitting(false);
        return;
      }

      console.log('Product created successfully:', data);
      navigateTo('/dashboard/products');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to create product.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8 animate-fadeIn">
      <div className="mx-auto max-w-3xl">
        {/* Breadcrumb Back */}
        <div className="mb-6 flex items-center justify-between">
          <a
            href="/dashboard/products"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-950 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Products</span>
          </a>
          {organization && (
            <span className="text-xs text-slate-500 font-medium">
              Adding to <strong className="text-slate-800">{organization.name}</strong>
            </span>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Add New Product</h1>
              <p className="text-xs text-slate-500">
                Create an inventory item for Instagram DM direct checkout.
              </p>
            </div>
          </div>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {/* Name */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Product Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Classic White Sneakers"
                className={`mt-1.5 block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 ${
                  fieldErrors.name
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600'
                }`}
              />
              {fieldErrors.name && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
              )}
            </div>

            {/* Price & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Price ({currency}) <span className="text-red-500">*</span>
                </label>
                <div className="mt-1.5 relative rounded-lg shadow-sm">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-slate-500">
                    {currency}
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={priceStr}
                    onChange={(e) => setPriceStr(e.target.value)}
                    placeholder="2500.00"
                    className={`block w-full pl-14 rounded-lg border px-3.5 py-2.5 text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 ${
                      fieldErrors.price
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600'
                    }`}
                  />
                </div>
                {fieldErrors.price && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.price}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-400">
                  Exact monetary amount billed during M-Pesa STK push.
                </p>
              </div>

              {/* SKU */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  SKU / Barcode <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. SNK-WHT-42"
                  className={`mt-1.5 block w-full font-mono rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 ${
                    fieldErrors.sku
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600'
                  }`}
                />
                {fieldErrors.sku && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.sku}</p>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Description <span className="text-slate-400 text-xs font-normal">(Optional)</span>
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Product specifications, available sizes, care instructions..."
                className={`mt-1.5 block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 ${
                  fieldErrors.description
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                    : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600'
                }`}
              />
              {fieldErrors.description && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
              )}
            </div>

            {/* Image URL & Live Preview */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Image URL <span className="text-slate-400 text-xs font-normal">(Optional)</span>
              </label>
              <div className="mt-1.5 flex gap-4 items-start">
                <div className="flex-1">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className={`block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-1 ${
                      fieldErrors.image_url
                        ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                        : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600'
                    }`}
                  />
                  {fieldErrors.image_url && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.image_url}</p>
                  )}

                  {/* Sample Image Presets */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-slate-500">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-slate-600">
                      <Sparkles className="h-3 w-3 text-emerald-600" /> Presets:
                    </span>
                    {SAMPLE_IMAGES.map((sample) => (
                      <button
                        key={sample.label}
                        type="button"
                        onClick={() => {
                          setImageUrl(sample.url);
                          if (!name) setName(sample.label);
                        }}
                        className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 transition-colors"
                      >
                        {sample.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Thumbnail Preview */}
                <div className="h-16 w-16 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-slate-400" />
                  )}
                </div>
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Initial Status
              </label>
              <div className="mt-1.5 flex gap-4">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="active"
                    checked={status === 'active'}
                    onChange={() => setStatus('active')}
                    className="text-emerald-600 focus:ring-emerald-600"
                  />
                  <span>Active (available for purchase)</span>
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="status"
                    value="archived"
                    checked={status === 'archived'}
                    onChange={() => setStatus('archived')}
                    className="text-emerald-600 focus:ring-emerald-600"
                  />
                  <span>Archived (hidden draft)</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <a
                href="/dashboard/products"
                className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
              >
                Cancel
              </a>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors disabled:opacity-60"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving Product...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Save Product</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
