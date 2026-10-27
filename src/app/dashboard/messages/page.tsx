/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase/client.ts';
import { useAuth } from '../../../context/AuthContext.tsx';
import DashboardNav from '../../../components/dashboard/DashboardNav.tsx';
import type { MessageTemplate, TemplateType } from '../../../types/database.types.ts';
import {
  MessageSquare,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  RotateCcw,
  Eye,
  Loader2,
  X,
  Info,
  Sparkles,
  Smartphone,
  ShieldCheck,
  Send,
  ArrowRight,
} from 'lucide-react';

const STAGE_METADATA: Record<
  TemplateType,
  { label: string; stageNumber: number; badgeColor: string; description: string; metaPolicy: string }
> = {
  private_reply: {
    stageNumber: 1,
    label: 'Private Reply (Comment Trigger)',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
    description: 'Initial DM sent immediately to the user who left an eligible comment on your post.',
    metaPolicy: 'Single reply allowed by Meta within 7 days of comment. Does not open a 24h window.',
  },
  checkout_intro: {
    stageNumber: 2,
    label: 'Checkout Introduction',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Welcomes the buyer and introduces the checkout experience.',
    metaPolicy: 'Sent after buyer responds to private reply or clicks the direct checkout conversation link.',
  },
  product_details: {
    stageNumber: 3,
    label: 'Product Details & Pricing',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Summarizes product title, price in KES, and stock or variant information.',
    metaPolicy: 'Sent in response to price/item inquiries within the 24h customer service window.',
  },
  payment_instructions: {
    stageNumber: 4,
    label: 'M-Pesa Payment Instructions',
    badgeColor: 'bg-amber-50 text-amber-700 border-amber-200',
    description: 'Explains how the buyer will complete the Lipa Na M-Pesa STK push prompt on their phone.',
    metaPolicy: 'Sent during checkout to prepare customer for the Safaricom PIN prompt.',
  },
  payment_confirmation: {
    stageNumber: 5,
    label: 'Payment Confirmation',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Triggered when the backend confirms valid M-Pesa transaction callback.',
    metaPolicy: 'Transactional confirmation. Permitted under standard customer care.',
  },
  payment_failed: {
    stageNumber: 6,
    label: 'Payment Failed or Pending',
    badgeColor: 'bg-red-50 text-red-700 border-red-200',
    description: 'Notifies customer of insufficient funds or timeout with a retry link.',
    metaPolicy: 'Transactional recovery notice with retry link.',
  },
  order_confirmation: {
    stageNumber: 7,
    label: 'Order Confirmation & Next Steps',
    badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Final receipt containing order number and delivery arrangement details.',
    metaPolicy: 'Post-purchase transactional receipt.',
  },
  custom: {
    stageNumber: 8,
    label: 'Custom Reusable Message',
    badgeColor: 'bg-slate-50 text-slate-700 border-slate-200',
    description: 'General reusable template for customized store responses.',
    metaPolicy: 'Must comply with Meta 24-hour customer messaging policies.',
  },
};

const AVAILABLE_VARIABLES = [
  { tag: '{{customer_name}}', desc: 'Instagram commenter / buyer name' },
  { tag: '{{product_name}}', desc: 'Associated catalog product title' },
  { tag: '{{product_price}}', desc: 'Formatted product price (e.g. KES 3,500)' },
  { tag: '{{store_name}}', desc: 'Merchant workspace name' },
  { tag: '{{checkout_link}}', desc: 'Direct checkout URL link' },
  { tag: '{{order_number}}', desc: 'Unique order reference identifier' },
];

