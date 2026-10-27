/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase/client.ts';
import { useAuth } from '../../../context/AuthContext.tsx';
import DashboardNav from '../../../components/dashboard/DashboardNav.tsx';
import type {
  SocialAccount,
  InstagramPost,
  Product,
  PostProductLink,
  AutomationRule,
  MessageTemplate,
  MatchMode,
} from '../../../types/database.types.ts';
import {
  Zap,
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  Edit3,
  Trash2,
  ExternalLink,
  Instagram,
  Package,
  Video,
  Image as ImageIcon,
  Loader2,
  X,
  ArrowRight,
  MessageSquare,
  Smartphone,
  Eye,
  Sparkles,
  ShieldCheck,
  Check,
  Layers,
  Info,
} from 'lucide-react';

const SUGGESTED_KEYWORDS = ['BUY', 'ORDER', 'PRICE', 'HOW MUCH', 'CHECKOUT', 'SIZE'];

const VARIABLE_TAGS = [
  { tag: '{{customer_name}}', desc: 'Commenter / Buyer name' },
  { tag: '{{product_name}}', desc: 'Catalog product title' },
  { tag: '{{product_price}}', desc: 'Formatted product price' },
  { tag: '{{checkout_link}}', desc: 'Direct checkout link' },
  { tag: '{{store_name}}', desc: 'Store name' },
];

