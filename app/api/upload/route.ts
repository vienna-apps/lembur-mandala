import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { verifyToken, getAdminClient } from '@/lib/db'
import { calcDuration, calcKompensasi } from '@/lib/calculations'
import { DEFAULT_PROJECTS } from '@/lib/types'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// Indonesian month names → month number
const ID_MONTHS: Record<string, number> = {
  januari:1, februari:2, maret:3, april:4, mei:5, juni:6,
  juli:7, agustus:8, september:9, oktober:10, november:11, desember:12,
}

function parseIdDate(raw: string): string | null {
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
    if (/^\d{1,2}:\d{2}$/.test(val.trim())) return val.trim()
    return null
  }
  if (typeof val !== 'number' || val < 0 || val > 1) return null
  const totalMin = Math.round(val * 24 * 60)
  const h = Math.floor(totalMin / 60) % 24
  const m = totalMin % 60
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`
}

// Parse a cell that may contain multiple time values separated by newlines.
// Returns array of "HH:MM" strings.
function parseTimeCell(val: unknown): string[] {
  if (typeof val === 'string') {
    const lines = val.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    return lines.map(l => excelTimeToHHMM(l)).filter((t): t is string => t !== null)
  }
  const t = excelTimeToHHMM(val)
  return t ? [t] : []
}

function detectProject(kegiatan: string): { project: string; desc: string } {
  const m = kegiatan.match(/^\[([^\]]+)\]\s*(.*)/)
  if (m) {
    const raw = m[1].trim().toUpperCase()
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

// Detect column indices by header name — works regardless of column ordering or language.
function buildColMap(header: string[]): Record<string, number> {
  const map: Record<string, number> = {}
  header.forEach((h, i) => {
    // Normalise: lowercase, collapse whitespace
    const lh = h.toLowerCase().replace(/\s+/g, ' ').trim()

    if (lh.includes('nik') || lh.includes('nomor induk') || lh.includes('no induk') || lh.includes('induk karyawan')) {
      map.nik = i
    } else if (lh.includes('nama') || lh.includes('name')) {
      map.nama = i
    } else if (lh.includes('kegiatan') || lh.includes('activity') || lh.includes('description') || lh.includes('keterangan')) {
      map.kegiatan = i
    } else if (
      // "Tanggal" / "Date" / "Hari" — but NOT "tanggal dari/akhir/sampai" (those are time columns)
      (lh.includes('tanggal') || lh.includes('date') || lh.includes('hari')) &&
      !lh.includes('dari') && !lh.includes('from') &&
      !lh.includes('akhir') && !lh.includes('end') && !lh.includes('sampai') && !lh.includes('to')
    ) {
      map.tanggal = i
    } else if (
      lh.startsWith('dari') || lh === 'from' ||
      lh.includes('tanggal dari') || lh.includes('date from') || lh.includes('tgl dari') ||
      lh.includes('waktu dari') || lh.includes('mulai') || lh.includes('start')
    ) {
      map.dari = i
    } else if (
      lh.startsWith('sampai') || lh === 'to' || lh === 'until' ||
      lh.includes('tanggal akhir') || lh.includes('tanggal sampai') ||
      lh.includes('date end') || lh.includes('date to') ||
      lh.includes('tgl akhir') || lh.includes('tgl sampai') ||
      lh.includes('waktu sampai') || lh.includes('selesai') || lh.includes('end')
    ) {
      map.sampai = i
    } else if (lh.includes('selama') || (lh.includes('durasi') && !lh.includes('total'))) {
      map.durasi = i
    } else if (lh === 'wfo' || lh === 'wfh') {
      map.wfo = i
    } else if (lh.includes('stand by') || lh.includes('standby')) {
      map.standby = i
    } else if (lh.includes('akhir pekan') || lh.includes('merah') || lh.includes('weekend') || lh.includes('holiday')) {
      map.weekend = i
    } else if (lh.includes('total')) {
      map.total = i
    }
  })
  return map
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

  // Must have NIK or Nama as first column
  const firstCol = header[0]
  if (!firstCol.includes('nik') && !firstCol.includes('nomor') && firstCol !== 'nama') {
    return NextResponse.json({
      error: 'Format file tidak dikenal. Pastikan menggunakan template lembur yang benar.',
      expectedHeader: 'Kolom pertama harus "NIK", "Nomor Induk Karyawan", atau "Nama".',
    }, { status: 422 })
  }

  // Build column map from headers — flexible, order-independent
  const COL = buildColMap(header)

  // Fallback for old format (Nama first, fixed positions)
  if (firstCol === 'nama' && COL.nik === undefined) {
    COL.nik = 1; COL.nama = 0; COL.kegiatan = 2; COL.tanggal = 3
    COL.dari = 4; COL.sampai = 5; COL.durasi = 6; COL.weekend = 7
  }

  if (COL.dari === undefined || COL.sampai === undefined) {
    return NextResponse.json({
      error: 'Kolom "Dari" dan "Sampai" tidak ditemukan di file.',
    }, { status: 422 })
  }

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
    if (row.every(c => c === '' || c === null || c === undefined)) continue

    if (!parsedNik && COL.nik !== undefined) parsedNik  = String(row[COL.nik]  ?? '').trim()
    if (!parsedNama && COL.nama !== undefined) parsedNama = String(row[COL.nama] ?? '').trim()

    const kegiatanRaw = String(row[COL.kegiatan] ?? '').trim()
    const tanggalRaw  = String(row[COL.tanggal]  ?? '').trim()

    if (!kegiatanRaw) continue

    const hari_tanggal = parseIdDate(tanggalRaw)
    if (!hari_tanggal) {
      errors.push({ row: i + 1, field: 'Hari, Tanggal', message: `"${tanggalRaw}" tidak bisa diparsing. Format: "Senin, 01 Juni 2026"` })
      continue
    }

    const { project, desc } = detectProject(kegiatanRaw)
    if (!project) {
      errors.push({ row: i+1, field: 'Kegiatan/Project', message: `Tidak bisa mendeteksi project dari: "${kegiatanRaw}". Tambahkan prefix [NAMA PROJECT].` })
    }

    const standby    = COL.standby  !== undefined ? parseBoolean(row[COL.standby])  : false
    const akhir_pekan = COL.weekend !== undefined ? parseBoolean(row[COL.weekend])  : false
    const wfo        = COL.wfo      !== undefined ? parseBoolean(row[COL.wfo])       : false

    // Parse time cells — may contain multiple values separated by newlines
    const dariTimes   = parseTimeCell(row[COL.dari])
    const sampaiTimes = parseTimeCell(row[COL.sampai])

    if (dariTimes.length === 0) {
      errors.push({ row: i+1, field: 'Dari Jam', message: `Nilai tidak valid: "${row[COL.dari]}"` })
      continue
    }
    if (sampaiTimes.length === 0) {
      errors.push({ row: i+1, field: 'Sampai Jam', message: `Nilai tidak valid: "${row[COL.sampai]}"` })
      continue
    }
    if (dariTimes.length !== sampaiTimes.length) {
      errors.push({ row: i+1, field: 'Dari/Sampai Jam', message: `Jumlah waktu "Dari" (${dariTimes.length}) dan "Sampai" (${sampaiTimes.length}) tidak sama.` })
      continue
    }

    // One Excel row may expand to multiple entries (one per time range)
    for (let t = 0; t < dariTimes.length; t++) {
      const dari_jam   = dariTimes[t]
      const sampai_jam = sampaiTimes[t]

      // For multi-range rows, durasi per slot is recalculated (can't split the cell value)
      const durasi = calcDuration(dari_jam, sampai_jam)
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
  }

  if (!commit) {
    return NextResponse.json({ parsed, errors, parsedNik, parsedNama, totalRows: parsed.length })
  }

  if (errors.length > 0) {
    return NextResponse.json({ error: 'Selesaikan error sebelum menyimpan.', errors }, { status: 422 })
  }

  const db = getAdminClient()

  await db.from('lembur_months').upsert(
    { user_id: user.id, bulan },
    { onConflict: 'user_id,bulan', ignoreDuplicates: true }
  )
  const { data: month } = await db
    .from('lembur_months').select('id').eq('user_id', user.id).eq('bulan', bulan).single()

  if (!month) return NextResponse.json({ error: 'Gagal membuat record bulan.' }, { status: 500 })

  const inserts = parsed.map(p => ({
    month_id:     month.id,
    user_id:      user.id,
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
