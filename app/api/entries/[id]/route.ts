import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/db'
import { calcKompensasi } from '@/lib/calculations'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { error } = await getAdminClient().from('lembur_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const total_jam = calcKompensasi(body.durasi, body.standby, body.akhir_pekan)

  const { data, error } = await getAdminClient()
    .from('lembur_entries')
    .update({ ...body, total_jam })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
