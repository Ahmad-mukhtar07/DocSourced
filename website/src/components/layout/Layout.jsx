import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { EmailVerificationBanner } from '../EmailVerificationBanner';
import { OnboardingBanner } from '../OnboardingBanner';
import { handleCheckoutReturn } from '../../lib/ctaHandlers';
import './Layout.css';

export function Layout() {
  // Handle Stripe success/cancel return (query params on any page).
  useEffect(() => {
    handleCheckoutReturn();
  }, []);

  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navbar />
      {/* Onboarding: email verification (if not verified) and Free vs Pro banner for new/free users. */}
      <EmailVerificationBanner />
      <OnboardingBanner />
      <main id="main-content" className="layout__main" tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
