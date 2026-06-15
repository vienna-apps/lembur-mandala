import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// GET /api/months/[bulan] — month detail + events for current user
export async function GET(req: NextRequest, { params }: { params: Promise<{ bulan: string }> }) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bulan } = await params
  const db = getAdminClient()

  const { data: month } = await db
    .from('lembur_months')
    .select('*')
    .eq('user_id', user.id)
    .eq('bulan', bulan)
    .single()

  if (!month) return NextResponse.json({ month: null, events: [] })

  const { data: events } = await db
    .from('lembur_events')
    .select('*')
    .eq('month_id', month.id)
    .order('hari_tanggal', { ascending: true })

  return NextResponse.json({ month, events: events ?? [] })
}

// PATCH /api/months/[bulan] — update status (submit / unsubmit)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ bulan: string }> }) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bulan } = await params
  const { status } = await req.json()
  if (!['draft', 'submitted'].includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const db = getAdminClient()
  const { data, error } = await db
    .from('lembur_months')
    .update({
      status,
      submitted_at: status === 'submitted' ? new Date().toISOString() : null,
    })
    .eq('user_id', user.id)
    .eq('bulan', bulan)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
