'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart3, Users, Clock, Download, Trash2, ChevronDown,
  ChevronRight, RefreshCw, Table2, TrendingUp, AlertCircle,
  FileText, X
} from 'lucide-react'
import type { LemburEntry } from '@/lib/types'
import { EVENT_ORDER, MOM_LABELS, DEFAULT_EMPLOYEES } from '@/lib/types'
import { normalizeEvent, calcKompensasi } from '@/lib/calculations'

const ADMIN_PASS = process.env.NEXT_PUBLIC_ADMIN_PASS || 'mandala2026'

type Tab = 'karyawan' | 'event' | 'mom' | 'raw'

function useFolderLabel() {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const now = new Date()
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

export default function AdminDashboard() {
  const [authed, setAuthed] = useState(false)
  const [pass, setPass] = useState('')
  const [passErr, setPassErr] = useState('')
  const [entries, setEntries] = useState<LemburEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<Tab>('karyawan')
  const [folderFilter, setFolderFilter] = useState(useFolderLabel())
  const [expandedPerson, setExpandedPerson] = useState<string | null>(null)
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [copyMsg, setCopyMsg] = useState('')

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/entries')
      const data = await res.json()
      setEntries(Array.isArray(data) ? data : [])
    } catch {
      setEntries([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) fetchEntries()
  }, [authed, fetchEntries])

  function login() {
    if (pass === ADMIN_PASS) { setAuthed(true); setPassErr('') }
    else setPassErr('Password salah!')
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/entries/${id}`, { method: 'DELETE' })
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeleteConfirm(null)
  }

  // ── Derived data ──
  const filtered = entries.filter(e => !folderFilter || e.folder_label === folderFilter)
  const allFolders = [...new Set(entries.map(e => e.folder_label).filter(Boolean))] as string[]

  // Per-karyawan
  const persons: Record<string, { recs: LemburEntry[]; dur: number; comp: number }> = {}
  for (const r of filtered) {
    if (!persons[r.nama]) persons[r.nama] = { recs: [], dur: 0, comp: 0 }
    persons[r.nama].recs.push(r)
    persons[r.nama].dur += r.durasi
    persons[r.nama].comp += r.total_jam
  }

  // Per-event (all data)
  const evData: Record<string, Record<string, LemburEntry[]>> = {}
  for (const ev of EVENT_ORDER) { evData[ev] = {} }
  for (const r of filtered) {
    const ev = normalizeEvent(r.project, r.kegiatan)
    if (!evData[ev]) evData[ev] = {}
    const ml = r.folder_label || 'Unknown'
    if (!evData[ev][ml]) evData[ev][ml] = []
    evData[ev][ml].push(r)
  }

  // MoM: all entries
  const mom: Record<string, Record<string, { dur: number; comp: number; sesi: number }>> = {}
  for (const ev of EVENT_ORDER) {
    mom[ev] = {}
    for (const m of MOM_LABELS) mom[ev][m] = { dur: 0, comp: 0, sesi: 0 }
  }
  for (const r of entries) {
    const ev = normalizeEvent(r.project, r.kegiatan)
    const ml = r.folder_label || ''
    if (!mom[ev]) mom[ev] = {}
    if (!mom[ev][ml]) mom[ev][ml] = { dur: 0, comp: 0, sesi: 0 }
    mom[ev][ml].dur += r.durasi
    mom[ev][ml].comp += r.total_jam
    mom[ev][ml].sesi += 1
  }

  const activeMomLabels = MOM_LABELS.filter(m => entries.some(e => e.folder_label === m))

  // ── Export helpers ──
  function buildTSV(): string {
    const lines: string[] = []
    lines.push(`LEMBUR MANDALA - ${folderFilter}`)
    lines.push('Laporan Lembur per Karyawan')
    lines.push('')
    for (const [name, d] of Object.entries(persons)) {
      lines.push(`=== ${name} ===`)
      lines.push(`Total Sesi: ${d.recs.length}    Total Durasi: ${d.dur.toFixed(2)}h    Total Kompensasi: ${d.comp.toFixed(2)}h`)
      lines.push(['Tanggal','Kegiatan','Dari','Sampai','Durasi (jam)','Akhir Pekan','Standby','WFO','Total Kompensasi (jam)','Catatan'].join('\t'))
      for (const r of d.recs) {
        const late = r.folder_label !== folderFilter ? `Late sub - ${r.folder_label}` : ''
        lines.push([
          r.hari_tanggal, r.kegiatan, r.dari_jam, r.sampai_jam,
          r.durasi.toFixed(2), r.akhir_pekan ? 'Ya' : 'Tidak',
          r.standby ? 'Ya' : 'Tidak', r.wfo ? 'Ya' : 'Tidak',
          r.total_jam.toFixed(2), late,
        ].join('\t'))
      }
      lines.push(`Subtotal: ${d.dur.toFixed(2)}h durasi    ${d.comp.toFixed(2)}h kompensasi`)
      lines.push('')
    }
    const gd = filtered.reduce((s, r) => ({ dur: s.dur + r.durasi, comp: s.comp + r.total_jam }), { dur: 0, comp: 0 })
    lines.push('=== GRAND TOTAL ===')
    lines.push(`Total Sesi: ${filtered.length}    Total Durasi: ${gd.dur.toFixed(2)}h    Total Kompensasi: ${gd.comp.toFixed(2)}h`)
    return lines.join('\n')
  }

  function downloadTSV(content: string, filename: string) {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopyMsg('Copied!'); setTimeout(() => setCopyMsg(''), 2000)
    })
  }

  // ── Login screen ──
  if (!authed) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full fade-up">
          <div className="w-14 h-14 rounded-2xl gradient-bg flex items-center justify-center mx-auto mb-6">
            <BarChart3 className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-center text-slate-800 mb-1">Admin Dashboard</h1>
          <p className="text-center text-slate-500 text-sm mb-6">Lembur Mandala — Akses Terbatas</p>
          <input
            type="password"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && login()}
            placeholder="Password admin..."
            className={`w-full px-4 py-2.5 rounded-xl border-2 transition-colors focus:outline-none mb-3 ${passErr ? 'border-red-400' : 'border-slate-200 focus:border-violet-400'}`}
          />
          {passErr && (
            <p className="text-red-500 text-xs mb-3 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{passErr}</p>
          )}
          <button
            onClick={login}
            className="w-full py-2.5 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Masuk
          </button>
        </div>
      </div>
    )
  }

  // ── Main Dashboard ──
  const totalDur = filtered.reduce((s, r) => s + r.durasi, 0)
  const totalComp = filtered.reduce((s, r) => s + r.total_jam, 0)
  const numPersons = Object.keys(persons).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Copy toast */}
      {copyMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 bg-emerald-500 text-white rounded-xl text-sm font-medium shadow-lg slide-down">
          {copyMsg}
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full fade-up">
            <h3 className="font-bold text-slate-800 mb-2">Hapus entri ini?</h3>
            <p className="text-sm text-slate-500 mb-5">Data yang dihapus tidak bisa dikembalikan.</p>
            <div className="flex gap-3">
              <button onClick={() => deleteEntry(deleteConfirm)} className="flex-1 py-2 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors">Hapus</button>
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-xl border-2 border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors">Batal</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="gradient-bg text-white px-6 py-6">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold">Admin Dashboard</h1>
              <p className="text-white/70 text-sm">Lembur Mandala</p>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={fetchEntries} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm font-medium transition-colors">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              {/* Folder filter */}
              <div className="relative">
                <select
                  value={folderFilter}
                  onChange={e => setFolderFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-sm text-white font-medium border border-white/30 focus:outline-none"
                >
                  <option value="">Semua bulan</option>
                  {[...new Set([...MOM_LABELS, ...allFolders])].map(m => (
                    <option key={m} value={m} className="text-slate-800">{m}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { icon: Clock, label: 'Total Durasi', value: `${totalDur.toFixed(1)}h` },
              { icon: TrendingUp, label: 'Kompensasi', value: `${totalComp.toFixed(1)}h` },
              { icon: Users, label: 'Karyawan', value: numPersons },
            ].map(s => (
              <div key={s.label} className="bg-white/15 backdrop-blur-sm rounded-xl p-4 text-center">
                <s.icon className="w-5 h-5 mx-auto mb-1 text-white/80" />
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-white/70 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-6xl mx-auto px-4 mt-6">
        <div className="flex gap-1 bg-white rounded-xl p-1.5 border border-slate-200 mb-6 w-fit">
          {[
            { id: 'karyawan' as Tab, label: 'Per Karyawan', icon: Users },
            { id: 'event' as Tab, label: 'Per Event', icon: BarChart3 },
            { id: 'mom' as Tab, label: 'MoM', icon: TrendingUp },
            { id: 'raw' as Tab, label: 'Semua Data', icon: Table2 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.id ? 'gradient-bg text-white shadow-sm' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
            >
              <t.icon className="w-4 h-4" />{t.label}
            </button>
          ))}
        </div>

        {/* ── Per Karyawan Tab ── */}
        {tab === 'karyawan' && (
          <div className="fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-700">Laporan per Karyawan — {folderFilter || 'Semua Bulan'}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(buildTSV())}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <FileText className="w-4 h-4" /> Copy TSV
                </button>
                <button
                  onClick={() => downloadTSV(buildTSV(), `Lembur-Mandala-${folderFilter || 'All'}-PerKaryawan.txt`)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg gradient-bg text-white text-sm hover:opacity-90 transition-opacity"
                >
                  <Download className="w-4 h-4" /> Download
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(persons).map(([name, d]) => (
                <div key={name} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedPerson(expandedPerson === name ? null : name)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full gradient-bg flex items-center justify-center text-white text-sm font-bold">
                        {name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="font-semibold text-slate-800">{name}</div>
                        <div className="text-xs text-slate-400">{d.recs.length} sesi · {d.dur.toFixed(2)}h durasi</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-bold text-violet-600">{d.comp.toFixed(2)}h</span>
                      {expandedPerson === name ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                    </div>
                  </button>

                  {expandedPerson === name && (
                    <div className="border-t border-slate-100 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50">
                            {['Tanggal','Kegiatan','Dari','Sampai','Durasi','Wknd','Stdby','WFO','Komp','Catatan',''].map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-slate-500">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {d.recs.map(r => (
                            <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                              <td className="px-3 py-2 whitespace-nowrap text-slate-600">{r.hari_tanggal}</td>
                              <td className="px-3 py-2 text-slate-700 max-w-[200px]">{r.kegiatan}</td>
                              <td className="px-3 py-2 font-mono text-slate-600">{r.dari_jam}</td>
                              <td className="px-3 py-2 font-mono text-slate-600">{r.sampai_jam}</td>
                              <td className="px-3 py-2 font-mono text-slate-600">{r.durasi.toFixed(2)}</td>
                              <td className="px-3 py-2 text-center">{r.akhir_pekan ? <span className="text-amber-600 font-bold">Ya</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="px-3 py-2 text-center">{r.standby ? <span className="text-blue-600 font-bold">Ya</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="px-3 py-2 text-center">{r.wfo ? <span className="text-green-600 font-bold">Ya</span> : <span className="text-slate-300">-</span>}</td>
                              <td className="px-3 py-2 font-bold font-mono text-violet-700">{r.total_jam.toFixed(2)}</td>
                              <td className="px-3 py-2 text-slate-400 italic">{r.folder_label !== folderFilter ? `Late - ${r.folder_label}` : ''}</td>
                              <td className="px-3 py-2">
                                <button onClick={() => setDeleteConfirm(r.id!)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div className="px-4 py-2 bg-violet-50 border-t border-violet-100 flex gap-6 text-xs font-semibold text-violet-700">
                        <span>Subtotal: {d.recs.length} sesi</span>
                        <span>{d.dur.toFixed(2)}h durasi</span>
                        <span>{d.comp.toFixed(2)}h kompensasi</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {Object.keys(persons).length === 0 && (
                <EmptyState msg="Belum ada data untuk periode ini" />
              )}
            </div>
          </div>
        )}

        {/* ── Per Event Tab ── */}
        {tab === 'event' && (
          <div className="fade-up space-y-3">
            {EVENT_ORDER.filter(ev => Object.values(evData[ev] || {}).some(r => r.length > 0)).map(ev => {
              const allEvRecs = Object.values(evData[ev] || {}).flat()
              const evDur = allEvRecs.reduce((s, r) => s + r.durasi, 0)
              const evComp = allEvRecs.reduce((s, r) => s + r.total_jam, 0)

              return (
                <div key={ev} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <button
                    onClick={() => setExpandedEvent(expandedEvent === ev ? null : ev)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 rounded-full text-xs font-bold gradient-bg text-white">{ev}</span>
                      <span className="text-sm text-slate-500">{allEvRecs.length} sesi · {evDur.toFixed(2)}h</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="font-bold text-violet-600">{evComp.toFixed(2)}h kompensasi</span>
                      {expandedEvent === ev ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                    </div>
                  </button>

                  {expandedEvent === ev && (
                    <div className="border-t border-slate-100">
                      {Object.entries(evData[ev] || {}).filter(([, r]) => r.length > 0).map(([month, recs]) => {
                        const mDur = recs.reduce((s, r) => s + r.durasi, 0)
                        const mComp = recs.reduce((s, r) => s + r.total_jam, 0)
                        return (
                          <div key={month}>
                            <div className="px-5 py-2 bg-slate-50 text-xs font-semibold text-slate-500 flex gap-4">
                              <span>{month}</span>
                              <span>{recs.length} sesi</span>
                              <span>{mDur.toFixed(2)}h durasi</span>
                              <span>{mComp.toFixed(2)}h kompensasi</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-slate-50/50">
                                    {['Nama','Tanggal','Kegiatan','Dari','Sampai','Durasi','Wknd','Stdby','WFO','Komp'].map(h => (
                                      <th key={h} className="px-3 py-1.5 text-left font-semibold text-slate-400">{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {recs.map(r => (
                                    <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                                      <td className="px-3 py-2 font-medium text-slate-700">{r.nama}</td>
                                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.hari_tanggal}</td>
                                      <td className="px-3 py-2 text-slate-700 max-w-[180px]">{r.kegiatan}</td>
                                      <td className="px-3 py-2 font-mono">{r.dari_jam}</td>
                                      <td className="px-3 py-2 font-mono">{r.sampai_jam}</td>
                                      <td className="px-3 py-2 font-mono">{r.durasi.toFixed(2)}</td>
                                      <td className="px-3 py-2 text-center">{r.akhir_pekan ? 'Ya' : '-'}</td>
                                      <td className="px-3 py-2 text-center">{r.standby ? 'Ya' : '-'}</td>
                                      <td className="px-3 py-2 text-center">{r.wfo ? 'Ya' : '-'}</td>
                                      <td className="px-3 py-2 font-bold text-violet-700 font-mono">{r.total_jam.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
            {EVENT_ORDER.every(ev => !Object.values(evData[ev] || {}).some(r => r.length > 0)) && (
              <EmptyState msg="Belum ada data" />
            )}
          </div>
        )}

        {/* ── MoM Tab ── */}
        {tab === 'mom' && (
          <div className="fade-up">
            <h2 className="font-semibold text-slate-700 mb-4">Month-over-Month — Kompensasi per Event (jam)</h2>
            <div className="overflow-x-auto">
              <table className="w-full bg-white rounded-xl border border-slate-200 text-sm">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-600 min-w-[140px]">Event</th>
                    {activeMomLabels.map(m => (
                      <th key={m} className="px-4 py-3 text-center font-semibold text-slate-600 whitespace-nowrap">{m}</th>
                    ))}
                    <th className="px-4 py-3 text-center font-semibold text-violet-700">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {EVENT_ORDER.filter(ev => activeMomLabels.some(m => mom[ev]?.[m]?.sesi > 0)).map((ev, i) => {
                    const totComp = activeMomLabels.reduce((s, m) => s + (mom[ev]?.[m]?.comp || 0), 0)
                    return (
                      <tr key={ev} className={`border-t border-slate-100 ${i % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                        <td className="px-4 py-3 font-semibold text-slate-700">{ev}</td>
                        {activeMomLabels.map(m => {
                          const d = mom[ev]?.[m]
                          return (
                            <td key={m} className="px-4 py-3 text-center">
                              {d?.sesi ? (
                                <div>
                                  <div className="font-bold text-violet-700">{d.comp.toFixed(2)}</div>
                                  <div className="text-xs text-slate-400">{d.sesi}× · {d.dur.toFixed(1)}h</div>
                                </div>
                              ) : <span className="text-slate-200">—</span>}
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-center font-bold text-violet-700">{totComp.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                  {/* Grand total row */}
                  <tr className="border-t-2 border-slate-200 bg-violet-50">
                    <td className="px-4 py-3 font-bold text-violet-800">TOTAL</td>
                    {activeMomLabels.map(m => {
                      const tot = EVENT_ORDER.reduce((s, ev) => s + (mom[ev]?.[m]?.comp || 0), 0)
                      return (
                        <td key={m} className="px-4 py-3 text-center font-bold text-violet-800">{tot > 0 ? tot.toFixed(2) : '—'}</td>
                      )
                    })}
                    <td className="px-4 py-3 text-center font-bold text-violet-800">
                      {EVENT_ORDER.reduce((s, ev) => s + activeMomLabels.reduce((ss, m) => ss + (mom[ev]?.[m]?.comp || 0), 0), 0).toFixed(2)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Raw Data Tab ── */}
        {tab === 'raw' && (
          <div className="fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-700">Semua Entri ({filtered.length})</h2>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Nama','Tanggal','Project','Kegiatan','Dari','Sampai','Durasi','Wknd','Stdby','WFO','Komp','Label',''].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left font-semibold text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50/60">
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{r.nama}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.hari_tanggal}</td>
                      <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{r.project}</td>
                      <td className="px-3 py-2 text-slate-700 max-w-[180px] truncate">{r.kegiatan}</td>
                      <td className="px-3 py-2 font-mono">{r.dari_jam}</td>
                      <td className="px-3 py-2 font-mono">{r.sampai_jam}</td>
                      <td className="px-3 py-2 font-mono">{r.durasi.toFixed(2)}</td>
                      <td className="px-3 py-2 text-center text-amber-600">{r.akhir_pekan ? 'Ya' : '-'}</td>
                      <td className="px-3 py-2 text-center text-blue-600">{r.standby ? 'Ya' : '-'}</td>
                      <td className="px-3 py-2 text-center text-green-600">{r.wfo ? 'Ya' : '-'}</td>
                      <td className="px-3 py-2 font-bold text-violet-700 font-mono">{r.total_jam.toFixed(2)}</td>
                      <td className="px-3 py-2 text-slate-400 whitespace-nowrap">{r.folder_label}</td>
                      <td className="px-3 py-2">
                        <button onClick={() => setDeleteConfirm(r.id!)} className="p-1 rounded hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <div className="p-12 text-center text-slate-400">Belum ada data</div>}
            </div>
          </div>
        )}

        <div className="h-12" />
      </div>
    </div>
  )
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
        <AlertCircle className="w-6 h-6 text-slate-400" />
      </div>
      <p className="text-slate-500">{msg}</p>
    </div>
  )
}
