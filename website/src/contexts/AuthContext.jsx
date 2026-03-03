import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabaseClient, isSupabaseConfigured } from '../config/supabase-config.js';
import { fetchUserSubscription } from '../lib/getSubscription.js';

const AuthContext = createContext(null);

/**
 * Build the URL Supabase will redirect to after Google OAuth.
 * Add this exact URL (and localhost for dev) to Supabase Dashboard:
 * Authentication → URL Configuration → Redirect URLs.
 */
function getAuthRedirectUrl() {
  if (typeof window === 'undefined') return '';
  const origin = window.location.origin;
  return `${origin}/auth/callback`;
}

/**
 * Sign in with Google via redirect. User is sent to Google then back to
 * /auth/callback, where we set the session and redirect to home.
 * Session is stored in the browser by Supabase (localStorage).
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured || !supabaseClient) {
    return { error: 'Supabase is not configured.' };
  }
  const redirectTo = getAuthRedirectUrl();
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { access_type: 'offline', prompt: 'consent' },
    },
  });
  if (error) return { error: error.message };
  if (!data?.url) return { error: 'No auth URL returned.' };
  window.location.href = data.url;
  return { error: null };
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  // Subscription state: tier comes from get-user-subscription (server-verified profiles.tier).
  // Pro access is not restricted when cancel_at_period_end is true: the webhook only sets
  // tier to 'free' when the subscription is fully canceled (after current_period_end), so
  // scheduled downgrades are handled safely without prematurely locking out Pro features.
  const [tier, setTier] = useState(null); // 'free' | 'pro' | null
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionError, setSubscriptionError] = useState(null);

  // Fetch subscription state from the get-user-subscription Edge Function (server-verified) instead of
  // querying tables from the client. Prevents client-side tampering and ensures tier/status are
  // authoritative. Used after returning from Stripe or when the app needs to refresh plan state.
  const refetchSubscription = useCallback(async () => {
    if (!isSupabaseConfigured || !supabaseClient || !user?.id) {
      setTier(null);
      setSubscriptionError(null);
      return Promise.resolve();
    }
    setSubscriptionLoading(true);
    setSubscriptionError(null);
    try {
      const result = await fetchUserSubscription(supabaseClient);
      if (result.error) {
        setSubscriptionError(result.error);
        setTier(null);
        return;
      }
      setTier(result.data?.tier ?? 'free');
    } catch (e) {
      setSubscriptionError(e?.message ?? 'Failed to load plan');
      setTier(null);
    } finally {
      setSubscriptionLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabaseClient) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    async function initSession() {
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (cancelled) return;
        setUser(data?.session?.user ?? null);
      } catch (_) {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    initSession();

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        if (cancelled) return;
        setUser(session?.user ?? null);
      }
    );

    return () => {
      cancelled = true;
      subscription?.unsubscribe();
    };
  }, []);

  // When user is set, ensure they have a profiles row before we use tier/subscriptions.
  // Onboarding flow: every authenticated user must have a corresponding profiles record so
  // subscription and billing features (Navbar tier, ProRoute, dashboard) work. We check for
  // an existing row first to avoid duplicate key errors; if missing, we insert with default
  // tier = 'free'. Then we fetch tier. No upsert-overwrite of full_name/email so we don't
  // clobber server-updated or trigger-created data.
  useEffect(() => {
    if (!user?.id || !isSupabaseConfigured || !supabaseClient) {
      setTier(null);
      setSubscriptionError(null);
      setSubscriptionLoading(false);
      return;
    }
    let cancelled = false;
    setSubscriptionLoading(true);
    setSubscriptionError(null);

    async function ensureProfileThenFetchTier() {
      // 1. Ensure profile exists: select first, insert only when missing (no duplicate rows).
      const { data: existing } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (!existing) {
        const { error: insertError } = await supabaseClient
          .from('profiles')
          .insert({
            id: user.id,
            full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
            email: user.email ?? null,
            tier: 'free',
          });
        if (!cancelled && insertError) {
          // Trigger may have created the row between select and insert; if duplicate, continue.
          if (insertError.code !== '23505') {
            setSubscriptionError(insertError.message);
            setTier(null);
            setSubscriptionLoading(false);
            return;
          }
        }
      }
      if (cancelled) return;
      // 2. Fetch tier and subscription from get-user-subscription Edge Function (server-verified).
      // We do not query profiles/subscriptions from the client so subscription status cannot be tampered with.
      const result = await fetchUserSubscription(supabaseClient);
      if (cancelled) return;
      if (result.error) {
        setSubscriptionError(result.error);
        setTier(null);
        return;
      }
      setTier(result.data?.tier ?? 'free');
    }

    ensureProfileThenFetchTier()
      .catch((e) => {
        if (!cancelled) {
          setSubscriptionError(e?.message ?? 'Failed to load plan');
          setTier(null);
        }
      })
      .finally(() => {
        if (!cancelled) setSubscriptionLoading(false);
      });
    return () => { cancelled = true; };
  }, [user?.id]);

  const logout = useCallback(async () => {
    if (!isSupabaseConfigured || !supabaseClient) return;
    await supabaseClient.auth.signOut();
    setUser(null);
    setTier(null);
    setSubscriptionError(null);
  }, []);

  const value = {
    user,
    loading,
    tier,
    subscriptionLoading,
    subscriptionError,
    refetchSubscription,
    logout,
    signInWithGoogle,
    isSupabaseConfigured,
    // Email verification: set by Supabase when provider (e.g. Google) confirms email. Used for onboarding/verification banner.
    emailVerified: Boolean(user?.email_confirmed_at),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
