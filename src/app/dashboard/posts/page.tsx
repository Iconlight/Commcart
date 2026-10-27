/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../../lib/supabase/client.ts';
import { apiFetch } from '../../../lib/api.ts';
import { useAuth } from '../../../context/AuthContext.tsx';
import DashboardNav from '../../../components/dashboard/DashboardNav.tsx';
import type {
  SocialAccount,
  InstagramPost,
  Product,
  PostProductLink,
} from '../../../types/database.types.ts';
import {
  Instagram,
  RefreshCw,
  Link as LinkIcon,
  Plus,
  Search,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Package,
  Layers,
  Video,
  Image as ImageIcon,
  Unlink,
  Info,
  Key,
  ShieldCheck,
  Zap,
  Sparkles,
  ArrowRight,
  Trash2,
} from 'lucide-react';

export default function InstagramPostsPage() {
  const { user, organization } = useAuth();

  // Data state
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [socialAccount, setSocialAccount] = useState<SocialAccount | null>(null);
  const [pendingPages, setPendingPages] = useState<
    Array<{ pageId: string; pageName: string; igUserId: string; igUsername: string }>
  >([]);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [postLinks, setPostLinks] = useState<PostProductLink[]>([]);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [linkingLoading, setLinkingLoading] = useState(false);
  const [savingPost, setSavingPost] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [mediaTypeFilter, setMediaTypeFilter] = useState<string>('all');

  // Modals
  const [linkingPost, setLinkingPost] = useState<InstagramPost | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAddPostModal, setShowAddPostModal] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Form fields
  const [customToken, setCustomToken] = useState('');
  const [customPageId, setCustomPageId] = useState('');
  const [newPostUrl, setNewPostUrl] = useState('');
  const [newPostCaption, setNewPostCaption] = useState('');
  const [newPostMediaType, setNewPostMediaType] = useState<'REELS' | 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'>('REELS');
  const [newPostImageUrl, setNewPostImageUrl] = useState('');

  // Meta configuration info
  const [metaConfig, setMetaConfig] = useState<{
    hasAppId: boolean;
    hasPageId: boolean;
    hasPageAccessToken: boolean;
    callbackUrl: string;
    apiVersion: string;
    oauthReady?: boolean;
    setupHelp?: string;
    oauthScopes?: string;
  } | null>(null);

  // Notifications
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // Load all data
  const loadData = async () => {
    if (!organization) return;
    try {
      setLoading(true);

      // Meta server config diagnostics
      fetch('/api/instagram/config')
        .then((res) => res.json())
        .then((cfg) => setMetaConfig(cfg))
        .catch(() => {});

      const { data: accData, error: accErr } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('platform', 'instagram')
        .order('created_at', { ascending: false });

      if (accErr) {
        console.error('Error fetching social account:', accErr);
      } else {
        const accounts = (accData || []) as SocialAccount[];
        setSocialAccounts(accounts);
        const live =
          accounts.find((a) => !a.is_demo && a.connection_status === 'connected') ||
          accounts.find((a) => !a.is_demo) ||
          null;
        setSocialAccount(live);
      }

      // 2. Fetch Instagram Posts
      const { data: postsData, error: postsErr } = await supabase
        .from('instagram_posts')
        .select('*')
        .eq('organization_id', organization.id)
        .order('published_at', { ascending: false });

      if (postsErr) {
        console.error('Error fetching posts:', postsErr);
      } else if (postsData) {
        setPosts(postsData as InstagramPost[]);
      }

      // 3. Fetch Active Catalog Products
      const { data: prodData, error: prodErr } = await supabase
        .from('products')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('status', 'active')
        .order('name', { ascending: true });

      if (prodErr) {
        console.error('Error fetching products:', prodErr);
      } else if (prodData) {
        setProducts(prodData as Product[]);
      }

      // 4. Fetch Post-Product Links
      const { data: linksData, error: linksErr } = await supabase
        .from('post_product_links')
        .select('*')
        .eq('organization_id', organization.id);

      if (linksErr) {
        console.error('Error fetching post product links:', linksErr);
      } else if (linksData) {
        setPostLinks(linksData as PostProductLink[]);
      }
    } catch (err: unknown) {
      console.error('Error in loadData:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (organization) {
      loadData();
    }
  }, [organization]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('auth_error');
    const auth = params.get('auth');
    const selectAccount = params.get('select_account');
    const username = params.get('username');

    if (authError) {
      setFeedback({
        type: 'error',
        title: 'Instagram connection failed',
        message: authError,
      });
    } else if (auth === 'instagram_connected') {
      setFeedback({
        type: 'success',
        title: 'Instagram connected',
        message: username
          ? `Connected @${username}. Click Sync Posts to import real media.`
          : 'Instagram professional account connected.',
      });
    }

    if (selectAccount) {
      setPendingId(selectAccount);
      apiFetch(`/api/instagram/oauth/pending?pendingId=${encodeURIComponent(selectAccount)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.pages) setPendingPages(data.pages);
          else if (data.error) {
            setFeedback({ type: 'error', title: 'Account selection expired', message: data.error });
          }
        })
        .catch(() => {});
    }
  }, []);

  const startOAuth = () => {
    if (!organization) return;
    if (metaConfig && metaConfig.oauthReady === false) {
      setFeedback({
        type: 'error',
        title: 'Meta OAuth is not configured',
        message:
          metaConfig.setupHelp ||
          'Set META_APP_ID and META_APP_SECRET, then add the callback URL in Meta for Developers.',
      });
      return;
    }
    window.location.href = `/api/instagram/oauth/start?organizationId=${encodeURIComponent(organization.id)}`;
  };

  const handleSelectPendingPage = async (pageId: string) => {
    if (!pendingId) return;
    setConnecting(true);
    try {
      const res = await apiFetch('/api/instagram/oauth/select', {
        method: 'POST',
        body: JSON.stringify({ pendingId, pageId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setFeedback({
          type: 'error',
          title: 'Could not connect selected account',
          message: data.error || 'Selection failed.',
        });
      } else {
        setSocialAccount(data.account);
        setPendingPages([]);
        setPendingId(null);
        setFeedback({
          type: 'success',
          title: 'Instagram Account Connected',
          message: data.message,
        });
        handleSyncMedia(data.account.id);
      }
    } finally {
      setConnecting(false);
    }
  };

  const handleConnect = async (useCustom = false) => {
    if (!organization) return;
    if (!useCustom) {
      startOAuth();
      return;
    }

    setConnecting(true);
    setFeedback(null);

    try {
      const payload: Record<string, string> = { organizationId: organization.id };
      if (customToken.trim()) payload.customToken = customToken.trim();
      if (customPageId.trim()) payload.customPageId = customPageId.trim();

      const res = await apiFetch('/api/instagram/connect', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (data.requiresSelection && data.pages) {
        setPendingPages(data.pages);
        setFeedback({
          type: 'info',
          title: 'Select an Instagram account',
          message: 'This Meta user manages more than one professional account.',
        });
        return;
      }

      if (!res.ok || !data.success) {
        setFeedback({
          type: 'error',
          title: `Meta Verification (${data.code ? 'Code ' + data.code : 'Notice'})`,
          message: [data.error, data.help].filter(Boolean).join(' '),
        });
      } else {
        setSocialAccount(data.account);
        setShowConnectModal(false);
        setFeedback({
          type: 'success',
          title: 'Instagram Account Connected!',
          message: data.message || `Successfully linked @${data.account.username}`,
        });
        handleSyncMedia(data.account.id);
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        title: 'Connection Request Failed',
        message: err instanceof Error ? err.message : 'Error communicating with server.',
      });
    } finally {
      setConnecting(false);
    }
  };

  // Sync Media from official Meta Graph API
  const handleSyncMedia = async (accId?: string) => {
    const targetAccountId = accId || socialAccount?.id;
    if (!organization || !targetAccountId) return;

    setSyncing(true);
    setFeedback(null);

    try {
      const res = await apiFetch('/api/instagram/sync-media', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: organization.id,
          socialAccountId: targetAccountId,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFeedback({
          type: 'error',
          title: `Instagram Sync Notice (${data.code ? 'Code ' + data.code : 'Notice'})`,
          message:
            data.code === 190
              ? 'Your Meta Page access token has expired. Please enter a fresh token via "Re-authenticate" or add posts by URL below.'
              : data.error || 'Failed to sync posts from Instagram.',
        });
      } else {
        setPosts(data.posts || []);
        setFeedback({
          type: 'success',
          title: 'Posts & Reels Synchronized',
          message: `Retrieved ${data.syncedCount} media items from @${socialAccount?.username || 'Instagram'}.`,
        });
        setTimeout(() => setFeedback(null), 5000);
      }
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        title: 'Sync Error',
        message: err instanceof Error ? err.message : 'Could not contact sync service.',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Disconnect Instagram Account
  const handleDisconnect = async () => {
    if (!organization || !socialAccount) return;
    if (!confirm(`Are you sure you want to disconnect @${socialAccount.username}?`)) return;

    setDisconnecting(true);
    try {
      const res = await apiFetch('/api/instagram/disconnect', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: organization.id,
          socialAccountId: socialAccount.id,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSocialAccount((prev) => (prev ? { ...prev, connection_status: 'disconnected' } : null));
        setFeedback({
          type: 'info',
          title: 'Account Disconnected',
          message: `@${socialAccount.username} has been disconnected.`,
        });
      }
    } catch (err) {
      console.error('Error disconnecting:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const getDemoAccount = async (): Promise<SocialAccount> => {
    const existing = socialAccounts.find((a) => a.is_demo);
    if (existing) return existing;

    const { data, error } = await (supabase.from('social_accounts') as any)
      .insert({
        organization_id: organization!.id,
        platform: 'instagram',
        external_account_id: 'demo_' + organization!.id.slice(0, 8),
        username: 'demo_not_a_real_account',
        connection_status: 'disconnected',
        is_demo: true,
      })
      .select()
      .single();

    if (error) throw error;
    const acc = data as SocialAccount;
    setSocialAccounts((prev) => [acc, ...prev]);
    return acc;
  };

  // Add Post by URL or Media ID
  const handleAddPost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    setSavingPost(true);
    try {
      const account = await getOrCreateSocialAccount();

      // Extract media ID or generate unique ID from permalink
      let mediaId = 'media_' + Date.now();
      const match = newPostUrl.match(/\/p\/([a-zA-Z0-9_-]+)/) || newPostUrl.match(/\/reel\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        mediaId = match[1];
      } else if (newPostUrl.trim().length > 3 && !newPostUrl.includes('/')) {
        mediaId = newPostUrl.trim();
      }

      const permalink = newPostUrl.startsWith('http')
        ? newPostUrl.trim()
        : `https://www.instagram.com/p/${mediaId}/`;

      const { data, error } = await (supabase.from('instagram_posts') as any)
        .insert({
          organization_id: organization.id,
          social_account_id: account.id,
          external_media_id: mediaId,
          caption: newPostCaption.trim() || 'Instagram Post',
          media_type: newPostMediaType,
          media_url: newPostImageUrl.trim() || null,
          thumbnail_url: newPostImageUrl.trim() || null,
          permalink,
          published_at: new Date().toISOString(),
          is_demo: account.is_demo === true,
        })
        .select()
        .single();

      if (error) throw error;

      setPosts((prev) => [data as InstagramPost, ...prev]);
      setShowAddPostModal(false);
      setNewPostUrl('');
      setNewPostCaption('');
      setNewPostImageUrl('');
      setFeedback({
        type: 'success',
        title: 'Post Registered Successfully!',
        message: 'You can now link products and configure keyword checkout rules for this post.',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to register post');
    } finally {
      setSavingPost(false);
    }
  };

  // Quick Demo Post Seeder
  const handleLoadSamplePost = async () => {
    if (!organization) return;
    setSavingPost(true);
    try {
      const account = await getDemoAccount();
      const demoId = 'demo_' + Date.now().toString().slice(-6);

      const { data, error } = await (supabase.from('instagram_posts') as any)
        .insert({
          organization_id: organization.id,
          social_account_id: account.id,
          external_media_id: demoId,
          caption: '✨ New luxury arrivals in store today! Comment "BUY" or "PRICE" to get your instant direct checkout link sent to your DMs.',
          media_type: 'REELS',
          media_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
          thumbnail_url: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80',
          permalink: `https://www.instagram.com/reel/${demoId}/`,
          published_at: new Date().toISOString(),
          is_demo: true,
        })
        .select()
        .single();

      if (error) throw error;
      setPosts((prev) => [data as InstagramPost, ...prev]);
      setFeedback({
        type: 'success',
        title: 'Development demo post added',
        message: 'This is not real Instagram media. Connect Instagram and Sync Posts to import your actual posts and Reels.',
      });
      setTimeout(() => setFeedback(null), 5000);
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to create demo post');
    } finally {
      setSavingPost(false);
    }
  };

  // Toggle Post-Product Link Handler
  const handleToggleProductLink = async (productId: string) => {
    if (!organization || !linkingPost) return;
    setLinkingLoading(true);

    const existingLink = postLinks.find(
      (l) => l.instagram_post_id === linkingPost.id && l.product_id === productId
    );

    try {
      if (existingLink) {
        // Remove link
        const { error } = await supabase
          .from('post_product_links')
          .delete()
          .eq('id', existingLink.id);

        if (error) throw error;
        setPostLinks((prev) => prev.filter((l) => l.id !== existingLink.id));
      } else {
        // Add link
        const { data, error } = await (supabase.from('post_product_links') as any)
          .insert({
            organization_id: organization.id,
            instagram_post_id: linkingPost.id,
            product_id: productId,
          })
          .select()
          .single();

        if (error) throw error;
        if (data) {
          setPostLinks((prev) => [...prev, data as PostProductLink]);
        }
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to update post product link');
    } finally {
      setLinkingLoading(false);
    }
  };

  // Quick Remove Product Link from card
  const handleRemoveLinkDirect = async (postId: string, productId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetLink = postLinks.find(
      (l) => l.instagram_post_id === postId && l.product_id === productId
    );
    if (!targetLink) return;

    try {
      const { error } = await supabase
        .from('post_product_links')
        .delete()
        .eq('id', targetLink.id);

      if (error) throw error;
      setPostLinks((prev) => prev.filter((l) => l.id !== targetLink.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to remove product link');
    }
  };

  // Helper: Get products linked to a specific post
  const getLinkedProductsForPost = (postId: string): Product[] => {
    const linkedIds = postLinks
      .filter((l) => l.instagram_post_id === postId)
      .map((l) => l.product_id);
    return products.filter((p) => linkedIds.includes(p.id));
  };

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        (p.caption && p.caption.toLowerCase().includes(searchQuery.toLowerCase())) ||
        p.external_media_id.includes(searchQuery);

      const matchesType =
        mediaTypeFilter === 'all'
          ? true
          : mediaTypeFilter === 'VIDEO'
          ? p.media_type === 'VIDEO' || p.media_type === 'REELS'
          : p.media_type === mediaTypeFilter;

      return matchesSearch && matchesType;
    });
  }, [posts, searchQuery, mediaTypeFilter]);

  const getMediaIcon = (type: string) => {
    switch (type.toUpperCase()) {
      case 'VIDEO':
      case 'REELS':
        return <Video className="h-3.5 w-3.5" />;
      case 'CAROUSEL_ALBUM':
        return <Layers className="h-3.5 w-3.5" />;
      default:
        return <ImageIcon className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 animate-fadeIn">
      {/* Top Bar & Dashboard Tabs */}
      <DashboardNav
        activeTab="posts"
        productCount={products.length}
        postsCount={posts.length}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-6 py-8 lg:px-8">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mb-6 rounded-xl border p-4 text-sm flex items-start gap-3 animate-fadeIn ${
              feedback.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : feedback.type === 'error'
                ? 'border-red-200 bg-red-50 text-red-900'
                : 'border-blue-200 bg-blue-50 text-blue-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
            ) : (
              <Info className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-semibold text-xs uppercase tracking-wider mb-0.5">
                {feedback.title}
              </div>
              <div>{feedback.message}</div>
            </div>
            <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-slate-600 p-1">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* 1. Instagram Connection Status Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-2xs mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shadow-xs shrink-0">
                <Instagram className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-slate-950">
                    Instagram Professional Account
                  </h2>
                  {socialAccount && socialAccount.connection_status === 'connected' ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      Connected: @{socialAccount.username}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      Ready to Connect
                    </span>
                  )}
                </div>

                {socialAccount && socialAccount.connection_status === 'connected' ? (
                  <p className="mt-1 text-xs text-slate-600">
                    Instagram Account ID: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">{socialAccount.external_account_id}</code>
                    {' · '}Authorized for Media Sync, Comment Monitoring, and Private Replies.
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-slate-500">
                    Connect your Instagram Professional (Business or Creator) account to import posts, link products, and configure automated checkout flows.
                  </p>
                )}
              </div>
            </div>

            {/* Account Actions */}
            <div className="flex flex-wrap items-center gap-2.5">
              {socialAccount && socialAccount.connection_status === 'connected' ? (
                <>
                  <button
                    onClick={() => handleSyncMedia()}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin' : ''}`} />
                    <span>{syncing ? 'Syncing...' : 'Sync from Meta'}</span>
                  </button>

                  <button
                    onClick={() => setShowConnectModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Key className="h-3.5 w-3.5 text-slate-500" />
                    <span>Token / Re-auth</span>
                  </button>

                  <button
                    onClick={handleDisconnect}
                    disabled={disconnecting}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-60"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>Disconnect</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => handleConnect(false)}
                    disabled={connecting}
                    className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition-colors disabled:opacity-60"
                  >
                    {connecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Instagram className="h-3.5 w-3.5" />}
                    <span>Connect Server Account</span>
                  </button>

                  <button
                    onClick={() => setShowConnectModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                  >
                    <Key className="h-3.5 w-3.5 text-slate-500" />
                    <span>Enter Active Token</span>
                  </button>

                  <button
                    onClick={() => setShowSetupGuide(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    <Info className="h-3.5 w-3.5 text-slate-400" />
                    <span>Setup Guide</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 2. Posts Header & Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950">
              Instagram Posts & Reels
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Browse retrieved media, click <strong className="text-slate-900">Link Product</strong> to map catalog items, and set up keyword automations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setShowAddPostModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-slate-800 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Post by URL / ID</span>
            </button>

            {posts.length === 0 && (
              <button
                onClick={handleLoadSamplePost}
                disabled={savingPost}
                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>Load Sample Post</span>
              </button>
            )}

            <a
              href="/dashboard/automations"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              <span>Go to Automations</span>
            </a>
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
              placeholder="Search captions or external media ID..."
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
              onClick={() => setMediaTypeFilter('all')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                mediaTypeFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({posts.length})
            </button>
            <button
              onClick={() => setMediaTypeFilter('REELS')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                mediaTypeFilter === 'REELS'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reels
            </button>
            <button
              onClick={() => setMediaTypeFilter('IMAGE')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                mediaTypeFilter === 'IMAGE'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Images
            </button>
            <button
              onClick={() => setMediaTypeFilter('CAROUSEL_ALBUM')}
              className={`px-3 py-1.5 rounded-md transition-colors ${
                mediaTypeFilter === 'CAROUSEL_ALBUM'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Carousels
            </button>
          </div>
        </div>

        {/* 3. Posts Grid */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-600" />
            <p className="mt-3 text-sm text-slate-600">Loading Instagram posts...</p>
          </div>
        ) : posts.length === 0 ? (
          /* Empty State: Zero Posts */
          <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center shadow-2xs max-w-2xl mx-auto my-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 text-white shadow-xs">
              <Instagram className="h-7 w-7" />
            </div>
            <h3 className="mt-4 text-lg font-bold text-slate-950">Ready to Link Instagram Posts</h3>
            <p className="mt-2 text-sm text-slate-600 leading-relaxed max-w-lg mx-auto">
              Follow the 3-step workflow below to connect an Instagram post, map it to a product in your catalog, and launch automated keyword sales.
            </p>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-900 text-white text-xs font-bold mb-2">1</span>
                <div className="font-semibold text-xs text-slate-900">Sync or Add Post</div>
                <div className="text-[11px] text-slate-500 mt-1">Connect Meta Graph API or paste any post URL.</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-600 text-white text-xs font-bold mb-2">2</span>
                <div className="font-semibold text-slate-900">Link Product</div>
                <div className="text-[11px] text-slate-500 mt-1">Click &quot;Link Product&quot; to pick items from your catalog.</div>
              </div>
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-white text-xs font-bold mb-2">3</span>
                <div className="font-semibold text-slate-900">Configure Keywords</div>
                <div className="text-[11px] text-slate-500 mt-1">Set keywords like BUY or ORDER to trigger checkout.</div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                onClick={handleLoadSamplePost}
                disabled={savingPost}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                <span>Load Sample Post (Instant Test)</span>
              </button>
              <button
                onClick={() => setShowAddPostModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                <Plus className="h-4 w-4" />
                <span>Add Post by URL / ID</span>
              </button>
              <button
                onClick={() => setShowConnectModal(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Key className="h-4 w-4 text-slate-500" />
                <span>Enter Meta Token</span>
              </button>
            </div>
          </div>
        ) : filteredPosts.length === 0 ? (
          /* Empty State: Filter mismatch */
          <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-2xs max-w-md mx-auto my-6">
            <Search className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="mt-3 text-base font-semibold text-slate-950">No matching posts</h3>
            <p className="mt-1 text-sm text-slate-500">
              No media found matching &quot;{searchQuery}&quot;.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setMediaTypeFilter('all');
              }}
              className="mt-4 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Post Cards Grid */
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredPosts.map((post) => {
              const linkedProds = getLinkedProductsForPost(post.id);
              const previewImg = post.thumbnail_url || post.media_url;

              return (
                <div
                  key={post.id}
                  className="group flex flex-col rounded-2xl border border-slate-200 bg-white overflow-hidden shadow-2xs hover:shadow-sm transition-all"
                >
                  {/* Media Preview Box */}
                  <div className="relative aspect-square w-full bg-slate-100 overflow-hidden">
                    {previewImg ? (
                      <img
                        src={previewImg}
                        alt={post.caption || 'Instagram Post'}
                        className="h-full w-full object-cover group-hover:scale-102 transition-transform duration-300"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-slate-400">
                        <Instagram className="h-12 w-12" />
                      </div>
                    )}

                    {/* Media Type Badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1 rounded-md bg-slate-950/70 backdrop-blur-xs px-2.5 py-1 text-[11px] font-semibold text-white">
                      {getMediaIcon(post.media_type)}
                      <span>{post.media_type}</span>
                    </div>

                    {/* External Link */}
                    {post.permalink && (
                      <a
                        href={post.permalink}
                        target="_blank"
                        rel="noreferrer"
                        title="View on Instagram"
                        className="absolute top-3 right-3 rounded-md bg-slate-950/70 backdrop-blur-xs p-1.5 text-white hover:bg-slate-900 transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>

                  {/* Body Content */}
                  <div className="flex flex-1 flex-col p-4">
                    {/* Publication Date */}
                    <div className="text-[11px] font-medium text-slate-400 mb-1.5">
                      {post.published_at
                        ? new Date(post.published_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'Uploaded Post'}
                    </div>

                    {/* Caption */}
                    <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed mb-4 flex-1">
                      {post.caption || <span className="italic text-slate-400">No caption provided.</span>}
                    </p>

                    {/* Linked Products Section (Directly visible on card) */}
                    <div className="border-t border-slate-100 pt-3">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                          <Package className="h-3.5 w-3.5 text-emerald-600" />
                          <span>Linked Products ({linkedProds.length})</span>
                        </span>
                        {linkedProds.length > 0 && (
                          <button
                            onClick={() => setLinkingPost(post)}
                            className="font-semibold text-emerald-700 hover:text-emerald-800 text-[11px]"
                          >
                            Edit
                          </button>
                        )}
                      </div>

                      {linkedProds.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          {linkedProds.map((prod) => (
                            <div
                              key={prod.id}
                              className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-emerald-50/70 border border-emerald-200/60 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                {prod.image_url ? (
                                  <img
                                    src={prod.image_url}
                                    alt={prod.name}
                                    className="h-6 w-6 rounded object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="h-6 w-6 rounded bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                                    <Package className="h-3 w-3" />
                                  </div>
                                )}
                                <span className="font-semibold text-slate-900 truncate">
                                  {prod.name}
                                </span>
                                <span className="font-mono text-[11px] text-emerald-800 shrink-0">
                                  {prod.currency} {Number(prod.price).toLocaleString()}
                                </span>
                              </div>
                              <button
                                onClick={(e) => handleRemoveLinkDirect(post.id, prod.id, e)}
                                title="Remove link"
                                className="text-slate-400 hover:text-red-600 p-1"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-2.5 rounded-lg bg-slate-50 border border-dashed border-slate-200 text-center text-[11px] text-slate-500">
                          No products linked yet. Click &quot;Link Product&quot; below.
                        </div>
                      )}
                    </div>

                    {/* Card Actions: Prominent Link Product Button */}
                    <div className="mt-4 flex items-center gap-2 pt-3 border-t border-slate-100">
                      <button
                        onClick={() => setLinkingPost(post)}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700 transition-colors"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                        <span>Link Product</span>
                      </button>

                      <a
                        href={`/dashboard/automations?postId=${post.id}`}
                        className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
                        title="Create automation rule for this post"
                      >
                        <Zap className="h-3.5 w-3.5 text-amber-500" />
                        <span className="hidden sm:inline">Automate</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. Link Products Modal (Add, Change, and Remove Products) */}
      {linkingPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 font-bold shrink-0">
                  <LinkIcon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-950 text-base">Link Catalog Products</h3>
                  <p className="text-xs text-slate-500 truncate">
                    Select products to associate with this Instagram post
                  </p>
                </div>
              </div>
              <button
                onClick={() => setLinkingPost(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Post Summary */}
            <div className="mt-4 flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
              {(linkingPost.thumbnail_url || linkingPost.media_url) && (
                <img
                  src={linkingPost.thumbnail_url || linkingPost.media_url || ''}
                  alt="Post preview"
                  className="h-14 w-14 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              )}
              <div className="min-w-0 flex-1">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-200 text-slate-700 mb-1">
                  {linkingPost.media_type}
                </span>
                <p className="text-xs text-slate-600 line-clamp-2">
                  {linkingPost.caption || 'No caption'}
                </p>
              </div>
            </div>

            {/* Product Checkboxes */}
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Select Products ({products.length} in catalog)
                </label>
                <a
                  href="/dashboard/products/new"
                  className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <Plus className="h-3 w-3" />
                  <span>New Product</span>
                </a>
              </div>

              {products.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-500">
                  No products in your CommCart catalog yet.{' '}
                  <a href="/dashboard/products/new" className="text-emerald-600 font-semibold underline">
                    Add your first product
                  </a>.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 divide-y divide-slate-100 border border-slate-200 rounded-xl p-2">
                  {products.map((product) => {
                    const isLinked = postLinks.some(
                      (l) => l.instagram_post_id === linkingPost.id && l.product_id === product.id
                    );

                    return (
                      <label
                        key={product.id}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                          isLinked ? 'bg-emerald-50/70 border border-emerald-200' : 'hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isLinked}
                          disabled={linkingLoading}
                          onChange={() => handleToggleProductLink(product.id)}
                          className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600"
                        />
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="h-9 w-9 rounded-md object-cover border border-slate-200 shrink-0"
                            />
                          ) : (
                            <div className="h-9 w-9 rounded-md bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-slate-900 truncate">
                              {product.name}
                            </div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {product.currency} {Number(product.price).toLocaleString()}
                              {product.sku && ` · SKU: ${product.sku}`}
                            </div>
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-xs text-slate-500">
                Changes save directly to Supabase.
              </span>
              <button
                onClick={() => setLinkingPost(null)}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-emerald-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Add Post by URL / ID Modal */}
      {showAddPostModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold shrink-0">
                  <Plus className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">Add Instagram Post</h3>
                  <p className="text-xs text-slate-500">
                    Register a post by Instagram link or ID
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddPostModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddPost} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Instagram Post or Reel URL / ID
                </label>
                <input
                  type="text"
                  required
                  value={newPostUrl}
                  onChange={(e) => setNewPostUrl(e.target.value)}
                  placeholder="https://www.instagram.com/reel/C8xyz123... or ID"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 text-xs px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Post Caption
                </label>
                <textarea
                  rows={2}
                  value={newPostCaption}
                  onChange={(e) => setNewPostCaption(e.target.value)}
                  placeholder="e.g. Check out our new summer collection! Comment BUY to order."
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 text-xs px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Media Type
                  </label>
                  <select
                    value={newPostMediaType}
                    onChange={(e) => setNewPostMediaType(e.target.value as any)}
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 bg-white text-xs px-3 py-2 text-slate-900 focus:border-emerald-600 focus:outline-none"
                  >
                    <option value="REELS">Reels / Video</option>
                    <option value="IMAGE">Single Image</option>
                    <option value="CAROUSEL_ALBUM">Carousel Album</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Preview Image URL
                  </label>
                  <input
                    type="url"
                    value={newPostImageUrl}
                    onChange={(e) => setNewPostImageUrl(e.target.value)}
                    placeholder="https://..."
                    className="mt-1.5 block w-full rounded-lg border border-slate-300 text-xs px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPostModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPost}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
                >
                  {savingPost && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Save Post</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Custom Token / Re-auth Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-slate-200">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-pink-50 flex items-center justify-center text-pink-600 font-bold shrink-0">
                  <Key className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">Meta Access Token</h3>
                  <p className="text-xs text-slate-500">
                    Connect using an active Graph API token
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowConnectModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConnect(true);
              }}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Meta Page or User Access Token
                </label>
                <textarea
                  required
                  rows={3}
                  value={customToken}
                  onChange={(e) => setCustomToken(e.target.value)}
                  placeholder="EAAYOZC..."
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 font-mono text-xs px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none focus:ring-1 focus:ring-emerald-600"
                />
                <p className="mt-1 text-[11px] text-slate-500">
                  Tokens are validated server-side against official Meta endpoints. Never exposed to browser queries.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                  Facebook Page ID (Optional)
                </label>
                <input
                  type="text"
                  value={customPageId}
                  onChange={(e) => setCustomPageId(e.target.value)}
                  placeholder="e.g. 1115581054556995"
                  className="mt-1.5 block w-full rounded-lg border border-slate-300 text-xs px-3 py-2 text-slate-900 placeholder-slate-400 focus:border-emerald-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connecting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-60"
                >
                  {connecting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  <span>Verify & Connect</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. Setup Guide Drawer */}
      {showSetupGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-xl rounded-2xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600 font-bold shrink-0">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-950 text-base">Meta Developer Setup Requirements</h3>
                  <p className="text-xs text-slate-500">Official Instagram Graph API Integration</p>
                </div>
              </div>
              <button
                onClick={() => setShowSetupGuide(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs text-slate-700 leading-relaxed">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[10px]">1</span>
                  Switch to an Instagram Professional Account
                </h4>
                <p className="text-slate-600">
                  In the Instagram app, go to <strong>Settings → Account type and tools → Switch to Professional Account</strong> (choose Creator or Business).
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[10px]">2</span>
                  Link Instagram to a Facebook Page
                </h4>
                <p className="text-slate-600">
                  In Facebook Page Settings, navigate to <strong>Linked Accounts → Instagram</strong> and connect your professional account.
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200">
                <h4 className="font-bold text-slate-900 mb-1 flex items-center gap-1.5">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white text-[10px]">3</span>
                  Required Meta Permissions
                </h4>
                <ul className="list-disc pl-5 space-y-1 text-slate-600 font-mono text-[11px]">
                  <li><code>instagram_basic</code> — Read media & account metadata</li>
                  <li><code>instagram_manage_comments</code> — Listen to comment triggers</li>
                  <li><code>instagram_manage_messages</code> — Send checkout DMs</li>
                  <li><code>pages_show_list</code> & <code>pages_read_engagement</code> — Manage Page link</li>
                </ul>
              </div>

              <div className="rounded-xl bg-amber-50 p-3.5 border border-amber-200 text-amber-900">
                <h4 className="font-bold mb-1 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  Meta Messaging Window Constraints
                </h4>
                <p className="text-amber-800 leading-relaxed text-[11px]">
                  <strong>Private Replies:</strong> Meta allows 1 single private reply to an eligible comment within 7 days. It does NOT open a 24-hour messaging window until the buyer replies to your message.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowSetupGuide(false)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
              >
                Close Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
