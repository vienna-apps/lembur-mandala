import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import type { LemburEntry } from '@/lib/types'
import { calcKompensasi } from '@/lib/calculations'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const folder = searchParams.get('folder_label')

  const supabase = getClient()
  let query = supabase
    .from('lembur_entries')
    .select('*')
    .order('hari_tanggal', { ascending: true })

  if (folder) query = query.eq('folder_label', folder)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const body: LemburEntry = await req.json()

  const total_jam = calcKompensasi(body.durasi, body.standby, body.akhir_pekan)

  const record = {
    nama: body.nama,
    nik: body.nik,
    hari_tanggal: body.hari_tanggal,
    project: body.project,
    kegiatan: body.kegiatan,
    dari_jam: body.dari_jam,
    sampai_jam: body.sampai_jam,
    durasi: body.durasi,
    standby: body.standby,
    akhir_pekan: body.akhir_pekan,
    wfo: body.wfo,
    total_jam,
    catatan: body.catatan || '',
    folder_label: body.folder_label || '',
    submitted_at: new Date().toISOString(),
  }

  const { data, error } = await getClient()
    .from('lembur_entries')
    .insert([record])
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
