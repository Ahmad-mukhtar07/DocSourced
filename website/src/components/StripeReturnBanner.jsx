import { useState } from 'react';
import './StripeReturnBanner.css';

/**
 * Dismissible confirmation banner shown on /success or /cancel after subscription
 * status has been revalidated. Inline with the page so the user sees that their
 * tier was synced without needing a manual refresh.
 */
export function StripeReturnBanner({ variant, onDismiss }) {
  const [dismissed, setDismissed] = useState(false);

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  if (dismissed) return null;

  const isSuccess = variant === 'success';
  return (
    <div
      className={`stripe-return-banner stripe-return-banner--${variant}`}
      role="status"
      aria-live="polite"
    >
      <div className="stripe-return-banner__inner">
        <p className="stripe-return-banner__text">
          {isSuccess
            ? "Your subscription is now active. You're on the Pro plan."
            : 'Checkout was canceled. Your plan is unchanged.'}
        </p>
        <button
          type="button"
          className="stripe-return-banner__dismiss"
          onClick={handleDismiss}
          aria-label="Dismiss banner"
        >
          ×
        </button>
      </div>
    </div>
  );
}