export default function AutomationsPage() {
  const { user, organization } = useAuth();

  // Data state
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [postLinks, setPostLinks] = useState<PostProductLink[]>([]);
  const [socialAccount, setSocialAccount] = useState<SocialAccount | null>(null);
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);

  // Page state
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Editor Modal State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [savingRule, setSavingRule] = useState(false);

  // Form fields (7-Step Wizard)
  const [ruleName, setRuleName] = useState('');
  const [selectedPostId, setSelectedPostId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('all_linked');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [matchMode, setMatchMode] = useState<MatchMode>('exact');
  const [privateReplyMessage, setPrivateReplyMessage] = useState('');
  const [isEnabled, setIsEnabled] = useState(true);
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);

  // Follow-up sequence preview expansion
  const [showFollowUpSequence, setShowFollowUpSequence] = useState(false);

  // Message Preview Modal state for table rows
  const [previewingRule, setPreviewingRule] = useState<AutomationRule | null>(null);

  // Delete modal state
  const [deletingRule, setDeletingRule] = useState<AutomationRule | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Loading sample post state
  const [loadingSamplePost, setLoadingSamplePost] = useState(false);

  // Load all initial data
  const loadData = async () => {
    if (!organization) return;
    try {
      setLoading(true);

      // 1. Fetch Social Account
      const { data: accData } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('platform', 'instagram')
        .maybeSingle();

      if (accData) setSocialAccount(accData as SocialAccount);

      // 2. Fetch Posts
      const { data: postsData } = await supabase
        .from('instagram_posts')
        .select('*')
        .eq('organization_id', organization.id)
        .order('published_at', { ascending: false });

      if (postsData) setPosts(postsData as InstagramPost[]);

      // 3. Fetch Products
      const { data: prodsData } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (prodsData) setProducts(prodsData as Product[]);

      // 4. Fetch Post Product Links
      const { data: linksData } = await supabase
        .from('post_product_links')
        .select('*')
        .eq('organization_id', organization.id);

      if (linksData) setPostLinks(linksData as PostProductLink[]);

      // 5. Fetch Message Templates
      const { data: tmplData } = await supabase
        .from('message_templates')
        .select('*')
        .eq('organization_id', organization.id);

      if (tmplData) setTemplates(tmplData as MessageTemplate[]);

      // 6. Fetch Automation Rules
      const { data: rulesData, error: rulesErr } = await supabase
        .from('automation_rules')
        .select('*')
        .eq('organization_id', organization.id)
        .order('created_at', { ascending: false });

      if (rulesErr) {
        console.error('Error fetching automation rules:', rulesErr);
      } else if (rulesData) {
        setRules(rulesData as AutomationRule[]);
      }
    } catch (err: unknown) {
      console.error('Failed to load automations data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organization) {
      loadData();
    }
  }, [organization]);

  // Handle URL query parameter `postId` for direct navigation from Posts page
  useEffect(() => {
    if (typeof window !== 'undefined' && posts.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const paramPostId = params.get('postId');
      if (paramPostId && posts.some((p) => p.id === paramPostId)) {
        openCreateModal(paramPostId);
      }
    }
  }, [posts]);

  // Default private reply message template
  const getDefaultPrivateReply = (): string => {
    const defaultTmpl = templates.find((t) => t.template_type === 'private_reply' && t.is_default);
    if (defaultTmpl && defaultTmpl.content) return defaultTmpl.content;
    return 'Hi {{customer_name}}! Thanks for inquiring about {{product_name}} ({{product_price}}). Here is your secure checkout link: {{checkout_link}}';
  };

  // Open Create Modal
  const openCreateModal = (preselectedPostId = '') => {
    setEditingRuleId(null);
    setRuleName('');
    const targetPostId = preselectedPostId || (posts.length > 0 ? posts[0].id : '');
    setSelectedPostId(targetPostId);
    setSelectedProductId('all_linked');
    setKeywords(['BUY', 'ORDER']);
    setKeywordInput('');
    setMatchMode('exact');
    setPrivateReplyMessage(getDefaultPrivateReply());
    setIsEnabled(true);
    setConflictWarning(null);
    setShowFollowUpSequence(false);
    setIsEditorOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (rule: AutomationRule) => {
    setEditingRuleId(rule.id);
    setRuleName(rule.name);
    setSelectedPostId(rule.instagram_post_id);
    setSelectedProductId(rule.product_id || 'all_linked');
    setKeywords(rule.keywords || []);
    setKeywordInput('');
    setMatchMode(rule.match_mode || 'exact');
    setPrivateReplyMessage(rule.private_reply_message || getDefaultPrivateReply());
    setIsEnabled(rule.is_enabled);
    setConflictWarning(null);
    setShowFollowUpSequence(false);
    setIsEditorOpen(true);
  };

  // Real-time Ambiguity Validation:
  // Detects if any entered keyword is already used on another enabled rule on the selected post
  useEffect(() => {
    if (!selectedPostId || !isEnabled || keywords.length === 0) {
      setConflictWarning(null);
      return;
    }

    const uppercaseKeywords = keywords.map((k) => k.trim().toUpperCase());

    const conflictingRule = rules.find((r) => {
      if (r.id === editingRuleId) return false;
      if (r.instagram_post_id !== selectedPostId) return false;
      if (!r.is_enabled) return false;

      const otherKws = (r.keywords || []).map((k) => k.trim().toUpperCase());
      return uppercaseKeywords.some((k) => otherKws.includes(k));
    });

    if (conflictingRule) {
      const overlap = uppercaseKeywords.filter((k) =>
        (conflictingRule.keywords || []).map((x) => x.trim().toUpperCase()).includes(k)
      );
      setConflictWarning(
        `Ambiguity Warning: Keyword "${overlap.join(', ')}" is already used by enabled rule "${conflictingRule.name}" on this post. Choose unique trigger keywords or deactivate that rule.`
      );
    } else {
      setConflictWarning(null);
    }
  }, [selectedPostId, isEnabled, keywords, editingRuleId, rules]);

  // Add keyword chip
  const handleAddKeyword = (customKw?: string) => {
    const raw = (customKw || keywordInput).trim().toUpperCase();
    if (!raw) return;

    const parts = raw
      .split(/[,]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const nextKeywords = [...keywords];
    for (const part of parts) {
      if (!nextKeywords.includes(part)) {
        nextKeywords.push(part);
      }
    }

    setKeywords(nextKeywords);
    if (!customKw) setKeywordInput('');
  };

  // Remove keyword chip
  const handleRemoveKeyword = (indexToRemove: number) => {
    setKeywords(keywords.filter((_, idx) => idx !== indexToRemove));
  };

  // Insert variable into message textarea
  const insertVariableTag = (tag: string) => {
    setPrivateReplyMessage((prev) => prev + (prev.endsWith(' ') || prev.length === 0 ? '' : ' ') + tag);
  };

  // Helper: Get products linked to a post
  const getProductsForPost = (postId: string): Product[] => {
    const linkedProdIds = postLinks
      .filter((l) => l.instagram_post_id === postId)
      .map((l) => l.product_id);
    return products.filter((p) => linkedProdIds.includes(p.id));
  };

  const selectedPostObj = posts.find((p) => p.id === selectedPostId);
  const productsAvailableForSelectedPost = selectedPostId
    ? getProductsForPost(selectedPostId)
    : [];

  // Quick Seed Sample Post when user has 0 posts
  const handleLoadSamplePost = async () => {
    if (!organization) return;
    setLoadingSamplePost(true);
    try {
      // Ensure account exists
      let acc = socialAccount;
      if (!acc) {
        const { data: newAcc, error: accErr } = await (supabase.from('social_accounts') as any)
          .insert({
            organization_id: organization.id,
            platform: 'instagram',
            external_account_id: 'ig_' + organization.id.slice(0, 8),
            username: organization.slug ? organization.slug.replace(/-/g, '_') : 'commcart_seller',
            connection_status: 'connected',
          })
          .select()
          .single();
        if (accErr) throw accErr;
        acc = newAcc as SocialAccount;
        setSocialAccount(acc);
      }

      const samplePostId = 'demo_' + Date.now().toString().slice(-6);
      const { data: newPost, error: postErr } = await (supabase.from('instagram_posts') as any)
        .insert({
          organization_id: organization.id,
          social_account_id: acc.id,
          external_media_id: samplePostId,
          caption: '✨ Exclusive Drop! Comment BUY or ORDER to receive your instant checkout link via DM! Limited pieces available 🛍️',
          media_type: 'IMAGE',
          media_url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&auto=format&fit=crop&q=80',
          thumbnail_url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&auto=format&fit=crop&q=80',
          permalink: 'https://www.instagram.com/p/demo_reel_sample/',
          published_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (postErr) throw postErr;
      const createdPost = newPost as InstagramPost;
      setPosts((prev) => [createdPost, ...prev]);

      // If products exist, link first product automatically for quick test
      if (products.length > 0) {
        const firstProd = products[0];
        const { data: linkData, error: linkErr } = await (supabase.from('post_product_links') as any)
          .insert({
            organization_id: organization.id,
            instagram_post_id: createdPost.id,
            product_id: firstProd.id,
          })
          .select()
          .single();

        if (!linkErr && linkData) {
          setPostLinks((prev) => [linkData as PostProductLink, ...prev]);
        }
      }

      setSelectedPostId(createdPost.id);
      setFeedback({
        type: 'success',
        message: 'Sample Instagram post loaded and linked. You can now configure keywords and messages!',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to load sample post');
    } finally {
      setLoadingSamplePost(false);
    }
  };

  // Save Rule Handler
  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    if (!selectedPostId) {
      alert('Please select an Instagram post or Reel.');
      return;
    }

    if (keywords.length === 0) {
      alert('Please add at least one trigger keyword (e.g. BUY, ORDER).');
      return;
    }

    if (conflictWarning) {
      alert('Please resolve the keyword conflict before saving.');
      return;
    }

    const postObj = posts.find((p) => p.id === selectedPostId);
    if (!postObj) {
      alert('Selected post not found.');
      return;
    }

    setSavingRule(true);
    setFeedback(null);

    const finalRuleName =
      ruleName.trim() || `Auto-Reply: ${keywords.slice(0, 2).join('/')}`;
    const finalProductId = selectedProductId === 'all_linked' ? null : selectedProductId;
    const normalizedKeywords = keywords.map((k) => k.trim().toUpperCase());

    // If a specific product was selected that isn't yet linked in post_product_links, link it!
    if (finalProductId) {
      const alreadyLinked = postLinks.some(
        (l) => l.instagram_post_id === selectedPostId && l.product_id === finalProductId
      );
      if (!alreadyLinked) {
        try {
          const { data: newLink } = await (supabase.from('post_product_links') as any)
            .insert({
              organization_id: organization.id,
              instagram_post_id: selectedPostId,
              product_id: finalProductId,
            })
            .select()
            .single();

          if (newLink) {
            setPostLinks((prev) => [newLink as PostProductLink, ...prev]);
          }
        } catch (err) {
          console.warn('Post link insert notice:', err);
        }
      }
    }

    try {
      const payload = {
        name: finalRuleName,
        social_account_id: postObj.social_account_id,
        instagram_post_id: selectedPostId,
        product_id: finalProductId,
        keywords: normalizedKeywords,
        match_mode: matchMode,
        is_enabled: isEnabled,
        private_reply_message: privateReplyMessage.trim() || getDefaultPrivateReply(),
        updated_at: new Date().toISOString(),
      };

      if (editingRuleId) {
        // Update existing rule
        const { data, error } = await (supabase.from('automation_rules') as any)
          .update(payload)
          .eq('id', editingRuleId)
          .select()
          .single();

        if (error) throw error;
        setRules((prev) =>
          prev.map((r) => (r.id === editingRuleId ? (data as AutomationRule) : r))
        );
        setFeedback({
          type: 'success',
          message: `Rule "${finalRuleName}" updated successfully.`,
        });
      } else {
        // Create new rule
        const { data, error } = await (supabase.from('automation_rules') as any)
          .insert({
            organization_id: organization.id,
            trigger_type: 'comment_keyword',
            ...payload,
          })
          .select()
          .single();

        if (error) throw error;
        setRules((prev) => [data as AutomationRule, ...prev]);
        setFeedback({
          type: 'success',
          message: `Rule "${finalRuleName}" created and active!`,
        });
      }

      setIsEditorOpen(false);
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      console.error('Error saving automation rule:', err);
      alert(err instanceof Error ? err.message : 'Failed to save automation rule');
    } finally {
      setSavingRule(false);
    }
  };

  // Toggle Rule Status (Enable / Disable)
  const handleToggleRuleStatus = async (rule: AutomationRule) => {
    const nextStatus = !rule.is_enabled;

    // If enabling, check for ambiguity conflict first
    if (nextStatus) {
      const uppercaseKeywords = (rule.keywords || []).map((k) => k.trim().toUpperCase());
      const conflictingRule = rules.find((r) => {
        if (r.id === rule.id) return false;
        if (r.instagram_post_id !== rule.instagram_post_id) return false;
        if (!r.is_enabled) return false;

        const otherKws = (r.keywords || []).map((k) => k.trim().toUpperCase());
        return uppercaseKeywords.some((k) => otherKws.includes(k));
      });

      if (conflictingRule) {
        setFeedback({
          type: 'error',
          message: `Cannot enable "${rule.name}": Keyword conflict with already enabled rule "${conflictingRule.name}". Please edit keywords or disable that rule first.`,
        });
        return;
      }
    }

    try {
      const { data, error } = await (supabase.from('automation_rules') as any)
        .update({
          is_enabled: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', rule.id)
        .select()
        .single();

      if (error) throw error;
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? (data as AutomationRule) : r))
      );
      setFeedback({
        type: 'success',
        message: `Rule "${rule.name}" is now ${nextStatus ? 'enabled' : 'disabled'}.`,
      });
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Failed to update rule status.',
      });
    }
  };

  // Delete Rule Handler
  const handleDeleteRule = async () => {
    if (!deletingRule) return;
    setDeletingLoading(true);

    try {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', deletingRule.id);

      if (error) throw error;
      setRules((prev) => prev.filter((r) => r.id !== deletingRule.id));
      setFeedback({
        type: 'success',
        message: `Rule "${deletingRule.name}" deleted.`,
      });
      setDeletingRule(null);
      setTimeout(() => setFeedback(null), 4000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete rule.');
    } finally {
      setDeletingLoading(false);
    }
  };

  // Filtered Rules
  const filteredRules = useMemo(() => {
    return rules.filter((r) => {
      const matchesSearch =
        r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.keywords || []).some((k) => k.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'enabled'
          ? r.is_enabled
          : !r.is_enabled;

      return matchesSearch && matchesStatus;
    });
  }, [rules, searchQuery, statusFilter]);

  // Render simulated message for preview
  const renderSimulatedMessage = (templateText: string, prod?: Product | null): string => {
    const pName = prod?.name || (products.length > 0 ? products[0].name : 'CommCart Item');
    const pPrice = prod
      ? `${prod.currency} ${Number(prod.price).toLocaleString()}`
      : products.length > 0
      ? `${products[0].currency} ${Number(products[0].price).toLocaleString()}`
      : 'KES 2,500';
    const storeTitle = organization?.name || 'CommCart Store';

    return (templateText || getDefaultPrivateReply())
      .replace(/{{customer_name}}/g, 'Sarah')
      .replace(/{{product_name}}/g, pName)
      .replace(/{{product_price}}/g, pPrice)
      .replace(/{{checkout_link}}/g, 'https://commcart.co/c/sample_order')
      .replace(/{{store_name}}/g, storeTitle)
      .replace(/{{order_number}}/g, 'CC-89412');
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 animate-fadeIn">
      {/* Top Bar & Dashboard Tabs */}
      <DashboardNav
        activeTab="automations"
        productCount={products.length}
        postsCount={posts.length}
        automationsCount={rules.length}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        {/* Workflow Guide Banner */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs mb-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                Automated Sales Funnel
              </span>
              <h2 className="text-lg font-bold text-slate-950 mt-0.5">
                Keyword Automation & Instagram Message Sequence
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              When a buyer comments with your keyword, CommCart sends an official Meta private reply DM leading to checkout.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                1
              </span>
              <div className="text-xs">
                <div className="font-semibold text-slate-900">Instagram Account</div>
                <div className="text-slate-500 text-[11px]">
                  {socialAccount ? `@${socialAccount.username}` : 'Meta Professional'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                2
              </span>
              <div className="text-xs">
                <div className="font-semibold text-slate-900">Post & Product Link</div>
                <div className="text-slate-500 text-[11px]">Synced Reel / catalog item</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold shrink-0">
                3
              </span>
              <div className="text-xs">
                <div className="font-semibold text-slate-900">Trigger Keywords</div>
                <div className="text-slate-500 text-[11px]">e.g. BUY, ORDER, PRICE</div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white text-xs font-bold shrink-0">
                4
              </span>
              <div className="text-xs">
                <div className="font-semibold text-slate-900">Automated DM Sequence</div>
                <div className="text-slate-500 text-[11px]">Private reply + checkout link</div>
              </div>
            </div>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm flex items-start gap-3 animate-fadeIn ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : feedback.type === 'info'
                ? 'border-blue-200 bg-blue-50 text-blue-900'
                : 'border-red-200 bg-red-50 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : feedback.type === 'info' ? (
              <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            )}
            <div className="flex-1 font-medium">{feedback.message}</div>
            <button
              onClick={() => setFeedback(null)}
              className="text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Page Header with Prominent Create Automation Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Keyword Automations
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Set up trigger rules that monitor Instagram comments and automatically initiate DM checkout conversations.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <a
              href="/dashboard/messages"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors"
            >
              <MessageSquare className="h-4 w-4 text-blue-600" />
              <span>Message Templates</span>
            </a>

            <button
              id="create-automation-btn"
              onClick={() => openCreateModal()}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Create Automation</span>
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
              placeholder="Search by rule name or keyword (e.g. BUY)..."
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

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({rules.length})
            </button>
            <button
              onClick={() => setStatusFilter('enabled')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'enabled'
                  ? 'bg-white text-emerald-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Enabled ({rules.filter((r) => r.is_enabled).length})
            </button>
            <button
              onClick={() => setStatusFilter('disabled')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                statusFilter === 'disabled'
                  ? 'bg-white text-slate-800 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Disabled ({rules.filter((r) => !r.is_enabled).length})
            </button>
          </div>
        </div>

        {/* Zero Posts or Accounts Guidance Alert */}
        {posts.length === 0 && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5 mb-6 text-amber-900">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <Instagram className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-sm">No Instagram Posts Retrieved Yet</h3>
                  <p className="mt-0.5 text-xs text-amber-800">
                    To link products and configure keywords, you can sync posts from your connected Instagram account or load a sample post for testing.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleLoadSamplePost}
                  disabled={loadingSamplePost}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-amber-700 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-amber-800 transition-colors disabled:opacity-50"
                >
                  {loadingSamplePost ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  <span>Load Sample Post (Testing)</span>
                </button>
                <a
                  href="/dashboard/posts"
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-50"
                >
                  <span>Go to Posts</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Rules Table / Cards */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm text-slate-600">Loading automation rules...</p>
          </div>
        ) : rules.length === 0 ? (
          /* Empty State: Zero Rules */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs max-w-xl mx-auto my-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Zap className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-950">No Automation Rules Configured</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed">
              Create your first automation rule. Select an Instagram post or Reel, choose your linked product, configure trigger keywords like <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">BUY</code> or <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800 font-mono">ORDER</code>, and customize your automated private reply DM.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => openCreateModal()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Create Automation Rule</span>
              </button>
              {posts.length === 0 && (
                <button
                  onClick={handleLoadSamplePost}
                  disabled={loadingSamplePost}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                  <span>Load Sample Post</span>
                </button>
              )}
            </div>
          </div>
        ) : filteredRules.length === 0 ? (
          /* Empty State: Filter mismatch */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs max-w-md mx-auto my-6">
            <Search className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-950">No matching automations</h3>
            <p className="mt-1 text-sm text-slate-500">
              No rules matched &quot;{searchQuery}&quot; with status &quot;{statusFilter}&quot;.
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
          /* Rules Table */
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th scope="col" className="px-6 py-3.5">Rule / Post</th>
                    <th scope="col" className="px-6 py-3.5">Linked Product</th>
                    <th scope="col" className="px-6 py-3.5">Keywords & Mode</th>
                    <th scope="col" className="px-6 py-3.5">Automated Message</th>
                    <th scope="col" className="px-6 py-3.5">Status</th>
                    <th scope="col" className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredRules.map((rule) => {
                    const post = posts.find((p) => p.id === rule.instagram_post_id);
                    const prod = rule.product_id
                      ? products.find((p) => p.id === rule.product_id)
                      : null;
                    const previewImg = post?.thumbnail_url || post?.media_url;

                    return (
                      <tr key={rule.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Rule Name & Post Preview */}
                        <td className="px-6 py-4">
                          <div className="flex items-start gap-3">
                            <div className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                              {previewImg ? (
                                <img
                                  src={previewImg}
                                  alt="Post"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Instagram className="h-5 w-5 text-slate-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-900 truncate block max-w-xs">
                                {rule.name}
                              </div>
                              <div className="text-[11px] text-slate-500 truncate max-w-xs mt-0.5">
                                {post?.caption || 'Instagram Post / Reel'}
                              </div>
                              {post?.permalink && (
                                <a
                                  href={post.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-0.5 mt-0.5"
                                >
                                  <span>View on Instagram</span>
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Linked Product */}
                        <td className="px-6 py-4">
                          {prod ? (
                            <div className="flex items-center gap-2">
                              {prod.image_url ? (
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="h-8 w-8 rounded object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                  <Package className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <div className="font-semibold text-xs text-slate-900 truncate max-w-[150px]">
                                  {prod.name}
                                </div>
                                <div className="text-[11px] text-emerald-700 font-medium">
                                  {prod.currency} {Number(prod.price).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                              <Package className="h-3 w-3 text-slate-400" />
                              <span>All Linked Products</span>
                            </span>
                          )}
                        </td>

                        {/* Trigger Keywords & Match Mode */}
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(rule.keywords || []).map((kw, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center rounded-md bg-amber-50 px-2 py-0.5 text-xs font-mono font-bold text-amber-900 border border-amber-200/80"
                              >
                                {kw}
                              </span>
                            ))}
                          </div>
                          <div className="mt-1 text-[11px] text-slate-500 font-medium capitalize">
                            {rule.match_mode === 'exact' ? 'Exact Match' : 'Whole-Word Match'}
                          </div>
                        </td>

                        {/* Automated Message Preview */}
                        <td className="px-6 py-4 max-w-xs">
                          <div className="text-xs text-slate-700 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100 font-sans">
                            {rule.private_reply_message || getDefaultPrivateReply()}
                          </div>
                          <button
                            onClick={() => setPreviewingRule(rule)}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                          >
                            <Smartphone className="h-3 w-3" />
                            <span>Preview DM</span>
                          </button>
                        </td>

                        {/* Status Toggle */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleRuleStatus(rule)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold focus:outline-none transition-colors"
                            title={rule.is_enabled ? 'Click to disable' : 'Click to enable'}
                          >
                            {rule.is_enabled ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full hover:bg-emerald-100">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                                Enabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full hover:bg-slate-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                                Disabled
                              </span>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(rule)}
                              title="Edit rule"
                              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingRule(rule)}
                              title="Delete rule"
                              className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="h-4 w-4" />
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

      {/* 3. Automation Rule Editor Modal (7-Step Workflow) */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200 max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">
                    {editingRuleId ? 'Edit Automation Rule' : 'Create Instagram Sales Automation'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Connect an Instagram post, product, trigger keywords, and automated message response
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

            <form onSubmit={handleSaveRule} className="mt-5 space-y-6">
              {/* Rule Name */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Automation Rule Name
                </label>
                <input
                  type="text"
                  required
                  value={ruleName}
                  onChange={(e) => setRuleName(e.target.value)}
                  placeholder="e.g. Summer Dress Comment Checkout"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              {/* Step 1: Connected Instagram Account */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-600 shrink-0">
                      <Instagram className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                        1. Connected Instagram Account
                      </div>
                      <div className="text-sm font-bold text-slate-950 mt-0.5">
                        {socialAccount ? `@${socialAccount.username}` : 'No Instagram Account Connected'}
                      </div>
                    </div>
                  </div>
                  {socialAccount?.connection_status === 'connected' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-semibold px-2.5 py-0.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Connected
                    </span>
                  ) : (
                    <a
                      href="/dashboard/posts"
                      className="text-xs font-semibold text-emerald-600 hover:underline"
                    >
                      Connect on Posts page &rarr;
                    </a>
                  )}
                </div>
              </div>

              {/* Step 2: Select Instagram Post or Reel */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    2. Select Instagram Post or Reel
                  </label>
                  {posts.length > 0 && (
                    <span className="text-[11px] text-slate-500">
                      {posts.length} post{posts.length !== 1 ? 's' : ''} available
                    </span>
                  )}
                </div>

                {posts.length === 0 ? (
                  <div className="p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center">
                    <Video className="mx-auto h-7 w-7 text-slate-400" />
                    <p className="mt-2 text-xs font-semibold text-slate-900">
                      No Instagram posts available yet
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      Sync media with your Instagram account or load a sample post for immediate testing.
                    </p>
                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={handleLoadSamplePost}
                        disabled={loadingSamplePost}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
                      >
                        {loadingSamplePost && <Loader2 className="h-3 w-3 animate-spin" />}
                        <span>Load Sample Post Now</span>
                      </button>
                      <a
                        href="/dashboard/posts"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <span>Posts Page</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50">
                    {posts.map((post) => {
                      const isSelected = selectedPostId === post.id;
                      const previewImg = post.thumbnail_url || post.media_url;
                      const postProductCount = getProductsForPost(post.id).length;

                      return (
                        <div
                          key={post.id}
                          onClick={() => {
                            setSelectedPostId(post.id);
                            // Default to first linked product or all_linked
                            const available = getProductsForPost(post.id);
                            if (available.length === 1) {
                              setSelectedProductId(available[0].id);
                            } else {
                              setSelectedProductId('all_linked');
                            }
                          }}
                          className={`flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-white border-emerald-600 ring-2 ring-emerald-600/20 shadow-2xs'
                              : 'bg-white/70 border-slate-200 hover:bg-white'
                          }`}
                        >
                          <div className="h-12 w-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200">
                            {previewImg ? (
                              <img
                                src={previewImg}
                                alt="Post thumbnail"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Instagram className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="inline-block px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                                {post.media_type}
                              </span>
                              <span className="text-[11px] text-emerald-700 font-medium">
                                {postProductCount > 0
                                  ? `${postProductCount} linked product${postProductCount !== 1 ? 's' : ''}`
                                  : '0 linked products'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-800 truncate">
                              {post.caption || 'No caption'}
                            </p>
                          </div>
                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full border border-slate-300 shrink-0" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Step 3: Select Product Linked to that Post */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  3. Select Product Linked to this Post
                </label>

                {productsAvailableForSelectedPost.length > 0 ? (
                  <div className="mt-1.5 space-y-2">
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="block w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                    >
                      <option value="all_linked">
                        All products linked to this post ({productsAvailableForSelectedPost.length} item{productsAvailableForSelectedPost.length !== 1 ? 's' : ''})
                      </option>
                      <optgroup label="Specific Linked Product">
                        {productsAvailableForSelectedPost.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} — {p.currency} {Number(p.price).toLocaleString()}
                          </option>
                        ))}
                      </optgroup>
                    </select>

                    {/* Visual Preview of selected product */}
                    {selectedProductId !== 'all_linked' && (
                      <div className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50 text-xs">
                        {products.find((p) => p.id === selectedProductId)?.image_url ? (
                          <img
                            src={products.find((p) => p.id === selectedProductId)?.image_url!}
                            alt="Product"
                            className="h-9 w-9 rounded-md object-cover border border-slate-200"
                          />
                        ) : (
                          <div className="h-9 w-9 rounded-md bg-white flex items-center justify-center border border-slate-200 text-slate-400">
                            <Package className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-bold text-slate-900">
                            {products.find((p) => p.id === selectedProductId)?.name}
                          </div>
                          <div className="text-[11px] text-emerald-700 font-semibold">
                            {products.find((p) => p.id === selectedProductId)?.currency}{' '}
                            {Number(products.find((p) => p.id === selectedProductId)?.price).toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-1.5 p-3.5 rounded-xl border border-amber-200 bg-amber-50/70 text-xs">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-amber-950">
                          No product currently linked to this post
                        </div>
                        <p className="mt-0.5 text-amber-800 text-[11px]">
                          Choose a catalog product below to link it now:
                        </p>
                        <select
                          value={selectedProductId === 'all_linked' ? '' : selectedProductId}
                          onChange={(e) => setSelectedProductId(e.target.value)}
                          className="mt-2 block w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-600 focus:outline-none"
                        >
                          <option value="">-- Choose Catalog Product to Link --</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} — {p.currency} {Number(p.price).toLocaleString()}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4: Trigger Keywords */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  4. Trigger Keywords
                </label>
                <div className="mt-1.5 flex gap-2">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder="e.g. BUY, ORDER, PRICE (press Enter to add)"
                    className="flex-1 rounded-lg border border-slate-300 font-mono text-xs px-3.5 py-2 uppercase placeholder:normal-case placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddKeyword()}
                    className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                  >
                    Add
                  </button>
                </div>

                {/* Suggestions */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 font-medium">Quick add:</span>
                  {SUGGESTED_KEYWORDS.map((kw) => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => handleAddKeyword(kw)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-mono font-bold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                    >
                      +{kw}
                    </button>
                  ))}
                </div>

                {/* Active Keyword Chips */}
                <div className="mt-2.5 flex flex-wrap gap-1.5 min-h-8">
                  {keywords.map((kw, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-mono font-bold text-amber-900 border border-amber-200"
                    >
                      <span>{kw}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveKeyword(idx)}
                        className="text-amber-700 hover:text-amber-950 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Step 5: Keyword Matching Mode */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                  5. Keyword Matching Mode
                </label>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <label
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                      matchMode === 'exact'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="matchMode"
                        checked={matchMode === 'exact'}
                        onChange={() => setMatchMode('exact')}
                        className="text-emerald-600 focus:ring-emerald-600"
                      />
                      <span className="font-bold text-slate-900">Exact Match</span>
                    </div>
                    <span className="mt-1 text-[11px] text-slate-500 leading-tight">
                      Comment must match the keyword strictly (e.g. &quot;BUY&quot;).
                    </span>
                  </label>

                  <label
                    className={`flex flex-col p-3 rounded-xl border cursor-pointer transition-colors ${
                      matchMode === 'whole_word'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="matchMode"
                        checked={matchMode === 'whole_word'}
                        onChange={() => setMatchMode('whole_word')}
                        className="text-emerald-600 focus:ring-emerald-600"
                      />
                      <span className="font-bold text-slate-900">Whole-Word Match</span>
                    </div>
                    <span className="mt-1 text-[11px] text-slate-500 leading-tight">
                      Matches keyword inside sentences (e.g. &quot;I want to BUY size M&quot;).
                    </span>
                  </label>
                </div>
              </div>

              {/* Step 6: Automated Message Configuration */}
              <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-emerald-700" />
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-900">
                      6. Comment-Triggered Private Reply
                    </label>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono">
                    {privateReplyMessage.length} chars
                  </span>
                </div>

                <p className="text-[11px] text-slate-600 mb-2">
                  The initial private DM sent automatically to the commenter via official Meta APIs.
                </p>

                {/* Variable Tags Insertion Pills */}
                <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
                  <span className="text-[10px] text-slate-500 font-medium">Insert tags:</span>
                  {VARIABLE_TAGS.map((v) => (
                    <button
                      key={v.tag}
                      type="button"
                      onClick={() => insertVariableTag(v.tag)}
                      className="rounded bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-mono text-emerald-800 hover:bg-emerald-50 hover:border-emerald-300 transition-colors"
                      title={v.desc}
                    >
                      {v.tag}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={privateReplyMessage}
                  onChange={(e) => setPrivateReplyMessage(e.target.value)}
                  placeholder="Hi {{customer_name}}! Thanks for inquiring about {{product_name}}..."
                  className="w-full rounded-xl border border-slate-300 p-3 text-xs text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-sans"
                />

                {/* Interactive Simulated DM Preview */}
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs">
                  <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 pb-2 border-b border-slate-100 mb-2.5">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                      Live Buyer DM Preview (Simulated)
                    </span>
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-mono text-[10px]">
                      Meta Graph API
                    </span>
                  </div>

                  <div className="flex items-start gap-2.5">
                    <div className="h-7 w-7 rounded-full bg-linear-to-tr from-amber-400 via-pink-500 to-purple-600 p-0.5 shrink-0">
                      <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-slate-800">
                        CC
                      </div>
                    </div>
                    <div className="max-w-md rounded-2xl rounded-tl-xs bg-slate-100 p-3 text-xs text-slate-900 leading-relaxed font-sans shadow-2xs">
                      {renderSimulatedMessage(
                        privateReplyMessage,
                        selectedProductId !== 'all_linked'
                          ? products.find((p) => p.id === selectedProductId)
                          : productsAvailableForSelectedPost[0] || null
                      )}
                    </div>
                  </div>
                </div>

                {/* Meta Policy Compliance Notice */}
                <div className="mt-3 flex items-start gap-2 text-[11px] text-slate-500 bg-slate-100/70 p-2.5 rounded-lg border border-slate-200/80">
                  <ShieldCheck className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">Meta Messaging Policy: </span>
                    The initial private reply is sent via Instagram Comment Private Reply API (1 DM per comment within 7 days). Subsequent customer care and checkout messages require the customer to respond or enter the 24-hour messaging window.
                  </div>
                </div>

                {/* Downstream Sequence Accordion */}
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowFollowUpSequence(!showFollowUpSequence)}
                    className="flex items-center justify-between w-full text-xs font-semibold text-slate-700 hover:text-slate-950"
                  >
                    <span>View Subsequent Checkout Journey Stages</span>
                    <span className="text-[11px] text-blue-600 font-medium">
                      {showFollowUpSequence ? 'Hide' : 'Show Sequence (6 stages)'}
                    </span>
                  </button>

                  {showFollowUpSequence && (
                    <div className="mt-3 space-y-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-semibold text-blue-800 text-[11px] uppercase">
                          Stage 2: Checkout Introduction
                        </span>
                        <p className="mt-0.5 text-slate-600 text-[11px]">
                          Sent once buyer opens the DM and interacts: &quot;Welcome to {organization?.name}! We are delighted to assist you.&quot;
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-semibold text-emerald-800 text-[11px] uppercase">
                          Stage 3: Product Details & Price
                        </span>
                        <p className="mt-0.5 text-slate-600 text-[11px]">
                          Item pricing, SKU, and availability confirmation.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-semibold text-amber-800 text-[11px] uppercase">
                          Stage 4: M-Pesa Payment Instructions
                        </span>
                        <p className="mt-0.5 text-slate-600 text-[11px]">
                          Explains Safaricom STK prompt on mobile phone.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-semibold text-emerald-800 text-[11px] uppercase">
                          Stage 5 & 6: Payment Confirmation / Retry
                        </span>
                        <p className="mt-0.5 text-slate-600 text-[11px]">
                          Transactional callback notice with retry option if failed.
                        </p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-semibold text-indigo-800 text-[11px] uppercase">
                          Stage 7: Order Confirmation
                        </span>
                        <p className="mt-0.5 text-slate-600 text-[11px]">
                          Unique order reference and delivery arrangement.
                        </p>
                      </div>
                      <div className="text-right">
                        <a
                          href="/dashboard/messages"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline font-semibold"
                        >
                          <span>Manage all templates in Message Manager</span>
                          <ArrowRight className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 7: Enable / Disable Toggle & Ambiguity Conflict Alert */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                <div>
                  <div className="text-xs font-semibold text-slate-900">
                    7. Enable Automation Rule
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Immediately listen for eligible comments on this post
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEnabled(!isEnabled)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isEnabled ? 'bg-emerald-600' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Ambiguity Conflict Warning Box */}
              {conflictWarning && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900 flex items-start gap-2.5">
                  <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
                  <div>{conflictWarning}</div>
                </div>
              )}

              {/* Submit Buttons */}
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
                  disabled={savingRule || Boolean(conflictWarning)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
                >
                  {savingRule && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>{editingRuleId ? 'Update Rule' : 'Save & Enable Automation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. DM Preview Modal (Triggered from Table) */}
      {previewingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-950 text-sm">
                  Instagram DM Message Preview
                </h3>
              </div>
              <button
                onClick={() => setPreviewingRule(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="my-4">
              <div className="text-xs text-slate-500 mb-1">
                Rule: <span className="font-semibold text-slate-900">{previewingRule.name}</span>
              </div>
              <div className="text-xs text-slate-500 mb-3">
                Trigger Keywords:{' '}
                <span className="font-mono font-bold text-amber-900">
                  {(previewingRule.keywords || []).join(', ')}
                </span>
              </div>

              {/* Phone Bubble Simulation */}
              <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200">
                <div className="flex items-start gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-linear-to-tr from-amber-400 via-pink-500 to-purple-600 p-0.5 shrink-0">
                    <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-[10px] font-bold text-slate-800">
                      CC
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold text-slate-800 mb-1">
                      {socialAccount ? `@${socialAccount.username}` : 'CommCart Store'}
                    </div>
                    <div className="rounded-2xl rounded-tl-xs bg-white border border-slate-200 p-3 text-xs text-slate-900 leading-relaxed shadow-2xs">
                      {renderSimulatedMessage(
                        previewingRule.private_reply_message || '',
                        previewingRule.product_id
                          ? products.find((p) => p.id === previewingRule.product_id)
                          : null
                      )}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Sent automatically via Meta Private Reply API
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPreviewingRule(null)}
                className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Close Preview
              </button>
              <button
                onClick={() => {
                  const target = previewingRule;
                  setPreviewingRule(null);
                  openEditModal(target);
                }}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Edit Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Delete Confirmation Modal */}
      {deletingRule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 mb-4">
              <Trash2 className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-slate-950 text-base">Delete Automation Rule</h3>
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete &quot;{deletingRule.name}&quot;? Comments matching keywords{' '}
              <span className="font-mono font-bold text-slate-900">
                {(deletingRule.keywords || []).join(', ')}
              </span>{' '}
              on this post will no longer trigger DM checkout responses.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeletingRule(null)}
                className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteRule}
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
