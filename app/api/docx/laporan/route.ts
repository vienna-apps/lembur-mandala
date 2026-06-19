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

const RPRM = '<w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr>'
function mvRun(text: string): string {
  const space = (text.startsWith(' ') || text.endsWith(' ')) ? ' xml:space="preserve"' : ''
  return `<w:r>${RPRM}<w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

const RPRD = '<w:rPr><w:color w:val="262626"/><w:szCs w:val="16"/></w:rPr>'
function dataRun(text: string): string {
  const space = (text.startsWith(' ') || text.endsWith(' ')) ? ' xml:space="preserve"' : ''
  return `<w:r>${RPRD}<w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

// Detail table runs: Maven Pro, 7pt (sz=14 = 7pt in half-points)
const RPRD_DET = '<w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626"/><w:sz w:val="14"/><w:szCs w:val="14"/></w:rPr>'
function detRun(text: string): string {
  const space = (text.startsWith(' ') || text.endsWith(' ')) ? ' xml:space="preserve"' : ''
  return `<w:r>${RPRD_DET}<w:t${space}>${escapeXml(text)}</w:t></w:r>`
}

// Summary table column widths
const SUM_WIDTHS = [3237, 3237, 3238, 3238]
// Detail table: 10 columns scaled to fit landscape content width (13594 twips)
// Original widths from real laporan summed to 14881; scaled by 13594/14881
const DET_WIDTHS = [1683, 3146, 2020, 932, 938, 879, 982, 1279, 726, 1009]
const DET_HEADERS = ['Nama Karyawan', 'Kegiatan', 'Tanggal', 'Standby', 'Dari Jam', 'Sampai Jam', 'Selama (Jam)', 'Akhir Pekan / Tanggal Merah', 'WFO', 'Total (Jam)']

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

function detHeaderCell(text: string, w: number): string {
  return (
    `<w:tc>` +
    `<w:tcPr>` +
    `<w:cnfStyle w:val="001000000000" w:firstRow="0" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:oddVBand="0" w:evenVBand="0" w:oddHBand="0" w:evenHBand="0" w:firstRowFirstColumn="0" w:firstRowLastColumn="0" w:lastRowFirstColumn="0" w:lastRowLastColumn="0"/>` +
    `<w:tcW w:w="${w}" w:type="dxa"/>` +
    `<w:shd w:val="clear" w:color="auto" w:fill="63A4F7"/>` +
    `<w:vAlign w:val="center"/>` +
    `</w:tcPr>` +
    `<w:p><w:pPr><w:jc w:val="center"/></w:pPr>` +
    `${detRun(text)}` +
    `</w:p></w:tc>`
  )
}

function detailRow(cells: string[]): string {
  const tcCells = cells.map((text, i) => (
    `<w:tc>` +
    `<w:tcPr><w:tcW w:w="${DET_WIDTHS[i]}" w:type="dxa"/></w:tcPr>` +
    `<w:p>${PPR_360}${detRun(text)}</w:p>` +
    `</w:tc>`
  )).join('')
  return `<w:tr><w:trPr><w:cnfStyle w:val="000000100000" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:oddVBand="0" w:evenVBand="0" w:oddHBand="1" w:evenHBand="0" w:firstRowFirstColumn="0" w:firstRowLastColumn="0" w:lastRowFirstColumn="0" w:lastRowLastColumn="0"/></w:trPr>${tcCells}</w:tr>`
}

// Signing table: 2-col, left-aligned bold-name/title in col 0, empty col 1 for signatures
// Landscape content width = 15840 - 806 (left margin) - 1440 (right margin) = 13594 twips
const SIG_RPRM_BOLD = '<w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:b/><w:bCs/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr>'
const SIG_PPR_LEFT = '<w:pPr><w:snapToGrid w:val="0"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
const SIG_COL0 = 5000   // name/title column (left-aligned, tight to content)
const SIG_COL1 = 8594   // signature space column — plenty of room to sign
const SIG_TBL_PR = `<w:tblPr><w:tblStyle w:val="TableGridLight"/><w:tblW w:w="${SIG_COL0 + SIG_COL1}" w:type="dxa"/><w:tblInd w:w="0" w:type="dxa"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="1" w:noVBand="1"/></w:tblPr>`
const SIG_TC_BORDERS = '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/></w:tcBorders>'

function sigTableRow(name: string, title: string): string {
  return (
    `<w:tr>` +
    `<w:tc><w:tcPr><w:tcW w:w="${SIG_COL0}" w:type="dxa"/>${SIG_TC_BORDERS}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p>${SIG_PPR_LEFT}` +
    `<w:r>${SIG_RPRM_BOLD}<w:t>${escapeXml(name)}</w:t></w:r>` +
    `<w:r>${RPRM}<w:t>/${escapeXml(title)}</w:t></w:r>` +
    `</w:p></w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="${SIG_COL1}" w:type="dxa"/>${SIG_TC_BORDERS}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p></w:p>` +
    `</w:tc>` +
    `</w:tr>`
  )
}

// Inject a text run into an empty paragraph cell identified by paraId
function injectIntoEmptyPara(xml: string, paraId: string, text: string): string {
  const idx = xml.indexOf(`paraId="${paraId}"`)
  if (idx < 0) return xml
  const pStart = xml.lastIndexOf('<w:p ', idx)
  const pEnd = xml.indexOf('</w:p>', pStart) + 6
  const para = xml.substring(pStart, pEnd)
  const pprEnd = para.indexOf('</w:pPr>') + 8
  const newPara = para.substring(0, pprEnd) + mvRun(text) + para.substring(pprEnd, para.length - 6) + '</w:p>'
  return xml.substring(0, pStart) + newPara + xml.substring(pEnd)
}

// Replace paragraph block (from first paraId to last paraId inclusive) with new content
function replaceParaBlock(xml: string, firstId: string, lastId: string, replacement: string): string {
  const startIdx = xml.indexOf(firstId)
  if (startIdx < 0) return xml
  const pStart = xml.lastIndexOf('<w:p ', startIdx)
  const endIdx = xml.indexOf(lastId, startIdx)
  if (endIdx < 0) return xml
  const pEnd = xml.indexOf('</w:p>', endIdx) + 6
  return xml.substring(0, pStart) + replacement + xml.substring(pEnd)
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
  xml = injectIntoEmptyPara(xml, '3877C8AA', 'MANDALA')
  xml = injectIntoEmptyPara(xml, '6495C9E2', bulanLbl)

  // ── 2. Summary table rows ──────────────────────────────────────────────────
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

  // ── 3. Detail table — replace entirely with 10-column version ─────────────
  const newSumTblEnd = xml.indexOf('</w:tbl>', infoTblEnd) + 8
  const detTblStart = xml.indexOf('<w:tbl>', newSumTblEnd)
  const detTblEnd = xml.indexOf('</w:tbl>', detTblStart) + 8

  const detTblW = DET_WIDTHS.reduce((s, w) => s + w, 0)
  const detHeaderRow = (
    `<w:tr>` +
    DET_HEADERS.map((h, i) => detHeaderCell(h, DET_WIDTHS[i])).join('') +
    `</w:tr>`
  )
  const detDataRows = summary.flatMap(p =>
    p.events.map((e, i) => detailRow([
      i === 0 ? p.profile.nama : '',
      e.kegiatan.join('; '),
      fmtDate(e.hari_tanggal),
      e.standby ? 'Ya' : 'Tidak',
      e.dari_jam,
      e.sampai_jam,
      e.durasi.toFixed(2),
      e.akhir_pekan ? 'Ya' : 'Tidak',
      e.wfo ? 'WFO' : 'WFH',
      e.total_jam.toFixed(2),
    ]))
  ).join('')

  const newDetTbl = (
    `<w:tbl>` +
    `<w:tblPr>` +
    `<w:tblStyle w:val="ListTable2-Accent1"/>` +
    `<w:tblW w:w="${detTblW}" w:type="dxa"/>` +
    `<w:tblInd w:w="0" w:type="dxa"/>` +
    `<w:tblLook w:val="0480" w:firstRow="0" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/>` +
    `</w:tblPr>` +
    detHeaderRow + detDataRows +
    `</w:tbl>`
  )

  xml = xml.substring(0, detTblStart) + newDetTbl + xml.substring(detTblEnd)

  // ── 4. Kota date paragraph (paraId 55F83FB4) ──────────────────────────────
  const KOTA_PPR = '<w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
  xml = xml.replace(
    /<w:p [^>]*55F83FB4[^>]*>[\s\S]*?<\/w:p>/,
    `<w:p w14:paraId="55F83FB4" w14:textId="101DBECB" w:rsidR="00052797" w:rsidRDefault="0022747D" w:rsidP="006F0248">${KOTA_PPR}${mvRun(`Bandung, ${today}`)}</w:p>`,
  )

  // ── 5. Block 1 signing — replace paragraph block with 4-person 2-col table ───
  // Range: 4BCFDC35 (first title) → 38486396 (director name)
  const SIGNERS: [string, string][] = [
    ['Vania Sanjaya',          'Technical Lead'],
    ['Silvia M. Purwani',      'Business Solution Dept. Lead'],
    ['M. Rizki',               'Engineering Manager'],
    ['Ginan G. Pramadita',     'Chief Technology Officer'],
  ]
  const sigTable1 = `<w:tbl>${SIG_TBL_PR}${SIGNERS.map(([n, t]) => sigTableRow(n, t)).join('')}</w:tbl>`
  xml = replaceParaBlock(xml, '4BCFDC35', '38486396', sigTable1)

  // ── 6. Block 2 signing — replace paragraph block after detail table ─────────
  // Range: 740CD5B8 (title) → 38DBD901 (name)
  const sigTable2 = `<w:tbl>${SIG_TBL_PR}${sigTableRow('Vania Sanjaya', 'Technical Lead')}</w:tbl>`
  xml = replaceParaBlock(xml, '740CD5B8', '38DBD901', sigTable2)

  zip.file('word/document.xml', xml)
  const buf = zip.generate({ type: 'nodebuffer' })

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Laporan-Lembur-Mandala-${bulan}.docx"`,
    },
  })
}
