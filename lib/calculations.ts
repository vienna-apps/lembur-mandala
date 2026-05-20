import type { LemburEntry, EventCategory, EVENT_MAP } from './types'
import { EVENT_ORDER } from './types'

export function calcDuration(dari: string, sampai: string): number {
  const [dh, dm] = dari.split(':').map(Number)
  const [sh, sm] = sampai.split(':').map(Number)
  let start = dh * 60 + dm
  let end = sh * 60 + sm
  if (end <= start) end += 24 * 60 // past midnight
  return (end - start) / 60
}

export function calcKompensasi(durasi: number, standby: boolean, akhirPekan: boolean): number {
  // Both flags apply independently: akhir pekan ×2, standby ×0.5 → combined = ×1
  const mult = (akhirPekan ? 2 : 1) * (standby ? 0.5 : 1)
  return durasi * mult
}

export function normalizeEvent(project: string, kegiatan: string): EventCategory {
  const eventMap: [EventCategory, string[]][] = [
    ['CAMBER BMS',     ['camber bms', 'camber - bms', 'camber-bms', '[bms]']],
    ['CAMBER KALTENG', ['camber kalteng', 'camber - kalteng', 'camber-kalteng', 'icms kalteng']],
    ['BKC',            ['mb bkc', 'onion bkc', 'bkc']],
    ['ATM - RECON',    ['atm - recon', 'atm recon']],
    ['RECON QNB',      ['recon qnb']],
  ]

  const text = `${project} ${kegiatan}`.toLowerCase()
  for (const [canonical, kws] of eventMap) {
    for (const kw of kws) {
      if (text.includes(kw)) return canonical
    }
  }
  return 'OTHER'
}

export function formatHours(h: number): string {
  return h.toFixed(2)
}

export function getCurrentMonthLabel(): string {
  const now = new Date()
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}
