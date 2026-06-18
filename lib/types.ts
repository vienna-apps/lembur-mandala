export interface Profile {
  id: string
  nik: string
  nama: string
  is_admin: boolean
  username: string         // first name lowercase, used for login
  gmail: string | null     // optional @daksa.co.id email for password reset
}

export interface Deadline {
  bulan: string        // "YYYY-MM"
  deadline_date: string | null  // ISO date string
}

export interface LemburMonth {
  id: string
  user_id: string
  bulan: string        // "YYYY-MM"
  status: 'draft' | 'submitted'
  submitted_at: string | null
  created_at: string
  // joined
  profile?: Profile
}

export interface LemburEvent {
  id: string
  month_id: string
  user_id: string
  hari_tanggal: string  // ISO date "YYYY-MM-DD"
  project: string
  kegiatan: string[]    // array — multiple descriptions per event
  dari_jam: string      // "HH:MM"
  sampai_jam: string    // "HH:MM"
  durasi: number        // manually editable
  standby: boolean
  akhir_pekan: boolean
  wfo: boolean
  total_jam: number     // kompensasi result
  bukti_urls?: string[] | null
  created_at: string
}

// Admin view: month with all submissions
export interface AdminMonth {
  bulan: string
  deadline: Deadline | null
  submissions: Array<LemburMonth & { profile: Profile; events: LemburEvent[] }>
}

export const DEFAULT_PROJECTS = [
  'CAMBER BMS',
  'CAMBER KALTENG',
  'BKC',
  'ATM - RECON',
  'RECON QNB',
] as const

export const DEFAULT_SUGGESTIONS = [
  'Standby Zoom',
  'Standby Discord',
  'Execute Queries',
  'Execute Deployment',
  'Make Query',
  'Check Log',
  'Konfirmasi semua berjalan sesuai timeline',
]

/** "YYYY-MM" for the current month */
export function currentBulan(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** "Juni 2026" style label from "2026-06" */
export function bulanLabel(bulan: string): string {
  const [y, m] = bulan.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })
}

/** short label e.g. "Jun 2026" */
export function bulanShort(bulan: string): string {
  const [y, m] = bulan.split('-')
  const date = new Date(Number(y), Number(m) - 1, 1)
  return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' })
}
