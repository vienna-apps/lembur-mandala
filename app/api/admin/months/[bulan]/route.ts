import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// GET /api/admin/months/[bulan] — all submissions for a month (admin only)
export async function GET(req: NextRequest, { params }: { params: Promise<{ bulan: string }> }) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getAdminClient()
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { bulan } = await params

  // All month records for this bulan, with profile + events
  const { data: months, error } = await db
    .from('lembur_months')
    .select(`*, profile:profiles(*), events:lembur_events(*)`)
    .eq('bulan', bulan)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Deadline for this bulan
  const { data: deadline } = await db.from('deadlines').select('*').eq('bulan', bulan).single()

  return NextResponse.json({ months: months ?? [], deadline: deadline ?? null })
}
