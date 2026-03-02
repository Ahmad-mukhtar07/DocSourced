import { useState, useCallback } from 'react';
import { signInWithGoogle } from '../lib/supabaseGoogleAuth.js';
import docSourcedLogo from '../assets/DocSourced-logo.png';
import './LoginPage.css';

/**
 * Supabase login page: "Continue with Google" only.
 * On success, parent should show dashboard (auth state updates via useAuth).
 */
export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGoogleSignIn = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await signInWithGoogle();
      if (err) setError(err);
    } catch (e) {
      setError(e?.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="login-page">
      <header className="login-page__header">
        <img src={docSourcedLogo} alt="" className="login-page__logo" aria-hidden />
        <h1 className="login-page__title">DocSourced</h1>
        <p className="login-page__subtitle">Capture fast. Format clean. Reference intelligently.</p>
      </header>
      <main className="login-page__body">
        <button
          type="button"
          className="login-page__google-btn"
          onClick={handleGoogleSignIn}
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? (
            <span className="login-page__btn-text">Signing in…</span>
          ) : (
            <>
              <span className="login-page__google-icon" aria-hidden />
              <span className="login-page__btn-text">Continue with Google</span>
            </>
          )}
        </button>
        {error && (
          <p className="login-page__error" role="alert">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}
