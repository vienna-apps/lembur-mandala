import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'
import { bulanLabel } from '@/lib/types'
import type { LemburEvent, Profile } from '@/lib/types'
import { readFileSync } from 'fs'
import { join } from 'path'
import PizZip from 'pizzip'

type ProofImage = {
  url: string
  data: Buffer
  extension: 'png' | 'jpg'
  width: number
  height: number
}

const PROOF_RIDS = ['rId6', 'rId7', 'rId8'] as const
const MAX_PROOFS = 20
const MAX_PROOF_BYTES = 10 * 1024 * 1024
const MAX_IMAGE_WIDTH_EMU = 6_800_000
const MAX_IMAGE_HEIGHT_EMU = 4_100_000

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

function imageDimensions(data: Buffer, extension: ProofImage['extension']): { width: number; height: number } | null {
  if (extension === 'png') {
    if (data.length < 24 || data.toString('ascii', 1, 4) !== 'PNG') return null
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) }
  }

  let offset = 2
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) { offset++; continue }
    const marker = data[offset + 1]
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue }
    const length = data.readUInt16BE(offset + 2)
    if (length < 2 || offset + 2 + length > data.length) return null
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { width: data.readUInt16BE(offset + 7), height: data.readUInt16BE(offset + 5) }
    }
    offset += 2 + length
  }
  return null
}

async function fetchProofImages(urls: string[]): Promise<{ images: ProofImage[]; fallbackUrls: string[] }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '')
  const allowedPrefix = supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/lembur-proofs/` : ''
  const images: ProofImage[] = []
  const fallbackUrls: string[] = []

  for (const url of urls.slice(0, MAX_PROOFS)) {
    if (!allowedPrefix || !url.startsWith(allowedPrefix)) {
      fallbackUrls.push(url)
      continue
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentLength = Number(response.headers.get('content-length') ?? 0)
      if (contentLength > MAX_PROOF_BYTES) throw new Error('image too large')
      const contentType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase()
      const extension = contentType === 'image/png'
        ? 'png'
        : (contentType === 'image/jpeg' || contentType === 'image/jpg') ? 'jpg' : null
      if (!extension) throw new Error(`unsupported image type: ${contentType ?? 'unknown'}`)
      const data = Buffer.from(await response.arrayBuffer())
      if (data.length > MAX_PROOF_BYTES) throw new Error('image too large')
      const dimensions = imageDimensions(data, extension)
      if (!dimensions?.width || !dimensions.height) throw new Error('invalid image')
      images.push({ url, data, extension, ...dimensions })
    } catch (error) {
      console.warn('[moo] Proof image fallback:', url, error instanceof Error ? error.message : String(error))
      fallbackUrls.push(url)
    }
  }

  return { images, fallbackUrls }
}

function fitImage(width: number, height: number): { cx: number; cy: number } {
  const scale = Math.min(MAX_IMAGE_WIDTH_EMU / width, MAX_IMAGE_HEIGHT_EMU / height)
  return { cx: Math.round(width * scale), cy: Math.round(height * scale) }
}

function proofImageParagraph(rid: string, image: ProofImage, drawingId: number): string {
  const { cx, cy } = fitImage(image.width, image.height)
  return (
    `<w:p><w:pPr><w:spacing w:before="80" w:after="80"/><w:jc w:val="center"/></w:pPr>` +
    `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing>` +
    `<wp:inline distT="0" distB="0" distL="0" distR="0">` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/>` +
    `<wp:docPr id="${drawingId}" name="Bukti Kegiatan ${drawingId}" descr="Bukti kegiatan lembur"/>` +
    `<wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr>` +
    `<pic:cNvPr id="${drawingId}" name="Bukti Kegiatan ${drawingId}"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm>` +
    `<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`
  )
}

