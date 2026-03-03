/**
 * Styled upgrade prompt shown when a Free user tries to access Pro-only content.
 * Used by ProRoute and ProGate. Offers "Upgrade to Pro" when logged in, or
 * "Log in to upgrade" when not, so tier-based access control has a clear CTA.
 */
import { handleUpgradeToProWithUser } from '../lib/ctaHandlers';
import { useAuth } from '../contexts/AuthContext';
import { supabaseClient } from '../config/supabase-config';
import './UpgradePrompt.css';

export function UpgradePrompt({
  title = 'Pro feature',
  message = 'Upgrade to Pro to unlock this feature and get unlimited snips, multi-document support, and more.',
  className = '',
}) {
  const { user, loading, signInWithGoogle, isSupabaseConfigured } = useAuth();
  const canUpgrade = isSupabaseConfigured && !loading && user;

  const handleCta = () => {
    if (canUpgrade) {
      handleUpgradeToProWithUser(supabaseClient);
    } else {
      signInWithGoogle();
    }
  };

  return (
    <section
      className={`upgrade-prompt ${className}`.trim()}
      aria-labelledby="upgrade-prompt-title"
    >
      <div className="upgrade-prompt__inner">
        <h2 id="upgrade-prompt-title" className="upgrade-prompt__title">
          {title}
        </h2>
        <p className="upgrade-prompt__message">{message}</p>
        <button
          type="button"
          className="upgrade-prompt__cta navbar__btn navbar__btn--primary"
          onClick={handleCta}
        >
          {canUpgrade ? 'Upgrade to Pro' : 'Log in to upgrade'}
        </button>
      </div>
    </section>
  );
}
