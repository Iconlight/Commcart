/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { supabase } from '../../../../lib/supabase/client.ts';
import { navigateTo } from '../../../../lib/navigation.ts';
import { useAuth } from '../../../../context/AuthContext.tsx';
import type { Product, ProductStatus } from '../../../../types/database.types.ts';
import { productSchema } from '../../../../lib/validations/product.ts';
import {
  ArrowLeft,
  Package,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ImageIcon,
  Archive,
  RotateCcw,
} from 'lucide-react';

export default function EditProductPage() {
  const { user, organization } = useAuth();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Form inputs
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [sku, setSku] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<ProductStatus>('active');

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Extract ID from window.location.search (?id=...)
  useEffect(() => {
    async function loadProduct() {
      if (!organization) return;
      const params = new URLSearchParams(window.location.search);
      const productId = params.get('id');

      if (!productId) {
        setErrorMessage('No product ID was provided.');
        setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .eq('organization_id', organization.id)
          .maybeSingle();

        if (error || !data) {
          setErrorMessage('Product not found or you do not have permission to edit it.');
        } else {
          const p = data as Product;
          setProduct(p);
          setName(p.name);
          setDescription(p.description || '');
          setPriceStr(p.price.toString());
          setSku(p.sku || '');
          setImageUrl(p.image_url || '');
          setStatus(p.status);
        }
      } catch (err: unknown) {
        setErrorMessage('Failed to load product details.');
      } finally {
        setLoading(false);
      }
    }

    loadProduct();
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product || !organization) return;

    setFieldErrors({});
    setErrorMessage(null);
    setSuccessMessage(null);

    const parsedPrice = parseFloat(priceStr);
    const rawValues = {
      name,
      description: description || undefined,
      price: isNaN(parsedPrice) ? -1 : parsedPrice,
      currency: product.currency || organization.default_currency || 'KES',
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

    setSaving(true);

    try {
      const payload = {
        name: result.data.name,
        description: result.data.description || null,
        price: result.data.price,
        sku: result.data.sku || null,
        image_url: result.data.image_url || null,
        status: result.data.status,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase.from('products') as any)
        .update(payload)
        .eq('id', product.id)
        .eq('organization_id', organization.id)
        .select()
        .single();

      if (error) {
        setErrorMessage(error.message);
      } else {
        setProduct(data as Product);
        setSuccessMessage('Product updated successfully!');
        setTimeout(() => {
          navigateTo('/dashboard/products');
        }, 1200);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!product || !organization) return;
    const nextStatus: ProductStatus = product.status === 'active' ? 'archived' : 'active';
    setTogglingStatus(true);
    setErrorMessage(null);

    try {
      const { data, error } = await (supabase.from('products') as any)
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .eq('organization_id', organization.id)
        .select()
        .single();

      if (error) {
        setErrorMessage('Failed to update status: ' + error.message);
      } else {
        const updated = data as Product;
        setProduct(updated);
        setStatus(updated.status);
        setSuccessMessage(
          `Product successfully ${nextStatus === 'archived' ? 'archived' : 'reactivated'}!`
        );
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: unknown) {
      setErrorMessage('Could not update status.');
    } finally {
      setTogglingStatus(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
          <p className="mt-3 text-sm text-slate-600">Loading product details...</p>
        </div>
      </div>
    );
  }

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
          {product && (
            <span className="text-xs text-slate-500 font-mono">
              SKU: {product.sku || 'N/A'}
            </span>
          )}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-10 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-slate-900">Edit Product</h1>
                <p className="text-xs text-slate-500">
                  Update product details, pricing, and active status.
                </p>
              </div>
            </div>

            {product && (
              <button
                type="button"
                onClick={handleToggleStatus}
                disabled={togglingStatus}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  product.status === 'active'
                    ? 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                }`}
              >
                {togglingStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : product.status === 'active' ? (
                  <>
                    <Archive className="h-3.5 w-3.5" />
                    <span>Archive Product</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reactivate Product</span>
                  </>
                )}
              </button>
            )}
          </div>

          {errorMessage && (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          {successMessage && (
            <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
              <div>{successMessage}</div>
            </div>
          )}

          {product && (
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
                  className={`mt-1.5 block w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-1 ${
                    fieldErrors.name
                      ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                      : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600'
                  }`}
                />
                {fieldErrors.name && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
                )}
              </div>

              {/* Price & SKU */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Price ({product.currency}) <span className="text-red-500">*</span>
                  </label>
                  <div className="mt-1.5 relative rounded-lg shadow-sm">
                    <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs font-bold text-slate-500">
                      {product.currency}
                    </span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={priceStr}
                      onChange={(e) => setPriceStr(e.target.value)}
                      className={`block w-full pl-14 rounded-lg border px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-1 ${
                        fieldErrors.price
                          ? 'border-red-300 focus:border-red-500 focus:ring-red-500'
                          : 'border-slate-300 focus:border-emerald-600 focus:ring-emerald-600'
                      }`}
                    />
                  </div>
                  {fieldErrors.price && (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.price}</p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    SKU / Barcode <span className="text-slate-400 text-xs font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="mt-1.5 block w-full font-mono rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
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
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
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
                      placeholder="https://..."
                      className="block w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    />
                    {fieldErrors.image_url && (
                      <p className="mt-1 text-xs text-red-600">{fieldErrors.image_url}</p>
                    )}
                  </div>
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

              {/* Status Radio Buttons */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Status
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
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <div className="text-xs text-slate-400">
                  Created {new Date(product.created_at).toLocaleDateString()}
                </div>
                <div className="flex items-center gap-3">
                  <a
                    href="/dashboard/products"
                    className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </a>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors disabled:opacity-60"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Updating...</span>
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        <span>Save Changes</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
