/**
 * Lightweight onboarding banner for free-tier users: explains Free vs Pro and prompts upgrade.
 * Shown once per device (localStorage). Ensures new users understand the plan before using
 * subscription/billing features; tier and profile are already synced from Supabase by AuthContext.
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './OnboardingBanners.css';

const STORAGE_KEY = 'docSourcedOnboardingBannerDismissed';

export function OnboardingBanner() {
  const { user, loading, tier, subscriptionLoading } = useAuth();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    setDismissed(localStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  const isFree = tier === 'free' || (!tier && !subscriptionLoading);
  const show = !loading && user && isFree && !subscriptionLoading && !dismissed;

  if (!show) return null;

  return (
    <div className="onboarding-banner onboarding-banner--onboarding" role="region" aria-labelledby="onboarding-banner-heading">
      <div className="onboarding-banner__inner onboarding-banner__inner--wide">
        <h2 id="onboarding-banner-heading" className="onboarding-banner__heading">
          You're on the Free plan
        </h2>
        <p className="onboarding-banner__text">
          Free includes one connected doc, 25 snips/month, and source links. Upgrade to Pro for
          multi-document support, Format References (superscript citations + Sources section), and
          Snip History.
        </p>
        <div className="onboarding-banner__actions">
          <Link
            to="/dashboard"
            className="onboarding-banner__cta navbar__btn navbar__btn--primary"
          >
            Upgrade to Pro
          </Link>
          <a href="/#pricing" className="onboarding-banner__link">
            View pricing
          </a>
        </div>
        <button
          type="button"
          className="onboarding-banner__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          ×
        </button>
      </div>
    </div>
  );
}
