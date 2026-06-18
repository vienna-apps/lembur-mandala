import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'
import { bulanLabel } from '@/lib/types'
import type { LemburEvent, Profile } from '@/lib/types'
import { readFileSync } from 'fs'
import { join } from 'path'
import PizZip from 'pizzip'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function fmtDateShort(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  const mins = h * 60 + m
  return mins < 12 * 60 ? mins + 24 * 60 : mins
}

// Run XML using Maven Pro styling (matches template value cells)
const RPRM = '<w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
function mvRun(text: string): string {
  const space = (text.startsWith(' ') || text.endsWith(' ')) ? ' xml:space="preserve"' : ''
  return `<w:r>${RPRM}<w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

// Data row run properties (matches template data rows)
const RPRD = '<w:rPr><w:color w:val="262626"/><w:szCs w:val="16"/></w:rPr>'
function dataRun(text: string): string {
  const space = (text.startsWith(' ') || text.endsWith(' ')) ? ' xml:space="preserve"' : ''
  return `<w:r>${RPRD}<w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

// Detail table column widths (from template)
const WIDTHS = [1942, 2558, 1011, 852, 1017, 990, 1440, 2340, 1890]

function mooDataRow(cells: string[]): string {
  const tcCells = cells.map((text, i) => (
    `<w:tc>` +
    `<w:tcPr><w:tcW w:w="${WIDTHS[i]}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>` +
    dataRun(text) +
    `</w:p></w:tc>`
  )).join('')
  return (
    `<w:tr>` +
    `<w:trPr><w:cnfStyle w:val="000000100000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:oddVBand="0" w:evenVBand="0" w:oddHBand="1" w:evenHBand="0" w:firstRowFirstColumn="0" w:firstRowLastColumn="0" w:lastRowFirstColumn="0" w:lastRowLastColumn="0"/></w:trPr>` +
    tcCells +
    `</w:tr>`
  )
}

// pPr XML for info paragraphs (spacing + rPr)
const INFO_PPR = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'

// GET /api/docx/moo?bulan=2026-06
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

  const allEvents: Array<LemburEvent & { profile: Profile }> = []
  for (const m of months) {
    for (const ev of (m.events ?? [])) allEvents.push({ ...ev, profile: m.profile })
  }
  allEvents.sort((a, b) => a.hari_tanggal.localeCompare(b.hari_tanggal))

  // Group by project + date
  const groupMap = new Map<string, typeof allEvents>()
  for (const ev of allEvents) {
    const key = `${ev.project}__${ev.hari_tanggal}`
    if (!groupMap.has(key)) groupMap.set(key, [])
    groupMap.get(key)!.push(ev)
  }

  const groups = Array.from(groupMap.values()).map(evs => {
    const minStart = evs.reduce((min, ev) => timeToMinutes(ev.dari_jam) < timeToMinutes(min) ? ev.dari_jam : min, evs[0].dari_jam)
    const maxEnd = evs.reduce((max, ev) => timeToMinutes(ev.sampai_jam) > timeToMinutes(max) ? ev.sampai_jam : max, evs[0].sampai_jam)
    const attendeeMap = new Map<string, Profile>()
    for (const ev of evs) attendeeMap.set(ev.profile.nama, ev.profile)
    return {
      project: evs[0].project,
      tanggal: evs[0].hari_tanggal,
      events: evs,
      minStart,
      maxEnd,
      attendees: [...attendeeMap.values()],
    }
  })

  const templateBuf = readFileSync(join(process.cwd(), 'templates', 'moo-template.docx'))
  const outerZip = new PizZip()

  for (const group of groups) {
    const zip = new PizZip(templateBuf)
    let xml = zip.file('word/document.xml')!.asText()

    const judul = `${group.project} — ${bulanLabel(bulan)}`
    const kegiatan = [...new Set(group.events.flatMap(e => e.kegiatan))].join('; ')
    const timeRange = `${group.minStart} – ${group.maxEnd}`
    const dateFmt = fmtDate(group.tanggal)
    const dateShort = fmtDateShort(group.tanggal)

    // ── 1. Info table value cells ─────────────────────────────────────────────
    // Judul Lembur
    xml = xml.replace('<w:t>DRC Camber 2024</w:t>', `<w:t>${escapeXml(judul)}</w:t>`)
    // Project/Client
    xml = xml.replace('<w:t>KB Bank</w:t>', `<w:t>${escapeXml(group.project)}</w:t>`)
    // Hari/Tanggal
    xml = xml.replace(/xml:space="preserve">Kamis, 28 Maret 2024 <\/w:t>/, `xml:space="preserve">${escapeXml(dateFmt)}</w:t>`)
    // Jam
    xml = xml.replace(/xml:space="preserve">23:00 - <\/w:t>/, `xml:space="preserve">${escapeXml(timeRange)}</w:t>`)

    // ── 2. Deskripsi cell (replace all runs, keep pPr) ────────────────────────
    xml = xml.replace(
      /<w:p [^>]*0DA3D407[^>]*>[\s\S]*?<\/w:p>/,
      `<w:p w14:paraId="0DA3D407" w14:textId="34D30624" w:rsidR="00767645" w:rsidRDefault="000D0886" w:rsidP="006F0248">${INFO_PPR}${mvRun(kegiatan)}</w:p>`,
    )

    // ── 3. Bukti Kegiatan cell (image → text) ─────────────────────────────────
    // Template cell has <w:r><w:rPr><w:noProof/>...</w:drawing></w:r>
    xml = xml.replace(
      /<w:r><w:rPr><w:noProof\/>[\s\S]*?<\/w:drawing><\/w:r>/,
      mvRun('Bukti lebih lanjut dapat diakses di channel komunikasi tim'),
    )

    // ── 4. Detail table rows ──────────────────────────────────────────────────
    // Info table is table 0; detail table is table 1
    const infoTblEnd = xml.indexOf('</w:tbl>') + 8
    const detailTblStart = xml.indexOf('<w:tbl>', infoTblEnd)
    const detailTblEnd = xml.indexOf('</w:tbl>', detailTblStart) + 8
    const headerEnd = xml.indexOf('</w:tr>', detailTblStart) + 7

    const newRows = group.events.map(ev => mooDataRow([
      ev.profile.nama,
      ev.kegiatan.join('; '),
      ev.wfo ? 'WFO' : 'WFH',
      ev.standby ? 'Ya' : 'Tidak',
      ev.dari_jam,
      ev.sampai_jam,
      ev.durasi.toFixed(2),
      ev.akhir_pekan ? 'Ya' : 'Tidak',
      ev.total_jam.toFixed(2),
    ])).join('')

    xml = xml.substring(0, headerEnd) + newRows + '</w:tbl>' + xml.substring(detailTblEnd)

    // ── 5. Bandung footer paragraph ───────────────────────────────────────────
    const bandungIdx = xml.indexOf('Bandung, ')
    if (bandungIdx >= 0) {
      const bPStart = xml.lastIndexOf('<w:p ', bandungIdx)
      const bPEnd = xml.indexOf('</w:p>', bandungIdx) + 6
      const BANDUNG_PPR = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
      xml = (
        xml.substring(0, bPStart) +
        `<w:p>${BANDUNG_PPR}${mvRun(`Bandung, ${dateShort}`)}</w:p>` +
        xml.substring(bPEnd)
      )
    }

    // ── 6. Attendees ([NAMA LENGKAP] placeholder) ─────────────────────────────
    const namaIdx = xml.indexOf('[NAMA LENGKAP]')
    if (namaIdx >= 0) {
      const namaPStart = xml.lastIndexOf('<w:p ', namaIdx)
      const namaPEnd = xml.indexOf('</w:p>', namaIdx) + 6
      const ATT_PPR = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr></w:pPr>'
      const attendeeParas = group.attendees.map(p =>
        `<w:p>${ATT_PPR}${mvRun(`${p.nama.toUpperCase()} / Staf Teknologi Informasi`)}</w:p>`
      ).join('')
      xml = xml.substring(0, namaPStart) + attendeeParas + xml.substring(namaPEnd)
    }

    zip.file('word/document.xml', xml)
    const docBuf = zip.generate({ type: 'nodebuffer' })

    const safeName = group.project.replace(/[^a-zA-Z0-9]/g, '-')
    outerZip.file(`MoO-${safeName}-${group.tanggal}.docx`, docBuf)
  }

  const zipBuf = outerZip.generate({ type: 'nodebuffer' })
  return new Response(zipBuf, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="MoO-Mandala-${bulan}.zip"`,
    },
  })
}
