/**
 * Server-verified access validation for the Chrome extension.
 *
 * SECURITY — Subscription validation must be done server-side so Pro access cannot be
 * tampered with client-side. The validate-access Edge Function verifies the JWT and
 * reads profiles.tier (and subscriptions) from the database with the service role,
 * then returns only { pro: boolean }. The extension must use this result (and never
 * trust local profile.tier from a direct table read) to gate Pro features. This
 * keeps website and extension fully in sync: both call server endpoints that read
 * the same DB; when a user cancels on the website, the next validate-access call
 * in the extension returns pro: false and the UI downgrades immediately.
 *
 * - Call on startup (when the popup/side panel opens with a session) and periodically
 *   (e.g. every 2 hours) so subscription status is always up to date.
 * - On any network/API error we return { pro: false, error } so the extension never
 *   crashes and defaults to free-tier behavior (graceful downgrade).
 */

import { supabaseClient, isSupabaseConfigured } from '../config/supabase-config.js';

const STORAGE_KEY_TIER = 'eznote_pro_tier';

/**
 * Persist the server-verified tier to chrome.storage so the background script or
 * next open can read it. Used for consistent UI and for any logic that needs
 * last-known tier when offline.
 * @param {'pro' | 'free'} tier
 */
export function persistTierToStorage(tier) {
  if (typeof chrome !== 'undefined' && chrome?.storage?.local?.set) {
    chrome.storage.local.set({ [STORAGE_KEY_TIER]: tier });
  }
}

/**
 * Read last-known tier from storage (may be stale; re-validate when online).
 * @returns {Promise<'pro' | 'free' | null>}
 */
export function getStoredTier() {
  if (typeof chrome !== 'undefined' && chrome?.storage?.local?.get) {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY_TIER], (data) => {
        const t = data?.[STORAGE_KEY_TIER];
        resolve(t === 'pro' || t === 'free' ? t : null);
      });
    });
  }
  return Promise.resolve(null);
}

/**
 * Call the validate-access Edge Function to get the authoritative Pro status for
 * the current user. Never throws — on failure returns { pro: false, error } so the
 * extension can gracefully downgrade and show free-tier UI.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient | null} client - Supabase client (from config).
 * @param {string} accessToken - Valid JWT (e.g. from session.access_token).
 * @returns {Promise<{ pro: boolean, error?: string }>}
 */
export async function validateAccess(client, accessToken) {
  if (!isSupabaseConfigured || !client || !accessToken || typeof accessToken !== 'string') {
    return { pro: false, error: 'Not configured or not authenticated' };
  }

  try {
    const { data, error } = await client.functions.invoke('validate-access', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (error) {
      return { pro: false, error: error.message || 'Validation failed' };
    }

    if (data && typeof data.pro === 'boolean') {
      return { pro: data.pro };
    }

    if (data?.error) {
      return { pro: false, error: data.details || data.error };
    }

    return { pro: false, error: 'Invalid response' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { pro: false, error: message };
  }
}
