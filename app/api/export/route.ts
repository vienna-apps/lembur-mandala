import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import type { LemburEntry } from '@/lib/types'
import { EVENT_ORDER, MOM_LABELS } from '@/lib/types'
import { normalizeEvent } from '@/lib/calculations'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') || 'per-karyawan'
  const folder = searchParams.get('folder') || ''

  const { data, error } = await getClient()
    .from('lembur_entries')
    .select('*')
    .order('hari_tanggal', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const all = data as LemburEntry[]

  const filtered = folder ? all.filter(r => r.folder_label === folder) : all

  if (type === 'per-karyawan') return NextResponse.json(buildPerKaryawan(filtered, folder))
  if (type === 'per-event')   return NextResponse.json(buildPerEvent(filtered))
  if (type === 'mom')         return NextResponse.json(buildMoM(all))

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}

function buildPerKaryawan(recs: LemburEntry[], folder: string) {
  const persons: Record<string, { recs: LemburEntry[]; dur: number; comp: number }> = {}
  for (const r of recs) {
    if (!persons[r.nama]) persons[r.nama] = { recs: [], dur: 0, comp: 0 }
    persons[r.nama].recs.push(r)
    persons[r.nama].dur += r.durasi
    persons[r.nama].comp += r.total_jam
  }
  return { folder, persons }
}

function buildPerEvent(all: LemburEntry[]) {
  const ev: Record<string, Record<string, LemburEntry[]>> = {}
  for (const e of EVENT_ORDER) { ev[e] = {} }
  for (const r of all) {
    const event = normalizeEvent(r.project, r.kegiatan)
    if (!ev[event]) ev[event] = {}
    const ml = r.folder_label || 'Unknown'
    if (!ev[event][ml]) ev[event][ml] = []
    ev[event][ml].push(r)
  }
  return ev
}

function buildMoM(all: LemburEntry[]) {
  const result: Record<string, Record<string, { durasi: number; kompensasi: number; sesi: number }>> = {}
  for (const e of EVENT_ORDER) {
    result[e] = {}
    for (const m of MOM_LABELS) result[e][m] = { durasi: 0, kompensasi: 0, sesi: 0 }
  }
  for (const r of all) {
    const event = normalizeEvent(r.project, r.kegiatan)
    const ml = r.folder_label || ''
    if (!result[event]) result[event] = {}
    if (!result[event][ml]) result[event][ml] = { durasi: 0, kompensasi: 0, sesi: 0 }
    result[event][ml].durasi += r.durasi
    result[event][ml].kompensasi += r.total_jam
    result[event][ml].sesi += 1
  }
  return result
}
