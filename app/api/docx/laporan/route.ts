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

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

const RPRM = '<w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr>'
function mvRun(text: string): string {
  const space = (text.startsWith(' ') || text.endsWith(' ')) ? ' xml:space="preserve"' : ''
  return `<w:r>${RPRM}<w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

const RPRD = '<w:rPr><w:color w:val="262626"/><w:szCs w:val="16"/></w:rPr>'
function dataRun(text: string): string {
  const space = (text.startsWith(' ') || text.endsWith(' ')) ? ' xml:space="preserve"' : ''
  return `<w:r>${RPRD}<w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

// Summary table column widths
const SUM_WIDTHS = [3237, 3237, 3238, 3238]
// Detail table column widths
const DET_WIDTHS = [2258, 4263, 1344, 708, 922, 779, 1492, 1180]

const PPR_360 = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr>'

function summaryRow(cells: string[]): string {
  const tcCells = cells.map((text, i) => (
    `<w:tc>` +
    `<w:tcPr><w:tcW w:w="${SUM_WIDTHS[i]}" w:type="dxa"/></w:tcPr>` +
    `<w:p>${PPR_360}${dataRun(text)}</w:p>` +
    `</w:tc>`
  )).join('')
  return `<w:tr><w:trPr><w:cnfStyle w:val="000000100000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:oddVBand="0" w:evenVBand="0" w:oddHBand="1" w:evenHBand="0" w:firstRowFirstColumn="0" w:firstRowLastColumn="0" w:lastRowFirstColumn="0" w:lastRowLastColumn="0"/></w:trPr>${tcCells}</w:tr>`
}

function detailRow(cells: string[]): string {
  const tcCells = cells.map((text, i) => (
    `<w:tc>` +
    `<w:tcPr><w:tcW w:w="${DET_WIDTHS[i]}" w:type="dxa"/></w:tcPr>` +
    `<w:p>${PPR_360}${dataRun(text)}</w:p>` +
    `</w:tc>`
  )).join('')
  return `<w:tr><w:trPr><w:cnfStyle w:val="000000100000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:oddVBand="0" w:evenVBand="0" w:oddHBand="1" w:evenHBand="0" w:firstRowFirstColumn="0" w:firstRowLastColumn="0" w:lastRowFirstColumn="0" w:lastRowLastColumn="0"/></w:trPr>${tcCells}</w:tr>`
}

// Inject a text run into an empty paragraph cell identified by paraId
function injectIntoEmptyPara(xml: string, paraId: string, text: string): string {
  // Empty para has: <w:p ...><w:pPr>...</w:pPr></w:p>
  // We replace the closing </w:pPr></w:p> with </w:pPr><w:r>...<w:t>text</w:t></w:r></w:p>
  const idx = xml.indexOf(`paraId="${paraId}"`)
  if (idx < 0) return xml
  const pStart = xml.lastIndexOf('<w:p ', idx)
  const pEnd = xml.indexOf('</w:p>', pStart) + 6
  const para = xml.substring(pStart, pEnd)
  // Find end of pPr
  const pprEnd = para.indexOf('</w:pPr>') + 8
  const newPara = para.substring(0, pprEnd) + mvRun(text) + para.substring(pprEnd, para.length - 6) + '</w:p>'
  return xml.substring(0, pStart) + newPara + xml.substring(pEnd)
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

  const { data: months } = await db
    .from('lembur_months')
    .select('*, profile:profiles(*), events:lembur_events(*)')
    .eq('bulan', bulan)
    .order('created_at')

  if (!months?.length) return NextResponse.json({ error: 'Tidak ada data untuk bulan ini.' }, { status: 404 })

  const bulanLbl = bulanLabel(bulan)

  interface PersonSummary { profile: Profile; events: LemburEvent[]; totalDurasi: number; totalKomp: number }
  const summary: PersonSummary[] = months.map((m: { profile: Profile; events: LemburEvent[] }) => {
    const events = m.events ?? []
    return {
      profile: m.profile,
      events,
      totalDurasi: events.reduce((s, e) => s + e.durasi, 0),
      totalKomp: events.reduce((s, e) => s + e.total_jam, 0),
    }
  })

  const today = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

  const templateBuf = readFileSync(join(process.cwd(), 'templates', 'laporan-template.docx'))
  const zip = new PizZip(templateBuf)
  let xml = zip.file('word/document.xml')!.asText()

  // ── 1. Info table value cells (paraIds from template) ─────────────────────
  // Row 0: Nama project → "MANDALA"
  xml = injectIntoEmptyPara(xml, '3877C8AA', 'MANDALA')
  // Row 1: Periode/bulan → bulanLbl
  xml = injectIntoEmptyPara(xml, '6495C9E2', bulanLbl)

  // ── 2. Summary table rows ──────────────────────────────────────────────────
  // Table 0 = info, Table 1 = summary
  const infoTblEnd = xml.indexOf('</w:tbl>') + 8
  const sumTblStart = xml.indexOf('<w:tbl>', infoTblEnd)
  const sumTblEnd = xml.indexOf('</w:tbl>', sumTblStart) + 8
  const sumHeaderEnd = xml.indexOf('</w:tr>', sumTblStart) + 7

  const sumRows = summary.map(p => summaryRow([
    p.profile.nik,
    p.profile.nama,
    p.totalDurasi.toFixed(2),
    p.totalKomp.toFixed(2),
  ])).join('')

  xml = xml.substring(0, sumHeaderEnd) + sumRows + '</w:tbl>' + xml.substring(sumTblEnd)

  // ── 3. Detail table rows ───────────────────────────────────────────────────
  // After injection of summary rows, recompute table positions
  const newSumTblEnd = xml.indexOf('</w:tbl>', infoTblEnd) + 8
  const detTblStart = xml.indexOf('<w:tbl>', newSumTblEnd)
  const detTblEnd = xml.indexOf('</w:tbl>', detTblStart) + 8
  const detHeaderEnd = xml.indexOf('</w:tr>', detTblStart) + 7

  const detRows = summary.flatMap(p =>
    p.events.map((e, i) => detailRow([
      i === 0 ? p.profile.nama : '',
      e.kegiatan.join('; '),
      fmtDate(e.hari_tanggal),
      e.dari_jam,
      e.sampai_jam,
      e.durasi.toFixed(2),
      e.akhir_pekan ? 'Ya' : 'Tidak',
      e.total_jam.toFixed(2),
    ]))
  ).join('')

  xml = xml.substring(0, detHeaderEnd) + detRows + '</w:tbl>' + xml.substring(detTblEnd)

  // ── 4. Kota date paragraph (paraId 55F83FB4) ──────────────────────────────
  const SIG_PPR = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
  const KOTA_PPR = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
  xml = xml.replace(
    /<w:p [^>]*55F83FB4[^>]*>[\s\S]*?<\/w:p>/,
    `<w:p w14:paraId="55F83FB4" w14:textId="101DBECB" w:rsidR="00052797" w:rsidRDefault="0022747D" w:rsidP="006F0248">${KOTA_PPR}${mvRun(`Bandung, ${today}`)}</w:p>`,
  )

  // ── 5. Signature names ─────────────────────────────────────────────────────
  // "Nama Karyawan" placeholder (paraId 7A05C6D1) → Vania Sanjaya
  xml = xml.replace(
    /<w:p [^>]*7A05C6D1[^>]*>[\s\S]*?<\/w:p>/,
    `<w:p w14:paraId="7A05C6D1" w14:textId="7DCCB779" w:rsidR="00052797" w:rsidRDefault="0022747D" w:rsidP="00052797">${SIG_PPR}${mvRun('Vania Sanjaya')}</w:p>`,
  )
  // "Nama Direktur" placeholder (paraId 38486396) → Ginan Ginanjar Pratama
  xml = xml.replace(
    /<w:p [^>]*38486396[^>]*>[\s\S]*?<\/w:p>/,
    `<w:p w14:paraId="38486396" w14:textId="3C72DA5C" w:rsidR="00052797" w:rsidRDefault="0022747D" w:rsidP="00052797">${SIG_PPR}${mvRun('Ginan Ginanjar Pratama')}</w:p>`,
  )

  zip.file('word/document.xml', xml)
  const buf = zip.generate({ type: 'nodebuffer' })

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Laporan-Lembur-Mandala-${bulan}.docx"`,
    },
  })
}
