/**
 * Server-verified subscription state. Subscription validation must be done server-side
 * so the tier and status cannot be tampered with by the client. The get-user-subscription
 * Edge Function validates the JWT and reads from the database with the service role,
 * then returns a consistent payload. We call this on page load and after auth changes
 * instead of querying profiles/subscriptions directly from the client.
 *
 * Scheduled downgrades: tier (from profiles.tier) is only set to 'free' by the stripe-webhook
 * when the subscription is fully canceled (e.g. customer.subscription.deleted after
 * current_period_end). So when cancel_at_period_end is true, Pro features remain accessible
 * until current_period_end; we do not prematurely restrict access. The UI shows a warning
 * banner on the dashboard; after the user returns from the Billing Portal (e.g. after
 * reversing cancellation), revalidation on page load or dashboard mount reflects the update.
 *
 * Returns: { data: { tier, full_name, email, status, current_period_end, cancel_at_period_end } } or { error }.
 */

/**
 * Fetches the authenticated user's subscription from the get-user-subscription Edge Function.
 * Use this instead of direct Supabase table queries so tier and subscription status are
 * server-verified and cannot be spoofed client-side.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabaseClient
 * @returns {Promise<{ data?: { tier: 'free'|'pro', full_name: string|null, email: string|null, status: string|null, current_period_end: string|null, cancel_at_period_end: boolean }, error?: string }>}
 */
export async function fetchUserSubscription(supabaseClient) {
  if (!supabaseClient) return { error: 'Supabase not configured' };
  const { data: { session: refreshed } } = await supabaseClient.auth.refreshSession();
  const session = refreshed ?? (await supabaseClient.auth.getSession()).data?.session;
  if (!session?.access_token) return { error: 'Not logged in' };

  const { data, error } = await supabaseClient.functions.invoke('get-user-subscription', {
    method: 'GET',
    headers: { Authorization: `Bearer ${session.access_token}` },
  });

  if (error) {
    const message = typeof data?.error === 'string' ? data.error : (data?.details ?? error.message);
    return { error: message || 'Subscription check failed' };
  }
  if (data?.error) return { error: data.details || data.error };
  if (!data || typeof data.tier === 'undefined') return { error: 'Invalid subscription response' };

  return {
    data: {
      tier: data.tier === 'pro' ? 'pro' : 'free',
      full_name: data.full_name ?? null,
      email: data.email ?? null,
      status: data.status ?? null,
      current_period_end: data.current_period_end ?? null,
      cancel_at_period_end: Boolean(data.cancel_at_period_end),
    },
  };
}
