/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase/client.ts';
import { navigateTo } from '../../../lib/navigation.ts';
import { useAuth } from '../../../context/AuthContext.tsx';
import DashboardNav from '../../../components/dashboard/DashboardNav.tsx';
import type { Product, ProductStatus } from '../../../types/database.types.ts';
import {
  Package,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertCircle,
  Archive,
  RotateCcw,
  Edit3,
  ExternalLink,
  Eye,
  Loader2,
  Building2,
  ArrowLeft,
  LogOut,
  Tag,
  ImageIcon,
  X,
} from 'lucide-react';

export default function ProductsPage() {
  const { user, organization, membership, signOut } = useAuth();
  const memberRole = membership?.role;
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Fetch products for current organization
  const fetchProducts = async () => {
    if (!organization) return;
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching products:', error);
        setFeedbackMsg({ type: 'error', text: 'Could not load products: ' + error.message });
      } else if (data) {
        setProducts(data as Product[]);
      }
    } catch (err: unknown) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organization) {
      fetchProducts();
    }
  }, [organization]);

  // Toggle between active and archived
  const handleToggleStatus = async (product: Product) => {
    const nextStatus: ProductStatus = product.status === 'active' ? 'archived' : 'active';
    setActionLoadingId(product.id);
    setFeedbackMsg(null);

    try {
      const { data, error } = await (supabase.from('products') as any)
        .update({
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', product.id)
        .select()
        .single();

      if (error) {
        setFeedbackMsg({ type: 'error', text: 'Failed to update product status: ' + error.message });
      } else {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? (data as Product) : p))
        );
        const actionLabel = nextStatus === 'archived' ? 'archived' : 'reactivated';
        setFeedbackMsg({
          type: 'success',
          text: `"${product.name}" has been ${actionLabel}.`,
        });
        setTimeout(() => setFeedbackMsg(null), 4000);
      }
    } catch (err: unknown) {
      setFeedbackMsg({ type: 'error', text: 'An unexpected error occurred while updating status.' });
    } finally {
      setActionLoadingId(null);
    }
  };

  // Filter and search computation
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all' ? true : p.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [products, searchQuery, statusFilter]);

  const activeCount = products.filter((p) => p.status === 'active').length;
  const archivedCount = products.filter((p) => p.status === 'archived').length;

  const formatPrice = (amount: number, curr = 'KES') => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: curr,
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 animate-fadeIn">
      {/* Top Bar & Dashboard Tabs */}
      <DashboardNav
        activeTab="products"
        productCount={products.length}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">

        {/* Feedback Alert */}
        {feedbackMsg && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm flex items-start gap-3 animate-fadeIn ${
              feedbackMsg.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {feedbackMsg.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedbackMsg.text}</div>
            <button
              onClick={() => setFeedbackMsg(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Product Catalog
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage items available for automated Instagram direct message sales and M-Pesa checkout.
            </p>
          </div>

          <a
            href="/dashboard/products/new"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </a>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name, SKU, or keyword..."
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 text-sm placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active ({activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'archived'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Archived ({archivedCount})
            </button>
          </div>
        </div>

        {/* Product Listing */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm text-slate-600">Loading catalog...</p>
          </div>
        ) : products.length === 0 ? (
          /* Empty State: Zero Products */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm max-w-xl mx-auto my-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Package className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-900">No products in your catalog yet</h3>
            <p className="mt-2 text-sm text-slate-600">
              Add products with precise pricing and SKUs. When customers inquire in your Instagram DMs, CommCart generates instant M-Pesa checkout links for these items.
            </p>
            <div className="mt-6">
              <a
                href="/dashboard/products/new"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Your First Product</span>
              </a>
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          /* Empty State: No Matches */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm max-w-md mx-auto my-6">
            <Search className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-900">No matching products</h3>
            <p className="mt-1 text-sm text-slate-500">
              No items matched &quot;{searchQuery}&quot; with status &quot;{statusFilter}&quot;.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Product Table / Cards */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Product</th>
                    <th scope="col" className="px-6 py-3.5">SKU</th>
                    <th scope="col" className="px-6 py-3.5">Price</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((product) => {
                    const isActionLoading = actionLoadingId === product.id;
                    return (
                      <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                              {product.image_url ? (
                                <img
                                  src={product.image_url}
                                  alt={product.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    // Fallback to placeholder icon if image fails to load
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <ImageIcon className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <button
                                onClick={() => setSelectedProduct(product)}
                                className="font-semibold text-slate-900 hover:text-emerald-700 text-left truncate block max-w-xs transition-colors"
                              >
                                {product.name}
                              </button>
                              {product.description && (
                                <p className="text-xs text-slate-500 truncate max-w-sm mt-0.5">
                                  {product.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4 font-mono text-xs">
                          {product.sku ? (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                              <Tag className="h-3 w-3 text-slate-400" />
                              {product.sku}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">No SKU</span>
                          )}
                        </td>

                        <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                          {formatPrice(product.price, product.currency)}
                        </td>

                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              product.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                product.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'
                              }`}
                            />
                            <span className="capitalize">{product.status}</span>
                          </span>
                        </td>

                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-2">
                            {/* View Details */}
                            <button
                              onClick={() => setSelectedProduct(product)}
                              title="View details"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {/* Edit Product */}
                            <a
                              href={`/dashboard/products/edit?id=${product.id}`}
                              title="Edit product"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </a>

                            {/* Archive / Reactivate */}
                            <button
                              onClick={() => handleToggleStatus(product)}
                              disabled={isActionLoading}
                              title={product.status === 'active' ? 'Archive product' : 'Reactivate product'}
                              className={`rounded-lg p-1.5 transition-colors ${
                                product.status === 'active'
                                  ? 'text-slate-500 hover:bg-amber-50 hover:text-amber-700'
                                  : 'text-emerald-600 hover:bg-emerald-50 hover:text-emerald-800'
                              }`}
                            >
                              {isActionLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : product.status === 'active' ? (
                                <Archive className="h-4 w-4" />
                              ) : (
                                <RotateCcw className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Product Details Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold">
                  <Package className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">{selectedProduct.name}</h3>
                  <p className="text-xs text-slate-500 font-mono">ID: {selectedProduct.id}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="py-4 space-y-4">
              {selectedProduct.image_url && (
                <div className="h-48 w-full rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                  <img
                    src={selectedProduct.image_url}
                    alt={selectedProduct.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block uppercase font-semibold">Unit Price</span>
                  <span className="text-base font-bold text-slate-950 mt-1 block">
                    {formatPrice(selectedProduct.price, selectedProduct.currency)}
                  </span>
                </div>
                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="text-slate-500 block uppercase font-semibold">Status</span>
                  <span
                    className={`inline-block mt-1 capitalize font-semibold ${
                      selectedProduct.status === 'active' ? 'text-emerald-700' : 'text-slate-600'
                    }`}
                  >
                    {selectedProduct.status}
                  </span>
                </div>
              </div>

              {selectedProduct.sku && (
                <div className="text-xs">
                  <span className="font-semibold text-slate-700">SKU / Barcode:</span>{' '}
                  <span className="font-mono text-slate-900 bg-slate-100 px-2 py-0.5 rounded ml-1">
                    {selectedProduct.sku}
                  </span>
                </div>
              )}

              {selectedProduct.description ? (
                <div className="text-xs">
                  <span className="font-semibold text-slate-700 block mb-1">Description:</span>
                  <p className="text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100 whitespace-pre-wrap leading-relaxed">
                    {selectedProduct.description}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No description provided.</p>
              )}

              <div className="text-[11px] text-slate-400 border-t border-slate-100 pt-3 flex justify-between">
                <span>Created {new Date(selectedProduct.created_at).toLocaleDateString()}</span>
                <span>Last updated {new Date(selectedProduct.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <a
                href={`/dashboard/products/edit?id=${selectedProduct.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit Product</span>
              </a>
              <button
                onClick={() => setSelectedProduct(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
