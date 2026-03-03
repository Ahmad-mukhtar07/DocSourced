/**
 * ProRoute: route-level protection for Pro-only pages.
 *
 * Wraps a route element and enforces profiles.tier === 'pro' before rendering
 * the page. Uses the same tier logic as ProGate (synced with Supabase via
 * AuthContext). Runs on page load and on auth state changes; shows a loading
 * state until subscription status is confirmed to prevent UI flicker.
 */
import { useAuth } from '../contexts/AuthContext';
import { UpgradePrompt } from './UpgradePrompt';
import './ProRoute.css';

/**
 * Renders children (the Pro-only page) only when profiles.tier === 'pro'.
 * Otherwise shows loading or the full-page UpgradePrompt. Use as the route element:
 *
 *   <Route path="/dashboard" element={<ProRoute><DashboardPage /></ProRoute>} />
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The Pro-only page component
 * @param {string} [props.upgradeTitle] - Title for the upgrade prompt
 * @param {string} [props.upgradeMessage] - Message for the upgrade prompt
 */
export function ProRoute({ children, upgradeTitle, upgradeMessage }) {
  const { user, loading, tier, subscriptionLoading } = useAuth();

  const authResolved = !loading;
  const tierResolved = !user || !subscriptionLoading;
  const tierConfirmed = authResolved && tierResolved;

  const hasPro = Boolean(user && tier === 'pro');

  if (!tierConfirmed) {
    return (
      <div className="pro-route pro-route--loading" aria-busy="true" aria-live="polite">
        <div className="pro-route__spinner" aria-hidden />
        <p className="pro-route__loading-text">Checking access…</p>
      </div>
    );
  }

  if (!hasPro) {
    return (
      <div className="pro-route pro-route__fallback">
        <UpgradePrompt
          title={upgradeTitle ?? 'Pro required'}
          message={upgradeMessage ?? 'This page is for Pro subscribers. Upgrade to unlock dashboard and all Pro features.'}
          className="pro-route__upgrade"
        />
      </div>
    );
  }

  return <>{children}</>;
}
