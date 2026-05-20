export interface Employee {
  nik: string
  nama: string
}

export interface LemburEntry {
  id?: string
  nama: string
  nik: string
  hari_tanggal: string   // ISO date string
  project: string        // e.g. "CAMBER - BMS"
  kegiatan: string       // full description
  dari_jam: string       // "HH:MM"
  sampai_jam: string     // "HH:MM"
  durasi: number         // hours
  standby: boolean
  akhir_pekan: boolean
  wfo: boolean
  total_jam: number      // compensated hours
  catatan?: string
  folder_label?: string  // e.g. "Apr 2026" (for late subs)
  submitted_at?: string
}

export interface MonthlyReport {
  label: string          // "Apr 2026"
  entries: LemburEntry[]
  total_durasi: number
  total_kompensasi: number
}

export type EventCategory =
  | 'CAMBER BMS'
  | 'CAMBER KALTENG'
  | 'BKC'
  | 'ATM - RECON'
  | 'RECON QNB'
  | 'OTHER'

export const EVENT_MAP: [EventCategory, string[]][] = [
  ['CAMBER BMS',     ['camber bms', 'camber - bms', 'camber-bms', '[bms]']],
  ['CAMBER KALTENG', ['camber kalteng', 'camber - kalteng', 'camber-kalteng', 'icms kalteng']],
  ['BKC',            ['mb bkc', 'onion bkc', 'bkc']],
  ['ATM - RECON',    ['atm - recon', 'atm recon']],
  ['RECON QNB',      ['recon qnb']],
]

export const EVENT_ORDER: EventCategory[] = [
  'CAMBER BMS', 'CAMBER KALTENG', 'BKC', 'ATM - RECON', 'RECON QNB', 'OTHER',
]

export const DEFAULT_EMPLOYEES: Employee[] = [
  { nik: '170050', nama: 'Vania Sanjaya' },
  { nik: '210070', nama: 'Luqmanul Hakim Aziz' },
  { nik: '230011', nama: 'Aditya Ari Pratama' },
  { nik: '200030', nama: 'Rizaldi Andriyana' },
  { nik: '190082', nama: 'Zamzam Jamaludin Abdullah' },
  { nik: '260018', nama: 'Zulvan Fadhillah' },
  { nik: '200097', nama: 'Pega Kurnia' },
]

export const DEFAULT_PROJECTS = [
  'CAMBER BMS',
  'CAMBER KALTENG',
  'BKC',
  'ATM - RECON',
  'RECON QNB',
]

export const DEFAULT_SUGGESTIONS = [
  'Standby Zoom',
  'Standby Discord',
  'Execute Queries',
  'Execute Deployment',
  'Make Query',
  'Check Log',
  'Konfirmasi semua berjalan sesuai timeline',
]

export const MOM_LABELS = [
  'Okt 2025', 'Nov 2025', 'Des 2025',
  'Jan 2026', 'Feb 2026', 'Mar 2026', 'Apr 2026', 'Mei 2026',
]
