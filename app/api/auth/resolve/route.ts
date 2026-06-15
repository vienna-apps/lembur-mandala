import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/db'

/**
 * GET /api/auth/resolve?username=vania
 * Public endpoint — returns the Supabase auth email to sign in with.
 * If the user has set a gmail, their auth email was updated to that gmail.
 * Otherwise it's {username}@lembur (the internal placeholder).
 */
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get('username')?.trim().toLowerCase()
  if (!username) return NextResponse.json({ error: 'username required' }, { status: 400 })

  const { data: profile, error } = await getAdminClient()
    .from('profiles')
    .select('username, gmail')
    .eq('username', username)
    .maybeSingle()

  if (error || !profile) {
    return NextResponse.json({ error: 'User tidak ditemukan.' }, { status: 404 })
  }

  // If gmail is set, auth email was updated to gmail.
  // Otherwise, auth email is the internal {username}@lembur placeholder.
  const email = profile.gmail ?? `${username}@lembur`

  return NextResponse.json({ email, hasGmail: !!profile.gmail })
}
