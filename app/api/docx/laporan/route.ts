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

// ── Signing tables ────────────────────────────────────────────────────────────
const SIG_RPRM_BOLD = '<w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:b/><w:bCs/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr>'
const SIG_PPR = '<w:pPr><w:snapToGrid w:val="0"/><w:jc w:val="right"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
const SIG_PPR_COL1 = '<w:pPr><w:snapToGrid w:val="0"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'

// Block 1: exact geometry from the August 2024 report.
const SIG1_COL0 = 4616
const SIG1_COL1 = 2658
const SIG1_TBL_PR = `<w:tblPr><w:tblStyle w:val="TableGridLight"/><w:tblW w:w="0" w:type="auto"/><w:tblInd w:w="4090" w:type="dxa"/><w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr><w:tblGrid><w:gridCol w:w="${SIG1_COL0}"/><w:gridCol w:w="${SIG1_COL1}"/></w:tblGrid>`

function sig1Row(name: string, title: string, isFirst: boolean): string {
  const b0 = isFirst
    ? '<w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/></w:tcBorders>'
    : '<w:tcBorders><w:left w:val="nil"/></w:tcBorders>'
  const b1 = isFirst
    ? '<w:tcBorders><w:top w:val="nil"/><w:right w:val="nil"/></w:tcBorders>'
    : '<w:tcBorders><w:right w:val="nil"/></w:tcBorders>'
  return (
    `<w:tr><w:trPr><w:trHeight w:val="360"/></w:trPr>` +
    `<w:tc><w:tcPr><w:tcW w:w="${SIG1_COL0}" w:type="dxa"/>${b0}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p>${SIG_PPR}` +
    `<w:r>${SIG_RPRM_BOLD}<w:t>${escapeXml(name)}</w:t></w:r>` +
    `<w:r>${RPRM}<w:t>/${escapeXml(title)}</w:t></w:r>` +
    (isFirst ? `<w:r>${SIG_RPRM_BOLD}<w:t xml:space="preserve"> </w:t></w:r>` : '') +
    `</w:p></w:tc>` +
    `<w:tc><w:tcPr><w:tcW w:w="${SIG1_COL1}" w:type="dxa"/>${b1}<w:vAlign w:val="center"/></w:tcPr>` +
    `<w:p>${SIG_PPR_COL1}</w:p>` +
    `</w:tc></w:tr>`
  )
}

// Post-detail portrait-section Vania sig tables — matched exactly to reference (2026-06 v8)
// pPr for the name cell: right-aligned, no spacing override
const SIG_POST_PPR_L = '<w:pPr><w:snapToGrid w:val="0"/><w:jc w:val="right"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
const TBLSIG_LOOK = 'w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"'
const EMPTY_SIG_PARA = '<w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr></w:p>'

// T4: indented (tblInd=5670), cols 4678+4232, /Technical Lead no leading space, trailing bold space
const sigPostDetailT4 = (
  `<w:tbl>` +
  `<w:tblPr><w:tblStyle w:val="TableGridLight"/><w:tblW w:w="8910" w:type="dxa"/><w:tblInd w:w="5670" w:type="dxa"/><w:tblLook ${TBLSIG_LOOK}/></w:tblPr>` +
  `<w:tblGrid><w:gridCol w:w="4678"/><w:gridCol w:w="4232"/></w:tblGrid>` +
  `<w:tr><w:trPr><w:trHeight w:val="759"/></w:trPr>` +
  `<w:tc><w:tcPr><w:tcW w:w="4678" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>` +
  `<w:p>${SIG_POST_PPR_L}` +
  `<w:r>${SIG_RPRM_BOLD}<w:t>Vania Sanjaya</w:t></w:r>` +
  `<w:r>${RPRM}<w:t>/Technical Lead</w:t></w:r>` +
  `<w:r>${SIG_RPRM_BOLD}<w:t xml:space="preserve"> </w:t></w:r>` +
  `</w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="4232" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:right w:val="nil"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>` +
  `<w:p>${SIG_PPR_COL1}</w:p></w:tc></w:tr></w:tbl>`
)
// T5: no indent, cols 4230+4232, " / Technical Lead" with leading space
const sigPostDetailT5 = (
  `<w:tbl>` +
  `<w:tblPr><w:tblStyle w:val="TableGridLight"/><w:tblW w:w="8462" w:type="dxa"/><w:tblLook ${TBLSIG_LOOK}/></w:tblPr>` +
  `<w:tblGrid><w:gridCol w:w="4230"/><w:gridCol w:w="4232"/></w:tblGrid>` +
  `<w:tr><w:trPr><w:trHeight w:val="759"/></w:trPr>` +
  `<w:tc><w:tcPr><w:tcW w:w="4230" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:left w:val="nil"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>` +
  `<w:p>${SIG_POST_PPR_L}` +
  `<w:r>${SIG_RPRM_BOLD}<w:t>Vania Sanjaya</w:t></w:r>` +
  `<w:r>${RPRM}<w:t xml:space="preserve"> / Technical Lead</w:t></w:r>` +
  `</w:p></w:tc>` +
  `<w:tc><w:tcPr><w:tcW w:w="4232" w:type="dxa"/><w:tcBorders><w:top w:val="nil"/><w:right w:val="nil"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>` +
  `<w:p>${SIG_PPR_COL1}</w:p></w:tc></w:tr></w:tbl>`
)

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

  // ── 0. Fix page margins to match reference (left=806, bottom=173) ──────────
  xml = xml.replace(/<w:pgMar([^/]*)\/>/,
    (m) => m.replace(/w:bottom="\d+"/, 'w:bottom="173"').replace(/w:left="\d+"/, 'w:left="806"'))

  // The source template contains leftover two- and three-column sections.
  // They make Word flow the four signer rows across separate page columns.
  xml = xml.replace(/<w:cols\b[^>]*\/>/g, (m) => m.replace(/\s+w:num="\d+"/, ''))

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
  const sigTable1 = `<w:tbl>${SIG1_TBL_PR}${SIGNERS.map(([n, t], i) => sig1Row(n, t, i === 0)).join('')}</w:tbl>`
  xml = replaceParaBlock(xml, '4BCFDC35', '38486396', sigTable1)

  // ── 6. Block 2 signing — two Vania tables matching reference (T4 indented + T5 unindented)
  xml = replaceParaBlock(xml, '740CD5B8', '38DBD901', sigPostDetailT4 + EMPTY_SIG_PARA + EMPTY_SIG_PARA + sigPostDetailT5)

  zip.file('word/document.xml', xml)
  const buf = zip.generate({ type: 'nodebuffer' })

  return new Response(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Laporan-Lembur-Mandala-${bulan}.docx"`,
    },
  })
}
