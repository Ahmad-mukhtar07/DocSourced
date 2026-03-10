/**
 * Centralized feature access by tier. Pro bypasses limits; free has restrictions.
 * Tier is server-verified (validate-access Edge Function) so client cannot tamper;
 * use with useFeatureAccess hook (reads tier from AuthContext) or featureGate() for non-React code.
 */

export const FEATURES = {
  /** Unlimited snips per month (free = 15/month) */
  UNLIMITED_SNIPS: 'pro',
  /** Connect more than one document (free = 1 doc) */
  MULTIPLE_DOCS: 'pro',
  /** Access Snip History panel and list (free = no access) */
  SNIP_HISTORY: 'pro',
};

const TIER_ORDER = ['free', 'pro', 'premium', 'enterprise'];

/**
 * Check if a tier has access to a feature (required tier string, e.g. 'pro').
 * @param {string | null} tier - User's tier from profiles (null = treat as free)
 * @param {string} requiredTier - Minimum tier for the feature (e.g. 'pro')
 * @returns {boolean}
 */
export function featureGate(tier, requiredTier) {
  if (!requiredTier) return true;
  const t = (tier || 'free').toLowerCase();
  const idx = TIER_ORDER.indexOf(t);
  const reqIdx = TIER_ORDER.indexOf(requiredTier.toLowerCase());
  return reqIdx !== -1 && idx >= reqIdx;
}

/**
 * Feature access flags derived from tier. Use in UI to show/hide or enable/disable.
 * @param {string | null} tier
 * @returns {{ canUseUnlimitedSnips: boolean, canUseMultipleDocs: boolean, canAccessSnipHistory: boolean, isPro: boolean }}
 */
export function getFeatureAccess(tier) {
  const isPro = featureGate(tier, 'pro');
  return {
    canUseUnlimitedSnips: isPro,
    canUseMultipleDocs: isPro,
    canAccessSnipHistory: isPro,
    isPro,
  };
}
