import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { StripeReturnBanner } from '../components/StripeReturnBanner';
import './CheckoutCancelPage.css';

/**
 * Shown when user cancels Stripe Checkout (cancel_url).
 * Revalidates subscription status on load and shows a confirmation banner.
 */
export function CheckoutCancelPage() {
  const { refetchSubscription } = useAuth();
  const [revalidated, setRevalidated] = useState(false);

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
          <StripeReturnBanner variant="cancel" />
        )}
        <div className="checkout-result__card">
          <h1 className="checkout-result__title">Checkout canceled</h1>
          <p className="checkout-result__message">
            You can upgrade to Pro anytime from the Pricing section.
          </p>
          <Link to="/#pricing" className="checkout-result__link">
            Back to pricing
          </Link>
        </div>
      </div>
    </div>
  );
}
