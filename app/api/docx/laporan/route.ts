import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'
import { bulanLabel } from '@/lib/types'
import type { LemburEvent, Profile } from '@/lib/types'
import {
  Document, Packer, Paragraph, Table, TableRow, TableCell,
  TextRun, WidthType, AlignmentType, BorderStyle, HeadingLevel,
  ShadingType,
} from 'docx'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

function cell(text: string, bold = false, shade = false): TableCell {
  return new TableCell({
    shading: shade ? { type: ShadingType.SOLID, color: 'D9D9D9' } : undefined,
    children: [new Paragraph({
      children: [new TextRun({ text, bold, size: 20 })],
      alignment: AlignmentType.CENTER,
    })],
  })
}

function dataCell(text: string): TableCell {
  return new TableCell({
    children: [new Paragraph({ children: [new TextRun({ text, size: 20 })] })],
  })
}

function noBorder() {
  const nb = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  return { top: nb, bottom: nb, left: nb, right: nb }
}

// GET /api/docx/laporan?bulan=2026-06
export async function GET(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getAdminClient()
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const bulan = req.nextUrl.searchParams.get('bulan') ?? ''
  if (!bulan) return NextResponse.json({ error: 'bulan required' }, { status: 400 })

  // Load all submissions for this bulan
  const { data: months } = await db
    .from('lembur_months')
    .select('*, profile:profiles(*), events:lembur_events(*)')
    .eq('bulan', bulan)
    .order('created_at')

  if (!months?.length) return NextResponse.json({ error: 'Tidak ada data untuk bulan ini.' }, { status: 404 })

  const bulanLbl = bulanLabel(bulan)

  // Summary per person
  interface PersonSummary { profile: Profile; events: LemburEvent[]; totalDurasi: number; totalKomp: number }
  const summary: PersonSummary[] = months.map((m: { profile: Profile; events: LemburEvent[] }) => {
    const events: LemburEvent[] = m.events ?? []
    return {
      profile: m.profile,
      events,
      totalDurasi: events.reduce((s,e) => s + e.durasi, 0),
      totalKomp:   events.reduce((s,e) => s + e.total_jam, 0),
    }
  })

  const fmtDate = (iso: string) => new Date(iso+'T00:00:00').toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})

  const doc = new Document({
    sections: [{
      children: [
        // Title
        new Paragraph({ children: [new TextRun({ text: 'LAPORAN LEMBUR', bold: true, size: 28 })], alignment: AlignmentType.CENTER, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [new TextRun({ text: `Periode: ${bulanLbl}`, size: 24 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ text: '' }),

        // Header table: project + periode
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              cell('Nama Project', true, true), cell('MANDALA', false, false),
              cell('Periode', true, true), cell(bulanLbl, false, false),
            ]}),
          ],
        }),
        new Paragraph({ text: '' }),

        // Summary per person
        new Paragraph({ children: [new TextRun({ text: 'Rekapitulasi Per Karyawan', bold: true, size: 22 })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              cell('NIK', true, true), cell('Nama', true, true),
              cell('Total Jam Lembur', true, true), cell('Total Lembur Revisi', true, true),
            ]}),
            ...summary.map(p => new TableRow({ children: [
              dataCell(p.profile.nik),
              dataCell(p.profile.nama),
              dataCell(p.totalDurasi.toFixed(2)),
              dataCell(p.totalKomp.toFixed(2)),
            ]})),
          ],
        }),
        new Paragraph({ text: '' }),

        // Detail per event
        new Paragraph({ children: [new TextRun({ text: 'Detail Kegiatan', bold: true, size: 22 })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              cell('Nama', true, true), cell('Kegiatan', true, true), cell('Tanggal', true, true),
              cell('Standby', true, true), cell('Dari', true, true), cell('Sampai', true, true),
              cell('Durasi', true, true), cell('Akhir Pekan', true, true), cell('WFO', true, true), cell('Total', true, true),
            ]}),
            ...summary.flatMap(p => p.events.map((e, i) => new TableRow({ children: [
              dataCell(i === 0 ? p.profile.nama : ''),
              dataCell(e.kegiatan.join('; ')),
              dataCell(fmtDate(e.hari_tanggal)),
              dataCell(e.standby ? 'Ya' : 'Tidak'),
              dataCell(e.dari_jam),
              dataCell(e.sampai_jam),
              dataCell(e.durasi.toFixed(2)),
              dataCell(e.akhir_pekan ? 'Ya' : 'Tidak'),
              dataCell(e.wfo ? 'Ya' : 'Tidak'),
              dataCell(e.total_jam.toFixed(2)),
            ]}))),
          ],
        }),
        new Paragraph({ text: '' }),

        // Signatures
        new Paragraph({ children: [new TextRun({ text: 'Mengetahui,', size: 20 })] }),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({ children: [
              new TableCell({ borders: noBorder(), children: [new Paragraph({ children: [new TextRun({ text: 'Vania Sanjaya', bold: true, size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ borders: noBorder(), children: [new Paragraph({ children: [new TextRun({ text: 'Silvia M. Purwani', bold: true, size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ borders: noBorder(), children: [new Paragraph({ children: [new TextRun({ text: 'M. Rizki', bold: true, size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ borders: noBorder(), children: [new Paragraph({ children: [new TextRun({ text: 'Ginan G. Pramadita', bold: true, size: 20 })], alignment: AlignmentType.CENTER })] }),
            ]}),
            new TableRow({ children: [
              new TableCell({ borders: noBorder(), children: [new Paragraph({ children: [new TextRun({ text: 'Tech Lead', size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ borders: noBorder(), children: [new Paragraph({ children: [new TextRun({ text: 'PM', size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ borders: noBorder(), children: [new Paragraph({ children: [new TextRun({ text: 'Manager', size: 20 })], alignment: AlignmentType.CENTER })] }),
              new TableCell({ borders: noBorder(), children: [new Paragraph({ children: [new TextRun({ text: 'Division Head', size: 20 })], alignment: AlignmentType.CENTER })] }),
            ]}),
          ],
        }),
      ],
    }],
  })

  const buf = await Packer.toBuffer(doc)
  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Laporan-Lembur-Mandala-${bulan}.docx"`,
    },
  })
}
