import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null
let _adminClient: SupabaseClient | null = null

export function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _client = createClient(url, key)
  }
  return _client
}

export function getAdminClient(): SupabaseClient {
  if (!_adminClient) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) throw new Error('Supabase env vars not set')
    _adminClient = createClient(url, key)
  }
  return _adminClient
}