function replaceDrawingParagraph(xml: string, rid: string, replacement: string): string {
  return xml.replace(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g, paragraph =>
    paragraph.includes(`r:embed="${rid}"`) ? replacement : paragraph,
  )
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

// GET /api/docx/moo?bulan=2026-06[&tanggal=2026-08-07][&single=1]
export async function GET(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getAdminClient()
  const { data: profile } = await db.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const bulan = req.nextUrl.searchParams.get('bulan') ?? ''
  if (!bulan) return NextResponse.json({ error: 'bulan required' }, { status: 400 })
  const requestedDates = new Set(
    req.nextUrl.searchParams.getAll('tanggal').flatMap(value => value.split(',')).filter(value => /^\d{4}-\d{2}-\d{2}$/.test(value)),
  )
  const singleDocument = req.nextUrl.searchParams.get('single') === '1'

  const { data: months } = await db
    .from('lembur_months')
    .select('*, profile:profiles(*), events:lembur_events(*)')
    .eq('bulan', bulan)

  if (!months?.length) return NextResponse.json({ error: 'Tidak ada data.' }, { status: 404 })

  try {

  const allEvents: Array<LemburEvent & { profile: Profile }> = []
  for (const m of months) {
    for (const ev of (m.events ?? [])) allEvents.push({ ...ev, profile: m.profile })
  }
  allEvents.sort((a, b) => a.hari_tanggal.localeCompare(b.hari_tanggal))
  const filteredEvents = requestedDates.size > 0
    ? allEvents.filter(ev => requestedDates.has(ev.hari_tanggal))
    : allEvents
  if (requestedDates.size > 0 && filteredEvents.length === 0) {
    return NextResponse.json({ error: 'Tidak ada data untuk tanggal yang dipilih.' }, { status: 404 })
  }

  // Group by project + date
  const groupMap = new Map<string, typeof filteredEvents>()
  for (const ev of filteredEvents) {
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
  const generatedDocs: Array<{ name: string; data: Buffer }> = []

  for (const group of groups) {
    const zip = new PizZip(templateBuf)
    let xml = zip.file('word/document.xml')!.asText()

    const judul = `${group.project} — ${bulanLabel(bulan)}`
    const kegiatan = [...new Set(group.events.flatMap(e => e.kegiatan))].join('; ')
    const timeRange = `${group.minStart} – ${group.maxEnd}`
    const dateFmt = fmtDate(group.tanggal)
    const dateShort = fmtDateShort(group.tanggal)
    // Include every proof uploaded by every attendee for this project/date.
    // Deduplicate URLs while preserving the event/upload order.
    const buktiUrls = [...new Set(group.events.flatMap(e => e.bukti_urls ?? []))]
    const { images: proofImages, fallbackUrls } = await fetchProofImages(buktiUrls)

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

    // ── 3a. Bukti Kegiatan cell (row 6) — clear image placeholder ─────────────
    for (let i = 0; i < PROOF_RIDS.length; i++) {
      const replacement = i < 2
        ? (proofImages[i] ? proofImageParagraph(PROOF_RIDS[i], proofImages[i], 9000 + i) : '')
        : proofImages.slice(i).map((image, offset) =>
            proofImageParagraph(`${PROOF_RIDS[i]}Proof${offset}`, image, 9000 + i + offset),
          ).join('')
      xml = replaceDrawingParagraph(xml, PROOF_RIDS[i], replacement)
    }
    // ── 3b. Bukti text row (row 7, paraId 410DBE44) — show bukti_urls for this group ──
    const buktiText = fallbackUrls.length > 0 ? `Bukti tambahan: ${fallbackUrls.join(', ')}` : ''
    xml = xml.replace(
      /<w:p [^>]*410DBE44[^>]*>[\s\S]*?<\/w:p>/,
      buktiText
        ? `<w:p w14:paraId="410DBE44" w14:textId="77777777" w:rsidR="00310931" w:rsidRDefault="00310931" w:rsidP="006F0248">${INFO_PPR}${mvRun(buktiText)}</w:p>`
        : `<w:p w14:paraId="410DBE44" w14:textId="77777777" w:rsidR="00310931" w:rsidRDefault="00310931" w:rsidP="006F0248"><w:pPr><w:spacing w:line="360" w:lineRule="auto"/></w:pPr></w:p>`,
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
    // Replace the entire <w:tr> containing [NAMA LENGKAP] with one row per attendee
    const namaIdx = xml.indexOf('[NAMA LENGKAP]')
    if (namaIdx >= 0) {
      const trStart = xml.lastIndexOf('<w:tr ', namaIdx)
      const trEnd = xml.indexOf('</w:tr>', namaIdx) + 7
      const ATT_COL0_PPR = '<w:pPr><w:snapToGrid w:val="0"/><w:jc w:val="right"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
      const ATT_COL1_PPR = '<w:pPr><w:snapToGrid w:val="0"/><w:jc w:val="center"/><w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr></w:pPr>'
      const ATT_RPRM_BOLD = '<w:rPr><w:rFonts w:ascii="Maven Pro" w:hAnsi="Maven Pro"/><w:b/><w:bCs/><w:color w:val="262626" w:themeColor="text1" w:themeTint="D9"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="en-US"/></w:rPr>'
      const attendeeRows =
        `<w:tr><w:trPr><w:trHeight w:val="759"/></w:trPr>` +
        `<w:tc><w:tcPr><w:tcW w:w="5081" w:type="dxa"/><w:tcBorders><w:left w:val="nil"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>` +
        `<w:p>${ATT_COL0_PPR}` +
        `<w:r>${ATT_RPRM_BOLD}<w:t>VANIA SANJAYA</w:t></w:r>` +
        `<w:r>${RPRM}<w:t xml:space="preserve"> / Tech Lead</w:t></w:r>` +
        `</w:p></w:tc>` +
        `<w:tc><w:tcPr><w:tcW w:w="2694" w:type="dxa"/><w:tcBorders><w:right w:val="nil"/></w:tcBorders><w:vAlign w:val="center"/></w:tcPr>` +
        `<w:p>${ATT_COL1_PPR}</w:p>` +
        `</w:tc></w:tr>`
      xml = xml.substring(0, trStart) + attendeeRows + xml.substring(trEnd)
    }

    zip.file('word/document.xml', xml)

    let bodyRelsXml = zip.file('word/_rels/document.xml.rels')?.asText() ?? ''
    let contentTypesXml = zip.file('[Content_Types].xml')?.asText() ?? ''
    for (let i = 0; i < proofImages.length; i++) {
      const rid = i < 2 ? PROOF_RIDS[i] : `${PROOF_RIDS[2]}Proof${i - 2}`
      const target = `media/proof-${i + 1}.${proofImages[i].extension}`
      if (i < 2) {
        bodyRelsXml = bodyRelsXml.replace(
          new RegExp(`<Relationship Id="${rid}"[^>]*/>`),
          `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`,
        )
      } else {
        bodyRelsXml = bodyRelsXml.replace(
          '</Relationships>',
          `<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/></Relationships>`,
        )
      }
      zip.file(`word/${target}`, proofImages[i].data)
    }
    if (proofImages.some(image => image.extension === 'jpg') && !contentTypesXml.includes('Extension="jpg"')) {
      contentTypesXml = contentTypesXml.replace(
        '</Types>',
        '<Default Extension="jpg" ContentType="image/jpeg"/></Types>',
      )
    }
    zip.file('word/_rels/document.xml.rels', bodyRelsXml)
    zip.file('[Content_Types].xml', contentTypesXml)

    // ── 7. Strip unreferenced body images (keep fonts so BigNoodleTitling renders) ──
    // Find which rIds are still referenced in the modified document body
    const referencedRids = new Set([...xml.matchAll(/r:embed="(rId\d+)"/g)].map(m => m[1]))
    // Parse body rels and delete image files no longer referenced
    const bodyRelsMatches = [...bodyRelsXml.matchAll(/<Relationship Id="(rId\d+)"[^>]*Target="(media\/[^"]+)"/g)]
    for (const [relationship, rid, target] of bodyRelsMatches) {
      if (!referencedRids.has(rid)) {
        zip.remove(`word/${target}`)
        bodyRelsXml = bodyRelsXml.replace(relationship, '')
      }
    }
    zip.file('word/_rels/document.xml.rels', bodyRelsXml)

    const docBuf = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })

    const safeName = group.project.replace(/[^a-zA-Z0-9]/g, '-')
    const filename = `MoO-${safeName}-${group.tanggal}.docx`
    outerZip.file(filename, docBuf)
    generatedDocs.push({ name: filename, data: docBuf })
  }

  if (singleDocument && generatedDocs.length === 1) {
    return new Response(new Uint8Array(generatedDocs[0].data), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${generatedDocs[0].name}"`,
      },
    })
  }

  const zipBuf = outerZip.generate({ type: 'nodebuffer', compression: 'DEFLATE' })
  return new Response(new Uint8Array(zipBuf), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="MoO-Mandala-${bulan}.zip"`,
    },
  })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[moo]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
