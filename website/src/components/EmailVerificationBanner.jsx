/**
 * Shown when the user is logged in but their email is not yet verified (e.g. email_confirmed_at is null).
 * Supabase sets email_confirmed_at when the provider (e.g. Google) confirms the email; for Google OAuth
 * it is usually set immediately. Dismissible via sessionStorage so we don't repeat every page load.
 */
import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './OnboardingBanners.css';

const STORAGE_KEY = 'docSourcedEmailBannerDismissed';

export function EmailVerificationBanner() {
  const { user, loading, emailVerified } = useAuth();
  const [dismissed, setDismissed] = useState(true); // start true so we don't flash

  useEffect(() => {
    if (typeof sessionStorage === 'undefined') return;
    setDismissed(sessionStorage.getItem(STORAGE_KEY) === '1');
  }, []);

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, '1');
    setDismissed(true);
  };

  const show = !loading && user && !emailVerified && !dismissed;

  if (!show) return null;

  return (
    <div className="onboarding-banner onboarding-banner--email" role="status" aria-live="polite">
      <div className="onboarding-banner__inner">
        <p className="onboarding-banner__text">
          Please verify your email to access all features. Check your inbox for a confirmation link.
        </p>
        <button
          type="button"
          className="onboarding-banner__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    </div>
  );
}
