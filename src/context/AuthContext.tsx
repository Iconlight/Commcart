/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase/client.ts';
import type { User, Session } from '@supabase/supabase-js';
import type { Organization, OrganizationMember } from '../types/database.types.ts';
import { navigateTo } from '../lib/navigation.ts';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  organization: Organization | null;
  membership: OrganizationMember | null;
  loading: boolean;
  refreshOrg: (specificUserId?: string) => Promise<Organization | null>;
  setManualOrganization: (org: Organization) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  organization: null,
  membership: null,
  loading: true,
  refreshOrg: async () => null,
  setManualOrganization: () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<OrganizationMember | null>(null);
  const [loading, setLoading] = useState(true);

  // Load organization membership for a user
  const loadUserOrg = async (userId: string): Promise<Organization | null> => {
    try {
      const { data: mems, error: memErr } = await supabase
        .from('organization_members')
        .select('*')
        .eq('user_id', userId)
        .limit(1);

      if (!memErr && mems && mems.length > 0) {
        const currentMem = mems[0] as unknown as OrganizationMember;
        setMembership(currentMem);

        const { data: orgData, error: orgErr } = await supabase
          .from('organizations')
          .select('*')
          .eq('id', currentMem.organization_id)
          .maybeSingle();

        if (!orgErr && orgData) {
          const typedOrg = orgData as unknown as Organization;
          setOrganization(typedOrg);
          return typedOrg;
        } else {
          setOrganization(null);
          return null;
        }
      } else {
        setMembership(null);
        setOrganization(null);
        return null;
      }
    } catch (err) {
      console.error('Error fetching user organization in AuthProvider:', err);
      setMembership(null);
      setOrganization(null);
      return null;
    }
  };

  const refreshOrg = async (specificUserId?: string): Promise<Organization | null> => {
    const targetId = specificUserId || user?.id;
    if (!targetId) return null;
    return await loadUserOrg(targetId);
  };

  const setManualOrganization = (org: Organization) => {
    setOrganization(org);
    setMembership({
      id: 'owner-' + org.id,
      organization_id: org.id,
      user_id: user?.id || org.owner_id,
      role: 'owner',
      created_at: new Date().toISOString(),
    });
  };

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(async ({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      if (initialSession?.user) {
        await loadUserOrg(initialSession.user.id);
      }
      setLoading(false);
    });

    // 2. Auth State Change Listener (signs in, signs out, token refreshed)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        if (newSession?.user) {
          await loadUserOrg(newSession.user.id);
        } else {
          setMembership(null);
          setOrganization(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setOrganization(null);
    setMembership(null);
    navigateTo('/login');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        organization,
        membership,
        loading,
        refreshOrg,
        setManualOrganization,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
