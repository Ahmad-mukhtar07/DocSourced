import { Link } from 'react-router-dom';
import { Container } from '../components/ui/Container';
import { Section } from '../components/ui/Section';
import { productName } from '../content/placeholders';
import './TermsOfServicePage.css';

export function TermsOfServicePage() {
  return (
    <div className="terms-page">
      <Section>
        <Container className="terms-page__container">
          <Link to="/" className="terms-page__back">
            ← Back to home
          </Link>
          <h1 className="terms-page__title">Terms of Service</h1>
          <p className="terms-page__updated">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>

          <div className="terms-page__content">
            <p className="terms-page__intro">
              These Terms of Service (“Terms”) govern your use of the {productName} Chrome extension and related
              website (collectively, the “Service”). By using the Service, you agree to these Terms.
            </p>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">1. Acceptance</h2>
              <p>
                By installing the extension, creating an account, or otherwise using the Service, you agree to be
                bound by these Terms and our Privacy Policy. If you do not agree, do not use the Service.
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">2. Description of the Service</h2>
              <p>
                {productName} allows you to capture text and images from web pages (“snips”) and insert them into
                your Google Docs with source references. Free and Pro plans are available; Pro features (e.g. Format
                References, multi-document support) require a paid subscription. We may change, suspend, or
                discontinue parts of the Service with reasonable notice where feasible.
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">3. Account and eligibility</h2>
              <p>
                You must be at least 13 years old (or the minimum age in your jurisdiction) to use the Service. You
                are responsible for keeping your account credentials secure and for all activity under your
                account. You must provide accurate information when signing up and keep it updated.
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">4. Acceptable use</h2>
              <p>
                You agree not to use the Service to violate any law, infringe others’ rights, or transmit harmful
                or illegal content. You must not attempt to circumvent usage limits, reverse engineer the
                Service, or use it to build a competing product. We may suspend or terminate your access if we
                reasonably believe you have violated these Terms.
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">5. Subscriptions and payments</h2>
              <p>
                Pro subscriptions are billed through Stripe. By subscribing, you agree to Stripe’s terms and to
                pay all applicable fees. Fees are non-refundable except as required by law or as stated in our
                refund policy. You may cancel your subscription at any time; access continues until the end of the
                current billing period. We may change subscription prices with reasonable notice.
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">6. Intellectual property</h2>
              <p>
                The Service (including software, design, and content we provide) is owned by us or our licensors.
                We grant you a limited, non-exclusive license to use the Service for your personal or internal
                business use in accordance with these Terms. You retain ownership of your snips and documents; you
                grant us the rights necessary to operate the Service (e.g. storing and processing your data).
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">7. Disclaimers</h2>
              <p>
                The Service is provided “as is” and “as available” without warranties of any kind, express or
                implied. We do not guarantee that the Service will be uninterrupted, error-free, or secure. You
                use the Service at your own risk.
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">8. Limitation of liability</h2>
              <p>
                To the maximum extent permitted by law, we (and our affiliates, directors, and employees) are not
                liable for any indirect, incidental, special, consequential, or punitive damages, or for loss of
                data, profits, or business opportunity, arising from your use of the Service. Our total liability
                is limited to the amount you paid us in the twelve months before the claim (or one hundred
                dollars if greater).
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">9. Changes to the Terms</h2>
              <p>
                We may update these Terms from time to time. We will post the updated Terms on this page and
                update the “Last updated” date. Continued use of the Service after changes constitutes acceptance
                of the updated Terms. If you do not agree, you must stop using the Service.
              </p>
            </section>

            <section className="terms-page__section">
              <h2 className="terms-page__heading">10. Contact</h2>
              <p>
                For questions about these Terms, contact us at{' '}
                <a href="mailto:ahmadmukhtar2001@gmail.com" className="terms-page__link">
                  ahmadmukhtar2001@gmail.com
                </a>.
              </p>
            </section>
          </div>
        </Container>
      </Section>
    </div>
  );
}