export default function MessagesPage() {
  const { organization } = useAuth();

  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Form Fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<TemplateType>('private_reply');
  const [formContent, setFormContent] = useState('');

  // Delete modal state
  const [deletingTemplate, setDeletingTemplate] = useState<MessageTemplate | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Fetch templates for current organization
  const fetchTemplates = async () => {
    if (!organization) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('organization_id', organization.id)
        .order('is_default', { ascending: false })
        .order('template_type', { ascending: true });

      if (error) {
        console.error('Error fetching message templates:', error);
      } else if (data) {
        setTemplates(data as MessageTemplate[]);
      }
    } catch (err) {
      console.error('Failed to load message templates:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organization) {
      fetchTemplates();
    }
  }, [organization]);

  // Open Create Modal
  const openCreateModal = () => {
    setEditingTemplate(null);
    setFormName('');
    setFormType('private_reply');
    setFormContent(
      'Hi {{customer_name}}! Thanks for inquiring about {{product_name}} ({{product_price}}). Click here to complete your order: {{checkout_link}}'
    );
    setIsEditorOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (tpl: MessageTemplate) => {
    setEditingTemplate(tpl);
    setFormName(tpl.name);
    setFormType(tpl.template_type);
    setFormContent(tpl.content);
    setIsEditorOpen(true);
  };

  // Insert variable tag into cursor position
  const handleInsertVariable = (tag: string) => {
    setFormContent((prev) => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + tag + ' ');
  };

  // Save template handler
  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    if (!formName.trim()) {
      alert('Template name is required.');
      return;
    }

    if (!formContent.trim()) {
      alert('Template content cannot be empty.');
      return;
    }

    setSavingTemplate(true);
    setFeedback(null);

    try {
      if (editingTemplate) {
        const { data, error } = await (supabase.from('message_templates') as any)
          .update({
            name: formName.trim(),
            template_type: formType,
            content: formContent.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingTemplate.id)
          .select()
          .single();

        if (error) throw error;
        setTemplates((prev) =>
          prev.map((t) => (t.id === editingTemplate.id ? (data as MessageTemplate) : t))
        );
        setFeedback({ type: 'success', message: `Template "${formName}" updated successfully.` });
      } else {
        const { data, error } = await (supabase.from('message_templates') as any)
          .insert({
            organization_id: organization.id,
            name: formName.trim(),
            template_type: formType,
            content: formContent.trim(),
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;
        setTemplates((prev) => [data as MessageTemplate, ...prev]);
        setFeedback({ type: 'success', message: `Template "${formName}" created successfully!` });
      }

      setIsEditorOpen(false);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setSavingTemplate(false);
    }
  };

  // Delete template handler
  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    setDeletingLoading(true);

    try {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', deletingTemplate.id);

      if (error) throw error;
      setTemplates((prev) => prev.filter((t) => t.id !== deletingTemplate.id));
      setFeedback({ type: 'success', message: `Template "${deletingTemplate.name}" deleted.` });
      setDeletingTemplate(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete template');
    } finally {
      setDeletingLoading(false);
    }
  };

  // Reset template to default text
  const handleResetToDefault = (type: TemplateType) => {
    switch (type) {
      case 'private_reply':
        setFormContent(
          'Hi {{customer_name}}! Thanks for inquiring about {{product_name}} ({{product_price}}). Here is your secure checkout link: {{checkout_link}}'
        );
        break;
      case 'checkout_intro':
        setFormContent(
          'Welcome to {{store_name}}! We are delighted to assist you with {{product_name}}.'
        );
        break;
      case 'product_details':
        setFormContent(
          '{{product_name}} is currently in stock for {{product_price}}. Instant delivery arrangement available upon order.'
        );
        break;
      case 'payment_instructions':
        setFormContent(
          'We support Lipa Na M-Pesa Online! Simply enter your M-Pesa mobile number and you will receive an STK prompt on your phone to complete your payment of {{product_price}}.'
        );
        break;
      case 'payment_confirmation':
        setFormContent(
          'Payment Received! We have confirmed your payment of {{product_price}} via M-Pesa. Thank you!'
        );
        break;
      case 'payment_failed':
        setFormContent(
          'Your payment for {{product_name}} was not completed. Please verify your phone number and M-Pesa PIN, then tap here to try again: {{checkout_link}}'
        );
        break;
      case 'order_confirmation':
        setFormContent(
          'Order #{{order_number}} is confirmed! Our team is preparing {{product_name}} for delivery. You will receive updates as soon as it ships.'
        );
        break;
      default:
        break;
    }
  };

  // Preview simulator with sample real-world values
  const simulatedPreview = useMemo(() => {
    return formContent
      .replace(/{{customer_name}}/g, 'Jane Doe')
      .replace(/{{product_name}}/g, 'Nairobi Silk Maxi Dress')
      .replace(/{{product_price}}/g, 'KES 3,500')
      .replace(/{{store_name}}/g, organization?.name || 'CommCart Store')
      .replace(/{{checkout_link}}/g, `https://commcart.co/store/${organization?.slug || 'shop'}/pay/demo`)
      .replace(/{{order_number}}/g, 'ORD-98421');
  }, [formContent, organization]);

  // Filtered Templates
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      const matchesSearch =
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.content.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesType = typeFilter === 'all' ? true : t.template_type === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [templates, searchQuery, typeFilter]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 animate-fadeIn">
      {/* Top Bar & Dashboard Tabs */}
      <DashboardNav activeTab="messages" messagesCount={templates.length} />

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm flex items-start gap-3 animate-fadeIn ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedback.message}</div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Messaging Policy Info Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs mb-8">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shrink-0">
                <MessageSquare className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Instagram Automated Message Sequences
                </h2>
                <p className="mt-1 text-xs text-slate-600 max-w-2xl leading-relaxed">
                  Configure reusable message templates for each stage of the social commerce customer journey.
                  Templates automatically substitute live product details, customer names, and M-Pesa instructions.
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 font-medium text-purple-700 border border-purple-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                    Stage 1: Comment Private Reply (7-Day window / 1 reply limit)
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700 border border-blue-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                    Stages 2-7: Conversational Checkout & M-Pesa (24-Hour window)
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={openCreateModal}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>New Message Template</span>
            </button>
          </div>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs mb-6 flex flex-col md:flex-row gap-4 justify-between items-stretch md:items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates or message text..."
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

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 focus:border-emerald-600 focus:outline-none"
            >
              <option value="all">All Message Stages ({templates.length})</option>
              <option value="private_reply">Stage 1: Private Reply</option>
              <option value="checkout_intro">Stage 2: Checkout Intro</option>
              <option value="product_details">Stage 3: Product Details</option>
              <option value="payment_instructions">Stage 4: M-Pesa Instructions</option>
              <option value="payment_confirmation">Stage 5: Payment Confirmed</option>
              <option value="payment_failed">Stage 6: Payment Failed</option>
              <option value="order_confirmation">Stage 7: Order Confirmed</option>
              <option value="custom">Custom Templates</option>
            </select>
          </div>
        </div>

        {/* Template List */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm text-slate-600">Loading message templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs max-w-md mx-auto my-6">
            <MessageSquare className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-950">No templates found</h3>
            <p className="mt-1 text-sm text-slate-500">
              No message templates matched your search filters.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
              className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Reset filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filteredTemplates.map((template) => {
              const meta = STAGE_METADATA[template.template_type] || STAGE_METADATA.custom;

              return (
                <div
                  key={template.id}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-100">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${meta.badgeColor}`}
                        >
                          Stage {meta.stageNumber}: {meta.label}
                        </span>
                        {template.is_default && (
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 text-sm font-bold text-slate-950 truncate">
                        {template.name}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEditModal(template)}
                        title="Edit template"
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                      {!template.is_default && (
                        <button
                          onClick={() => setDeletingTemplate(template)}
                          title="Delete template"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Template Raw Text */}
                  <div className="mt-3 flex-1">
                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100 whitespace-pre-wrap leading-relaxed font-sans">
                      {template.content}
                    </p>
                  </div>

                  {/* Stage Policy Context */}
                  <div className="mt-3 text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2.5">
                    <span className="truncate max-w-[280px]">{meta.metaPolicy}</span>
                    <button
                      onClick={() => openEditModal(template)}
                      className="text-emerald-700 hover:text-emerald-800 font-semibold text-xs flex items-center gap-1"
                    >
                      <Eye className="h-3 w-3" />
                      <span>Preview</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Editor Modal with Live Instagram Preview */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">
                    {editingTemplate ? 'Edit Message Template' : 'Create Message Template'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Configure automated copy and insert dynamic variables
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="mt-5 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Template Name
                  </label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Friendly Price Inquiry Reply"
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Conversation Stage
                  </label>
                  <select
                    value={formType}
                    onChange={(e) => {
                      const nextType = e.target.value as TemplateType;
                      setFormType(nextType);
                    }}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="private_reply">Stage 1: Comment Private Reply</option>
                    <option value="checkout_intro">Stage 2: Checkout Introduction</option>
                    <option value="product_details">Stage 3: Product Details & Price</option>
                    <option value="payment_instructions">Stage 4: M-Pesa Instructions</option>
                    <option value="payment_confirmation">Stage 5: Payment Confirmation</option>
                    <option value="payment_failed">Stage 6: Payment Failed / Retry</option>
                    <option value="order_confirmation">Stage 7: Order Confirmation</option>
                    <option value="custom">Custom Reusable Message</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Variables Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-1">
                    <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                    <span>Insert Dynamic Variables</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleResetToDefault(formType)}
                    className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset to Recommended Default</span>
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200">
                  {AVAILABLE_VARIABLES.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => handleInsertVariable(v.tag)}
                      title={v.desc}
                      className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-1 text-xs font-mono font-semibold text-slate-700 border border-slate-200 hover:border-emerald-600 hover:text-emerald-700 transition-colors shadow-2xs"
                    >
                      <span>{v.tag}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message Content Textarea */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Message Content
                </label>
                <textarea
                  required
                  rows={4}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Write your message..."
                  className="mt-1.5 block w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 leading-relaxed font-sans"
                />
              </div>

              {/* Live Simulated Instagram DM Preview */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5 text-slate-500" />
                  <span>Customer DM Preview (Simulated Rendering)</span>
                </label>
                <div className="rounded-xl border border-slate-200 bg-slate-900 p-4 text-white">
                  <div className="flex items-center gap-2 pb-2.5 border-b border-slate-800 text-[11px] text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span>Instagram Direct Message · @{organization?.name || 'YourStore'}</span>
                  </div>
                  <div className="mt-3 flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-xs bg-slate-800 px-4 py-2.5 text-xs text-slate-100 shadow-sm whitespace-pre-wrap leading-relaxed border border-slate-700">
                      {simulatedPreview || 'Type message content to preview...'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Meta Policy Notice */}
              <div className="rounded-xl bg-blue-50 p-3 text-[11px] text-blue-900 border border-blue-200 flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  <strong>Meta Policy Note:</strong> {STAGE_METADATA[formType]?.metaPolicy || 'Follow official Meta messaging guidelines.'}
                </p>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTemplate}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingTemplate && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingTemplate ? 'Update Template' : 'Save Template'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-4">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-950 text-base">Delete Message Template</h3>
            <p className="mt-1 text-xs text-slate-600">
              Are you sure you want to delete template &quot;{deletingTemplate.name}&quot;?
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeletingTemplate(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTemplate}
                disabled={deletingLoading}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-red-700 disabled:opacity-60"
              >
                {deletingLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
