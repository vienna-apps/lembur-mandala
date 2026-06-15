import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

/**
 * PATCH /api/profile
 * Body: { gmail: string | null }
 * Sets (or clears) the user's gmail for password reset.
 * Also updates the Supabase auth email so resets go to the real inbox.
 */
export async function PATCH(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const gmail: string | null = body.gmail?.trim() || null

  if (gmail !== null) {
    // Validate format: must end with @daksa.co.id
    if (!gmail.toLowerCase().endsWith('@daksa.co.id')) {
      return NextResponse.json({ error: 'Gmail harus format xxx@daksa.co.id' }, { status: 400 })
    }
    if (!/^[^\s@]+@daksa\.co\.id$/i.test(gmail)) {
      return NextResponse.json({ error: 'Format email tidak valid.' }, { status: 400 })
    }
  }

  const db = getAdminClient()

  // Update auth email so Supabase can send real password-reset emails
  const newAuthEmail = gmail ?? `${user.email?.split('@')[0]}@lembur`
  const { error: authErr } = await db.auth.admin.updateUserById(user.id, {
    email: newAuthEmail,
    email_confirm: true,
  })
  if (authErr) return NextResponse.json({ error: authErr.message }, { status: 500 })

  // Update profile
  const { error: profileErr } = await db
    .from('profiles')
    .update({ gmail })
    .eq('id', user.id)
  if (profileErr) return NextResponse.json({ error: profileErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, gmail })
}
