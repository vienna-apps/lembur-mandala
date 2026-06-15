import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { verifyToken, getAdminClient } from '@/lib/db'
import { calcDuration, calcKompensasi } from '@/lib/calculations'
import { DEFAULT_PROJECTS } from '@/lib/types'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// Indonesian month names → month number (0-based)
const ID_MONTHS: Record<string, number> = {
  januari:1, februari:2, maret:3, april:4, mei:5, juni:6,
  juli:7, agustus:8, september:9, oktober:10, november:11, desember:12,
}

function parseIdDate(raw: string): string | null {
  // "Kamis, 05 Maret 2026" → "2026-03-05"
  const match = raw.match(/\d+\s+(\w+)\s+(\d{4})/)
  if (!match) return null
  const day   = raw.match(/(\d+)\s+\w+\s+\d{4}/)?.[1]
  const month = ID_MONTHS[match[1].toLowerCase()]
  const year  = match[2]
  if (!day || !month || !year) return null
  return `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
}

function excelTimeToHHMM(val: unknown): string | null {
  if (typeof val === 'string') {
    // Already "HH:MM" or similar
    if (/^\d{1,2}:\d{2}$/.test(val.trim())) return val.trim()
    return null
  }
  if (typeof val !== 'number' || val < 0 || val > 1) return null
  const totalMin = Math.round(val * 24 * 60)
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

function detectProject(kegiatan: string): { project: string; desc: string } {
  // "[CAMBER BMS] Assist deploy..." → project=CAMBER BMS, desc=Assist deploy...
  const m = kegiatan.match(/^\[([^\]]+)\]\s*(.*)/)
  if (m) {
    const raw = m[1].trim().toUpperCase()
    // Map known aliases
    const alias: Record<string, string> = {
      'MB BKC': 'BKC', 'ONION BKC': 'BKC',
      'CAMBER-BMS': 'CAMBER BMS', 'CAMBER - BMS': 'CAMBER BMS',
      'ATM RECON': 'ATM - RECON',
    }
    const project = alias[raw] ?? (DEFAULT_PROJECTS.find(p => p === raw) ? raw : raw)
    return { project, desc: m[2].trim() }
  }
  return { project: '', desc: kegiatan.trim() }
}

function parseBoolean(val: unknown): boolean {
  if (typeof val === 'string') return val.trim().toLowerCase() === 'ya'
  if (typeof val === 'number') return val === 1
  return false
}

// POST /api/upload — parse xlsx, return preview or commit
// FormData: file (xlsx), bulan (YYYY-MM), commit (boolean)
export async function POST(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file     = formData.get('file') as File | null
  const bulan    = formData.get('bulan') as string | null
  const commit   = formData.get('commit') === 'true'

  if (!file || !bulan) return NextResponse.json({ error: 'file and bulan required' }, { status: 400 })

  const arrayBuffer = await file.arrayBuffer()
  const wb = XLSX.read(arrayBuffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  if (rows.length < 2) return NextResponse.json({ error: 'File kosong atau tidak ada data.' }, { status: 422 })

  const header = (rows[0] as string[]).map(h => String(h).toLowerCase().trim())

  // Detect format: new (NIK first) vs old (Nama first)
  const isNewFormat = header[0].includes('nomor') || header[0] === 'nik'
  const isOldFormat = header[0] === 'nama'

  if (!isNewFormat && !isOldFormat) {
    return NextResponse.json({
      error: 'Format file tidak dikenal. Pastikan menggunakan template lembur yang benar.',
      expectedHeader: 'Kolom pertama harus "Nomor Induk Karyawan" atau "Nama".',
    }, { status: 422 })
  }

  // Column indices
  const COL = isNewFormat
    ? { nik:0, nama:1, kegiatan:2, tanggal:3, standby:4, dari:5, sampai:6, durasi:7, weekend:8, total:9, wfo:10 }
    : { nik:1, nama:0, kegiatan:2, tanggal:3, standby:-1, dari:4, sampai:5, durasi:6, weekend:7, total:-1, wfo:-1 }

  const errors: { row: number; field: string; message: string }[] = []
  const parsed: {
    hari_tanggal: string
    project: string
    kegiatan: string[]
    dari_jam: string
    sampai_jam: string
    durasi: number
    standby: boolean
    akhir_pekan: boolean
    wfo: boolean
    total_jam: number
    raw_row: number
  }[] = []

  let parsedNik = ''
  let parsedNama = ''

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] as unknown[]
    // Skip blank rows
    if (row.every(c => c === '' || c === null || c === undefined)) continue

    // NIK/Nama (only on first data row)
    if (i === 1) {
      parsedNik  = String(row[COL.nik] ?? '').trim()
      parsedNama = String(row[COL.nama] ?? '').trim()
    }

    const kegiatanRaw = String(row[COL.kegiatan] ?? '').trim()
    const tanggalRaw  = String(row[COL.tanggal]  ?? '').trim()

    if (!kegiatanRaw) continue // skip blank kegiatan rows silently

    // Validate & parse date
    const hari_tanggal = parseIdDate(tanggalRaw)
    if (!hari_tanggal) {
      errors.push({ row: i + 1, field: 'Hari, Tanggal', message: `"${tanggalRaw}" tidak bisa diparsing. Format: "Senin, 01 Juni 2026"` })
      continue
    }

    // Validate times
    const dari_jam   = excelTimeToHHMM(row[COL.dari])
    const sampai_jam = excelTimeToHHMM(row[COL.sampai])
    if (!dari_jam)   { errors.push({ row: i+1, field: 'Dari Jam',   message: `Nilai tidak valid: "${row[COL.dari]}"` }); continue }
    if (!sampai_jam) { errors.push({ row: i+1, field: 'Sampai Jam', message: `Nilai tidak valid: "${row[COL.sampai]}"` }); continue }

    // Project & description
    const { project, desc } = detectProject(kegiatanRaw)
    if (!project) {
      errors.push({ row: i+1, field: 'Kegiatan/Project', message: `Tidak bisa mendeteksi project dari: "${kegiatanRaw}". Tambahkan prefix [NAMA PROJECT].` })
      // Don't skip — still include but with empty project, user can fix
    }

    const standby    = COL.standby >= 0 ? parseBoolean(row[COL.standby]) : false
    const akhir_pekan = parseBoolean(row[COL.weekend])
    const wfo        = COL.wfo >= 0 ? parseBoolean(row[COL.wfo]) : false

    // Duration: use parsed value from file if valid, else recalculate
    const durasiRaw   = String(row[COL.durasi] ?? '').replace(',', '.').trim()
    const durasiParsed = parseFloat(durasiRaw)
    const durasi = !isNaN(durasiParsed) && durasiParsed > 0
      ? durasiParsed
      : calcDuration(dari_jam, sampai_jam)

    const total_jam = calcKompensasi(durasi, standby, akhir_pekan)

    parsed.push({
      hari_tanggal,
      project: project || 'UNKNOWN',
      kegiatan: [desc || kegiatanRaw],
      dari_jam,
      sampai_jam,
      durasi,
      standby,
      akhir_pekan,
      wfo,
      total_jam,
      raw_row: i + 1,
    })
  }

  // If just previewing, return parsed data + errors
  if (!commit) {
    return NextResponse.json({ parsed, errors, parsedNik, parsedNama, totalRows: parsed.length })
  }

  // Commit: insert all valid rows
  if (errors.length > 0) {
    return NextResponse.json({ error: 'Selesaikan error sebelum menyimpan.', errors }, { status: 422 })
  }

  const db = getAdminClient()

  // Ensure month exists
  await db.from('lembur_months').upsert(
    { user_id: user.id, bulan },
    { onConflict: 'user_id,bulan', ignoreDuplicates: true }
  )
  const { data: month } = await db
    .from('lembur_months').select('id').eq('user_id', user.id).eq('bulan', bulan).single()

  if (!month) return NextResponse.json({ error: 'Gagal membuat record bulan.' }, { status: 500 })

  const inserts = parsed.map(p => ({
    month_id: month.id,
    user_id:  user.id,
    hari_tanggal: p.hari_tanggal,
    project:      p.project,
    kegiatan:     p.kegiatan,
    dari_jam:     p.dari_jam,
    sampai_jam:   p.sampai_jam,
    durasi:       p.durasi,
    standby:      p.standby,
    akhir_pekan:  p.akhir_pekan,
    wfo:          p.wfo,
    total_jam:    p.total_jam,
  }))

  const { error: insertErr } = await db.from('lembur_events').insert(inserts)
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })

  return NextResponse.json({ ok: true, inserted: inserts.length })
}
