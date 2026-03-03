// validate-access: minimal server-side access check for Pro features.
//
// SECURITY — Prevents client-side tampering and keeps website + extension in sync:
// - The client (website or Chrome extension) sends only the JWT. Tier is never trusted from
//   client state: we verify the JWT with Supabase Auth, then read profiles.tier and
//   subscriptions from the database using the service role. The response is the single
//   source of truth for "is this user allowed Pro features?"
// - If the extension or website cached an old tier (e.g. "pro"), a periodic call to
//   validate-access will return { pro: false } after cancellation, so the client can
//   immediately downgrade UI and disable Pro-only features. No local tampering can
//   grant Pro access because every enforcement path (RPC limits, UI) should ultimately
//   rely on server-verified state; this endpoint provides that state for the client.
//
// Returns a minimal payload { pro: boolean } so the extension can revalidate on startup
// and on a timer without heavy payloads. Same tier logic as get-user-subscription:
// profiles.tier === 'pro' OR an active/trialing subscription row grants Pro.

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
      console.error('validate-access: SUPABASE_URL or SUPABASE_ANON_KEY not set')
      return jsonResponse({ error: 'Server configuration error' }, 500)
    }
    if (!serviceRoleKey) {
      console.error('validate-access: SUPABASE_SERVICE_ROLE_KEY not set')
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const [profileRes, subRes] = await Promise.all([
      adminClient.from(PROFILES_TABLE).select('tier').eq('id', userId).maybeSingle(),
      adminClient.from(SUBSCRIPTIONS_TABLE).select('status').eq('user_id', userId).maybeSingle(),
    ])

    if (profileRes.error) {
      console.error('validate-access profiles error', profileRes.error)
      return jsonResponse({ error: 'Failed to load access' }, 500)
    }
    if (subRes.error) {
      console.error('validate-access subscriptions error', subRes.error)
      return jsonResponse({ error: 'Failed to load access' }, 500)
    }

    const profile = profileRes.data
    const sub = subRes.data

    // Same logic as get-user-subscription: active/trialing subscription => Pro even if profile.tier is stale.
    const subscriptionActive = sub && ['active', 'trialing'].includes(String(sub.status).toLowerCase())
    let tier = normalizeTier(profile?.tier)
    if (subscriptionActive) tier = 'pro'

    return jsonResponse({ pro: tier === 'pro' }, 200)
  } catch (err) {
    console.error('validate-access uncaught error', err)
    return jsonResponse(
      { error: 'Internal server error', details: err instanceof Error ? err.message : String(err) },
      500
    )
  }
})
