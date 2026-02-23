/**
 * Centralized feature access hook. Reads tier from AuthContext and exposes
 * flags for unlimited snips, multiple docs, and snip history.
 * Use to gate UI and to show upgrade prompts when a feature is blocked.
 */
import { useAuth } from './useAuth.js';
import { getFeatureAccess } from '../lib/featureAccess.js';

/**
 * @returns {{
 *   tier: string | null,
 *   canUseUnlimitedSnips: boolean,
 *   canUseMultipleDocs: boolean,
 *   canAccessSnipHistory: boolean,
 *   isPro: boolean,
 *   showUpgrade: (reason: 'snip_limit' | 'doc_limit' | 'snip_history') => void
 * }}
 * showUpgrade is a callback you can pass to children (e.g. setShowUpgradeModal(true) with a reason).
 */
export function useFeatureAccess() {
  const { tier } = useAuth();
  const access = getFeatureAccess(tier);
  return {
    ...access,
    tier,
    /** Call when you want to show the upgrade modal; pass reason so modal can show the right message. */
    showUpgrade: () => {}, // Caller controls modal state; use UpgradeModal with reason prop
  };
}
