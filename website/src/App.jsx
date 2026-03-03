import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SubscriptionRefetchOnReturn } from './components/SubscriptionRefetchOnReturn';
import { ProRoute } from './components/ProRoute';
import { Layout } from './components/layout/Layout';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { CheckoutSuccessPage } from './pages/CheckoutSuccessPage';
import { CheckoutCancelPage } from './pages/CheckoutCancelPage';

export default function App() {
  return (
    <AuthProvider>
      <SubscriptionRefetchOnReturn />
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/success" element={<CheckoutSuccessPage />} />
        <Route path="/cancel" element={<CheckoutCancelPage />} />
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          {/* Pro-only route: ProRoute checks profiles.tier === 'pro' before rendering; otherwise shows upgrade prompt. */}
          <Route path="dashboard" element={<ProRoute><DashboardPage /></ProRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </AuthProvider>
  );
}
