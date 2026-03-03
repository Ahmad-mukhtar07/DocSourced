// Server-side subscription validation: returns the authenticated user's tier and subscription
// data from the database. The client must not trust its own state for billing or access control—
// this function verifies the JWT and reads from the DB so subscription status cannot be tampered
// with client-side. Use the returned tier/status for UI and for enforcing Pro features.
//
// Security: We validate the JWT (getUser) and then fetch with the service role so the response
// is authoritative. Invalid or missing JWT → 401. Returns a consistent shape so the frontend
// can rely on it without parsing multiple tables.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

const PROFILES_TABLE = 'profiles'
const SUBSCRIPTIONS_TABLE = 'subscriptions'

/** Normalize tier to 'free' | 'pro' for consistent API. */
function normalizeTier(t: string | null | undefined): 'free' | 'pro' {
  const s = (t ?? 'free').toString().toLowerCase()
  return s === 'pro' ? 'pro' : 'free'
}

Deno.serve(async (req) => {
  try {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Missing or invalid Authorization header' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('SUPABASE_URL or SUPABASE_ANON_KEY not set')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }
  if (!serviceRoleKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) not set')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  // Validate JWT: only the authenticated user id is trusted after this.
  const authClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: { user }, error: authError } = await authClient.auth.getUser()
  if (authError || !user) {
    return jsonResponse(
      { error: 'Unauthorized', details: authError?.message ?? 'No user' },
      401
    )
  }

  const userId = user.id

  // Fetch profile and subscription server-side with service role so the result is authoritative
  // and cannot be spoofed by the client. RLS is bypassed; we only return data for the user
  // we just verified via JWT.
  const adminClient = createClient(supabaseUrl, serviceRoleKey)

  const [profileRes, subRes] = await Promise.all([
    adminClient
      .from(PROFILES_TABLE)
      .select('tier, full_name, email')
      .eq('id', userId)
      .maybeSingle(),
    adminClient
      .from(SUBSCRIPTIONS_TABLE)
      .select('status, current_period_end, cancel_at_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
  ])

  if (profileRes.error) {
    console.error('get-user-subscription profiles error', profileRes.error)
    return jsonResponse({ error: 'Failed to load subscription' }, 500)
  }
  if (subRes.error) {
    console.error('get-user-subscription subscriptions error', subRes.error)
    return jsonResponse({ error: 'Failed to load subscription' }, 500)
  }

  const profile = profileRes.data
  const sub = subRes.data

  // Tier: use profile.tier when set; if the user has an active subscription row but profile
  // still shows 'free' (e.g. webhook didn't run or subscription predates webhook), treat them as Pro
  // and sync profile so the DB stays correct.
  const subscriptionActive = sub && ['active', 'trialing'].includes(String(sub.status).toLowerCase())
  let tier = normalizeTier(profile?.tier)
  if (subscriptionActive) {
    tier = 'pro'
    if (profile && String(profile.tier || '').toLowerCase() !== 'pro') {
      try {
        const { error: updateErr } = await adminClient.from(PROFILES_TABLE).update({ tier: 'pro' }).eq('id', userId)
        if (updateErr) console.error('get-user-subscription profile tier sync failed', updateErr)
      } catch (e) {
        console.error('get-user-subscription profile update threw', e)
      }
    }
  }

  const payload = {
    tier,
    full_name: profile?.full_name ?? null,
    email: profile?.email ?? user.email ?? null,
    status: sub?.status ?? null,
    current_period_end: sub?.current_period_end ?? null,
    cancel_at_period_end: sub?.cancel_at_period_end ?? false,
  }

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
  } catch (err) {
    console.error('get-user-subscription uncaught error', err)
    return jsonResponse(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      500
    )
  }
})
