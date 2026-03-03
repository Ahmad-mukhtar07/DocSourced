import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { StripeReturnBanner } from '../components/StripeReturnBanner';
import './CheckoutSuccessPage.css';

/**
 * Shown after Stripe Checkout success (success_url).
 * Revalidates subscription status on load and shows a confirmation banner
 * so the UI reflects the latest profiles.tier without a manual refresh.
 */
export function CheckoutSuccessPage() {
  const { refetchSubscription } = useAuth();
  const [revalidated, setRevalidated] = useState(false);

  // Revalidate tier on mount so Navbar and banner show current plan.
  useEffect(() => {
    let cancelled = false;
    refetchSubscription?.().then(() => {
      if (!cancelled) setRevalidated(true);
    });
    return () => { cancelled = true; };
  }, [refetchSubscription]);

  return (
    <div className="checkout-result">
      <div className="checkout-result__wrap">
        {revalidated && (
          <StripeReturnBanner variant="success" />
        )}
        <div className="checkout-result__card">
          <h1 className="checkout-result__title">Thank you!</h1>
          <p className="checkout-result__message">
            Your Pro subscription is active. You can now use Pro features in the extension.
          </p>
          <Link to="/" className="checkout-result__link">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}
