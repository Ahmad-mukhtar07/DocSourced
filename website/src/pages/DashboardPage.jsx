/**
 * Pro-only dashboard page. Access is enforced by ProRoute in App.jsx:
 * only users with profiles.tier === 'pro' see this content. Free users
 * see the UpgradePrompt instead (handled by ProRoute).
 */
import { Link } from 'react-router-dom';
import { Container } from '../components/ui/Container';
import { Section } from '../components/ui/Section';
import './DashboardPage.css';

export function DashboardPage() {
  return (
    <div className="dashboard-page">
      <Section>
        <Container>
          <h1 className="dashboard-page__title">Pro Dashboard</h1>
          <p className="dashboard-page__lead">
            You have access to Pro features. Manage your account and subscription from here.
          </p>
          <Link to="/" className="dashboard-page__link">
            ← Back to home
          </Link>
        </Container>
      </Section>
    </div>
  );
}
