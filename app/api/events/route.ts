import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'
import { calcKompensasi } from '@/lib/calculations'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// POST /api/events — create a new lembur event
// Body: { bulan, hari_tanggal, project, kegiatan[], dari_jam, sampai_jam, durasi, standby, akhir_pekan, wfo }
export async function POST(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { bulan, hari_tanggal, project, kegiatan, dari_jam, sampai_jam, durasi, standby, akhir_pekan, wfo } = body

  if (!bulan || !hari_tanggal || !project || !dari_jam || !sampai_jam) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const db = getAdminClient()

  // Ensure month row exists
  await db
    .from('lembur_months')
    .upsert({ user_id: user.id, bulan }, { onConflict: 'user_id,bulan', ignoreDuplicates: true })

  const { data: month } = await db
    .from('lembur_months')
    .select('id')
    .eq('user_id', user.id)
    .eq('bulan', bulan)
    .single()

  if (!month) return NextResponse.json({ error: 'Could not find/create month' }, { status: 500 })

  const total_jam = calcKompensasi(Number(durasi), Boolean(standby), Boolean(akhir_pekan), Boolean(wfo))

  const { data, error } = await db
    .from('lembur_events')
    .insert({
      month_id: month.id,
      user_id: user.id,
      hari_tanggal,
      project,
      kegiatan: kegiatan ?? [],
      dari_jam,
      sampai_jam,
      durasi: Number(durasi),
      standby: Boolean(standby),
      akhir_pekan: Boolean(akhir_pekan),
      wfo: Boolean(wfo),
      total_jam,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
