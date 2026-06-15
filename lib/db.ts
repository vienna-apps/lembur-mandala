import { createClient, SupabaseClient } from '@supabase/supabase-js'

// ── Server-side admin client (service role, bypasses RLS) ────────────────────
// Used only in API route handlers.
let _adminClient: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _adminClient = createClient(url, key, { auth: { persistSession: false } })
  }
  return _adminClient
}

// ── Verify a user token and return their profile ─────────────────────────────
// API routes call this to authenticate requests.
export async function verifyToken(token: string): Promise<{ id: string; email: string } | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data.user) return null
  return { id: data.user.id, email: data.user.email ?? '' }
}
