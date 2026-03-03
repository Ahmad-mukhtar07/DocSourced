/**
 * ProGate: feature gating for Pro-only content.
 *
 * How tier-based access control works:
 * - Tier comes from public.profiles.tier, synced with Supabase on login and
 *   on auth state change (see AuthContext). The stripe-webhook updates profiles.tier
 *   when subscriptions change, so this check stays in sync with billing state.
 * - We delay rendering protected content until subscription status is confirmed
 *   (subscriptionLoading === false when user is set) to prevent UI flicker:
 *   we never briefly show Pro content before tier has loaded.
 * - If the user is not logged in, or profiles.tier !== 'pro', we show the
 *   UpgradePrompt section instead of children. The check runs on page load and
 *   whenever auth/tier changes (e.g. after login or returning from Stripe).
 */
import { useAuth } from '../contexts/AuthContext';
import { UpgradePrompt } from './UpgradePrompt';
import './ProGate.css';

/**
 * Renders children only when profiles.tier === 'pro'. Otherwise shows a loading
 * state (while tier is being fetched) or the UpgradePrompt. Use for Pro-only
 * sections or components inside a page.
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - Pro-only content to render when tier is 'pro'
 * @param {string} [props.upgradeTitle] - Title for the upgrade prompt
 * @param {string} [props.upgradeMessage] - Message for the upgrade prompt
 */
export function ProGate({ children, upgradeTitle, upgradeMessage }) {
  const { user, loading, tier, subscriptionLoading } = useAuth();

  // While auth is loading we don't know if there's a user; show loading to avoid flicker.
  const authResolved = !loading;
  // When user is set, wait for tier to be fetched (subscriptionLoading false) before showing content or prompt.
  const tierResolved = !user || !subscriptionLoading;
  const tierConfirmed = authResolved && tierResolved;

  const hasPro = Boolean(user && tier === 'pro');

  if (!tierConfirmed) {
    return (
      <div className="pro-gate pro-gate--loading" aria-busy="true" aria-live="polite">
        <div className="pro-gate__spinner" aria-hidden />
        <p className="pro-gate__loading-text">Checking access…</p>
      </div>
    );
  }

  if (!hasPro) {
    return (
      <UpgradePrompt
        title={upgradeTitle ?? 'Pro feature'}
        message={upgradeMessage ?? 'Upgrade to Pro to unlock this feature and get unlimited snips, multi-document support, and more.'}
        className="pro-gate__upgrade"
      />
    );
  }

  return <>{children}</>;
}
