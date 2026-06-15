import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'
import { bulanLabel } from '@/lib/types'
import type { LemburEvent, Profile } from '@/lib/types'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, ShadingType,
} from 'docx'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

function hcell(text: string): TableCell {
  return new TableCell({
    shading: { type: ShadingType.SOLID, color: 'D9D9D9' },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, size: 20 })], alignment: AlignmentType.CENTER })],
  })
}
function dcell(text: string): TableCell {
  return new TableCell({ children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })] })
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

// Auto-group events by (project + date) for MoO
function groupByProjectDate(events: Array<LemburEvent & { profile: Profile }>) {
  const map = new Map<string, typeof events>()
  for (const ev of events) {
    const key = `${ev.project}__${ev.hari_tanggal}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(ev)
  }
  return Array.from(map.entries()).map(([key, evs]) => ({
    key,
    project: evs[0].project,
    tanggal: evs[0].hari_tanggal,
    events: evs,
  }))
}

// GET /api/docx/moo?bulan=2026-06 — one combined MoO docx with all groups
export async function GET(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getAdminClient()
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const bulan = req.nextUrl.searchParams.get('bulan') ?? ''
  if (!bulan) return NextResponse.json({ error: 'bulan required' }, { status: 400 })

  const { data: months } = await db
    .from('lembur_months')
    .select('*, profile:profiles(*), events:lembur_events(*)')
    .eq('bulan', bulan)

  if (!months?.length) return NextResponse.json({ error: 'Tidak ada data.' }, { status: 404 })

  // Flatten events with profile info
  const allEvents: Array<LemburEvent & { profile: Profile }> = []
  for (const m of months) {
    for (const ev of (m.events ?? [])) {
      allEvents.push({ ...ev, profile: m.profile })
    }
  }

  allEvents.sort((a, b) => a.hari_tanggal.localeCompare(b.hari_tanggal))
  const groups = groupByProjectDate(allEvents)
  const bulanLbl = bulanLabel(bulan)

  const sections = groups.map(group => ({
    children: [
      new Paragraph({ children: [new TextRun({ text: `MINUTES OF OVERTIME — ${group.project}`, bold: true, size: 26 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ children: [new TextRun({ text: fmtDate(group.tanggal), size: 22 })], alignment: AlignmentType.CENTER }),
      new Paragraph({ text: '' }),

      // Info table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [hcell('Judul Lembur'), dcell(`${group.project} — ${bulanLbl}`)] }),
          new TableRow({ children: [hcell('Project / Client'), dcell(group.project)] }),
          new TableRow({ children: [hcell('Hari / Tanggal'), dcell(fmtDate(group.tanggal))] }),
          new TableRow({ children: [hcell('Jam'), dcell(`${group.events[0].dari_jam} – ${group.events[group.events.length-1].sampai_jam}`)] }),
          new TableRow({ children: [hcell('Deskripsi'), dcell(group.events.flatMap(e=>e.kegiatan).join('; '))] }),
          new TableRow({ children: [hcell('Bukti Kegiatan'), dcell('Screenshot / Log terlampir')] }),
        ],
      }),
      new Paragraph({ text: '' }),

      // Participant table
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [
            hcell('Nama'), hcell('Kegiatan'), hcell('WFO'), hcell('Standby'),
            hcell('Dari Jam'), hcell('Sampai Jam'), hcell('Durasi'), hcell('Akhir Pekan'), hcell('Total'),
          ]}),
          ...group.events.map(ev => new TableRow({ children: [
            dcell(ev.profile.nama),
            dcell(ev.kegiatan.join('; ')),
            dcell(ev.wfo ? 'Ya' : 'Tidak'),
            dcell(ev.standby ? 'Ya' : 'Tidak'),
            dcell(ev.dari_jam),
            dcell(ev.sampai_jam),
            dcell(ev.durasi.toFixed(2)),
            dcell(ev.akhir_pekan ? 'Ya' : 'Tidak'),
            dcell(ev.total_jam.toFixed(2)),
          ]})),
        ],
      }),
      new Paragraph({ text: '' }),

      new Paragraph({ children: [new TextRun({ text: 'Minutes of Meeting:', bold: true, size: 20 })] }),
      new Paragraph({ children: [new TextRun({ text: '(Diisi oleh admin)', size: 20, italics: true, color: '888888' })] }),
      new Paragraph({ text: '' }),
      new Paragraph({ text: '' }),

      // Signature
      new Table({
        width: { size: 40, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({ children: [dcell('Vania Sanjaya')] }),
          new TableRow({ children: [dcell('Tech Lead — Mandala')] }),
        ],
      }),
      new Paragraph({ text: '' }),
      new Paragraph({ children: [new TextRun({ text: '─'.repeat(60), color: 'CCCCCC', size: 18 })] }),
      new Paragraph({ text: '' }),
    ],
  }))

  const doc = new Document({ sections })
  const buf = await Packer.toBuffer(doc)

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="MoO-Mandala-${bulan}.docx"`,
    },
  })
}
