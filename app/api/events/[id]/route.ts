import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'
import { calcKompensasi } from '@/lib/calculations'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// PUT /api/events/[id] — update event
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { hari_tanggal, project, kegiatan, dari_jam, sampai_jam, durasi, standby, akhir_pekan, wfo } = body

  const total_jam = calcKompensasi(Number(durasi), Boolean(standby), Boolean(akhir_pekan), Boolean(wfo))

  const db = getAdminClient()
  const { data, error } = await db
    .from('lembur_events')
    .update({ hari_tanggal, project, kegiatan, dari_jam, sampai_jam, durasi: Number(durasi), standby, akhir_pekan, wfo, total_jam })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// DELETE /api/events/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const db = getAdminClient()
  const { error } = await db
    .from('lembur_events')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
