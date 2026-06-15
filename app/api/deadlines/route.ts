import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// GET /api/deadlines — all deadlines (public-ish, any logged-in user can read)
export async function GET(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getAdminClient()
  const { data } = await db.from('deadlines').select('*').order('bulan', { ascending: false })
  return NextResponse.json(data ?? [])
}

// PUT /api/deadlines — upsert deadline for a bulan (admin only)
export async function PUT(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getAdminClient()
  // Verify admin
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { bulan, deadline_date } = await req.json()
  if (!bulan) return NextResponse.json({ error: 'bulan required' }, { status: 400 })

  const { data, error } = await db
    .from('deadlines')
    .upsert({ bulan, deadline_date: deadline_date || null, updated_at: new Date().toISOString() }, { onConflict: 'bulan' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
