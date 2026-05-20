'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, Trash2, Clock, Calendar, CheckCircle2,
  Briefcase, Save, RotateCcw, Info, LogOut, BadgeCheck,
} from 'lucide-react'
import { DEFAULT_PROJECTS, DEFAULT_SUGGESTIONS } from '@/lib/types'
import { calcDuration, calcKompensasi } from '@/lib/calculations'
import { getStoredUser, clearUser } from '@/lib/auth'
import type { AuthUser } from '@/lib/auth'

// ── Types ────────────────────────────────────────────────────────────────────

interface ActivityRow {
  id: number
  kegiatan: string
  dari_jam: string
  sampai_jam: string
  durasi: number
  standby: boolean
  akhir_pekan: boolean
  wfo: boolean
}

interface Toast {
  id: number
  msg: string
  type: 'success' | 'error'
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getCurrentMonthLabel() {
  const months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
  const now = new Date()
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

function isWeekend(dateStr: string): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LemburForm() {
  const router = useRouter()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [project, setProject] = useState('')
  const [isLate, setIsLate] = useState(false)
  const [folderLabel, setFolderLabel] = useState(getCurrentMonthLabel())
  const [activities, setActivities] = useState<ActivityRow[]>([])
  const [counter, setCounter] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS)

  // ── Auth check on mount ──
  useEffect(() => {
    const u = getStoredUser()
    if (!u) {
      router.replace('/login')
      return
    }
    setUser(u)
    addActivity()
    // Load suggestions from API
    fetch('/api/suggestions')
      .then(r => r.json())
      .then((data: string[]) => { if (Array.isArray(data) && data.length) setSuggestions(data) })
      .catch(() => {/* use defaults */})
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const pushToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  function addActivity(copy?: Partial<ActivityRow>) {
    const id = counter + 1
    setCounter(id)
    const wknd = isWeekend(date)
    setActivities(prev => [...prev, {
      id,
      kegiatan:    copy?.kegiatan    ?? '',
      dari_jam:    copy?.dari_jam    ?? '21:00',
      sampai_jam:  copy?.sampai_jam  ?? '00:00',
      durasi:      copy?.durasi      ?? 3,
      standby:     copy?.standby     ?? false,
      akhir_pekan: copy?.akhir_pekan ?? wknd,
      wfo:         copy?.wfo         ?? false,
    }])
  }

  function removeActivity(id: number) {
    setActivities(prev => prev.filter(a => a.id !== id))
  }

  function updateActivity(id: number, patch: Partial<ActivityRow>) {
    setActivities(prev => prev.map(a => {
      if (a.id !== id) return a
      const updated = { ...a, ...patch }
      if (patch.dari_jam !== undefined || patch.sampai_jam !== undefined) {
        updated.durasi = calcDuration(updated.dari_jam, updated.sampai_jam)
      }
      return updated
    }))
  }

  // When date changes, auto-update akhir_pekan for all activities
  function handleDateChange(newDate: string) {
    setDate(newDate)
    const wknd = isWeekend(newDate)
    setActivities(prev => prev.map(a => ({ ...a, akhir_pekan: wknd })))
  }

  function handleLogout() {
    clearUser()
    router.push('/login')
  }

  async function handleSubmit() {
    if (!project) { pushToast('Pilih project dulu!', 'error'); return }
    if (activities.length === 0) { pushToast('Tambahkan minimal 1 kegiatan!', 'error'); return }
    if (activities.some(a => !a.kegiatan.trim())) {
      pushToast('Isi deskripsi kegiatan untuk semua baris!', 'error'); return
    }

    setSubmitting(true)
    try {
      const label = isLate ? folderLabel : getCurrentMonthLabel()
      for (const act of activities) {
        const total_jam = calcKompensasi(act.durasi, act.standby, act.akhir_pekan)
        const res = await fetch('/api/entries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nama:        user!.nama,
            nik:         user!.nik,
            hari_tanggal: date,
            project,
            kegiatan:    `[${project}] ${act.kegiatan}`,
            dari_jam:    act.dari_jam,
            sampai_jam:  act.sampai_jam,
            durasi:      act.durasi,
            standby:     act.standby,
            akhir_pekan: act.akhir_pekan,
            wfo:         act.wfo,
            total_jam,
            folder_label: label,
          }),
        })
        if (!res.ok) {
          const e = await res.json()
          throw new Error(e.error || 'Server error')
        }
        // Save kegiatan as suggestion
        if (act.kegiatan.trim()) {
          fetch('/api/suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: act.kegiatan.trim() }),
          }).catch(() => {})
        }
      }
      setSubmitted(true)
      pushToast(`${activities.length} kegiatan berhasil disimpan!`)
    } catch (e: unknown) {
      pushToast(e instanceof Error ? e.message : 'Gagal menyimpan', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  function handleReset() {
    setProject('')
    setDate(new Date().toISOString().slice(0, 10))
    setIsLate(false); setSubmitted(false)
    setActivities([]); setCounter(0)
    setTimeout(() => addActivity(), 0)
  }

  const totalDurasi = activities.reduce((s, a) => s + a.durasi, 0)
  const totalKomp   = activities.reduce((s, a) => s + calcKompensasi(a.durasi, a.standby, a.akhir_pekan), 0)

  // ── Success screen ──
  if (submitted) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center fade-up">
          <div className="w-20 h-20 rounded-full gradient-bg flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Tersimpan!</h2>
          <p className="text-gray-500 mb-2">{activities.length} kegiatan lembur berhasil dicatat.</p>
          <p className="text-sm text-violet-600 font-medium mb-8">
            {user?.nama} — {new Date(date + 'T00:00:00').toLocaleDateString('id-ID', { dateStyle: 'long' })}
          </p>
          <button
            onClick={handleReset}
            className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 transition-opacity"
          >
            Input Lagi
          </button>
        </div>
      </div>
    )
  }

  if (!user) return null // still loading / redirecting

  return (
    <div className="min-h-screen gradient-bg py-8 px-4">
      {/* Toast Notifications */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map(t => (
          <div key={t.id} className={`slide-down px-5 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${t.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
            {t.msg}
          </div>
        ))}
      </div>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 fade-up">
          <div className="text-white">
            <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm rounded-full px-4 py-1.5 text-white/90 text-sm mb-2 w-fit">
              <Clock className="w-4 h-4" />
              <span>Overtime Report — Mandala Project</span>
            </div>
            <h1 className="text-2xl font-bold">Laporan Lembur</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-colors"
          >
            <LogOut className="w-4 h-4" /> Logout
          </button>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden fade-up">

          {/* ── User Info (read-only) ── */}
          <div className="p-6 border-b border-slate-100 bg-violet-50">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                {user.nama.charAt(0)}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-800 text-lg">{user.nama}</span>
                  <BadgeCheck className="w-5 h-5 text-violet-500" />
                </div>
                <div className="text-slate-500 text-sm font-mono">NIK: {user.nik}</div>
              </div>
              <div className="text-right text-xs text-slate-400">
                <div>Logged in</div>
                <div className="text-violet-500 font-medium">{user.username}</div>
              </div>
            </div>
          </div>

          {/* ── Date & Project ── */}
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Briefcase className="w-4 h-4" /> Detail Lembur
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" /> Tanggal Lembur *
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={e => handleDateChange(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-violet-400 focus:outline-none text-slate-800 transition-colors"
                />
                {isWeekend(date) && (
                  <p className="text-amber-600 text-xs mt-1 font-medium">
                    ⚡ Akhir pekan / tanggal merah — auto-set
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-slate-400" /> Project / Event *
                </label>
                <div className="relative">
                  <select
                    value={project}
                    onChange={e => setProject(e.target.value)}
                    className="w-full appearance-none pl-4 pr-10 py-2.5 rounded-xl border-2 border-slate-200 focus:border-violet-400 focus:outline-none bg-white text-slate-800 font-medium transition-colors"
                  >
                    <option value="">Pilih project...</option>
                    {DEFAULT_PROJECTS.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">▾</div>
                </div>
              </div>
            </div>

            {/* Late submission */}
            <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
              <Info className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isLate}
                    onChange={e => setIsLate(e.target.checked)}
                    className="w-4 h-4 rounded accent-violet-500"
                  />
                  <span className="text-sm font-medium text-amber-800">Late submission (bulan lalu)</span>
                </label>
                {isLate && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-amber-700">Masuk ke laporan:</span>
                    <input
                      value={folderLabel}
                      onChange={e => setFolderLabel(e.target.value)}
                      placeholder="e.g. Apr 2026"
                      className="text-sm px-3 py-1 rounded-lg border border-amber-300 bg-white w-32 focus:outline-none focus:border-violet-400"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Activities ── */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                <Clock className="w-4 h-4" /> Kegiatan Lembur
              </h2>
              <button
                onClick={() => addActivity()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl gradient-bg text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                <Plus className="w-4 h-4" /> Tambah Kegiatan
              </button>
            </div>

            <div className="space-y-3">
              {activities.map((act, idx) => (
                <ActivityRowCard
                  key={act.id}
                  index={idx}
                  activity={act}
                  suggestions={suggestions}
                  onChange={patch => updateActivity(act.id, patch)}
                  onRemove={() => removeActivity(act.id)}
                  onCopy={() => addActivity({ ...act })}
                  canRemove={activities.length > 1}
                />
              ))}
            </div>

            {activities.length > 0 && (
              <div className="mt-4 p-4 rounded-xl bg-violet-50 border border-violet-100 flex flex-wrap gap-4 text-sm">
                <span className="text-slate-600">
                  <span className="font-semibold text-violet-700">{activities.length}</span> kegiatan
                </span>
                <span className="text-slate-600">
                  Durasi: <span className="font-semibold text-violet-700">{totalDurasi.toFixed(2)}h</span>
                </span>
                <span className="text-slate-600">
                  Kompensasi: <span className="font-semibold text-violet-700">{totalKomp.toFixed(2)}h</span>
                </span>
              </div>
            )}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-bg text-white font-semibold text-base hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              <Save className="w-5 h-5" />
              {submitting ? 'Menyimpan...' : 'Simpan Laporan'}
            </button>
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>

        <p className="text-center text-white/50 text-xs mt-6">
          Lembur Mandala © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}

// ── Activity Row Card ─────────────────────────────────────────────────────────

function ActivityRowCard({
  index, activity, suggestions, onChange, onRemove, onCopy, canRemove,
}: {
  index: number
  activity: ActivityRow
  suggestions: string[]
  onChange: (patch: Partial<ActivityRow>) => void
  onRemove: () => void
  onCopy: () => void
  canRemove: boolean
}) {
  const kompensasi = calcKompensasi(activity.durasi, activity.standby, activity.akhir_pekan)
  const [showDrop, setShowDrop] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const filtered = activity.kegiatan.trim()
    ? suggestions.filter(s => s.toLowerCase().includes(activity.kegiatan.toLowerCase()) && s !== activity.kegiatan)
    : []

  return (
    <div className="rounded-xl border-2 border-slate-100 hover:border-violet-200 transition-colors p-4">
      {/* Row header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-full gradient-bg flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-slate-500">Kegiatan #{index + 1}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onCopy}
            className="text-xs px-2.5 py-1 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
          >Copy</button>
          {canRemove && (
            <button onClick={onRemove} className="p-1.5 rounded-lg text-red-400 hover:bg-red-50 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Kegiatan with autocomplete */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Deskripsi Kegiatan *</label>
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={activity.kegiatan}
            onChange={e => { onChange({ kegiatan: e.target.value }); setShowDrop(true) }}
            onFocus={() => setShowDrop(true)}
            onBlur={() => setTimeout(() => setShowDrop(false), 150)}
            placeholder="Ketik atau pilih dari chip di bawah..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-400 focus:outline-none text-sm text-slate-800 resize-none transition-colors"
          />
          {/* Autocomplete dropdown */}
          {showDrop && filtered.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-44 overflow-y-auto">
              {filtered.map(s => (
                <button
                  key={s}
                  type="button"
                  onMouseDown={e => { e.preventDefault(); onChange({ kegiatan: s }); setShowDrop(false) }}
                  className="w-full text-left px-3 py-2.5 text-sm hover:bg-violet-50 hover:text-violet-700 transition-colors border-b border-slate-50 last:border-0"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick-select chips */}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.slice(0, 8).map(s => (
            <button
              key={s}
              type="button"
              onClick={() => { onChange({ kegiatan: s }); textareaRef.current?.focus() }}
              className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                activity.kegiatan === s
                  ? 'bg-violet-100 border-violet-400 text-violet-700 font-medium'
                  : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Time + duration */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Dari Jam</label>
          <input
            type="time"
            value={activity.dari_jam}
            onChange={e => onChange({ dari_jam: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-400 focus:outline-none text-sm transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Sampai Jam</label>
          <input
            type="time"
            value={activity.sampai_jam}
            onChange={e => onChange({ sampai_jam: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-400 focus:outline-none text-sm transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Durasi (jam)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={activity.durasi}
            onChange={e => onChange({ durasi: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-violet-400 focus:outline-none text-sm font-mono transition-colors"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Kompensasi</label>
          <div className="px-3 py-2 rounded-lg bg-violet-50 border border-violet-100 text-sm font-bold text-violet-700 font-mono">
            {kompensasi.toFixed(2)}h
          </div>
        </div>
      </div>

      {/* Toggle flags */}
      <div className="flex flex-wrap gap-3">
        <ToggleChip
          label="Akhir Pekan / Tanggal Merah"
          checked={activity.akhir_pekan}
          onChange={v => onChange({ akhir_pekan: v })}
          color="amber"
        />
        <ToggleChip
          label="Standby"
          checked={activity.standby}
          onChange={v => onChange({ standby: v })}
          color="blue"
        />
        <ToggleChip
          label="WFO"
          checked={activity.wfo}
          onChange={v => onChange({ wfo: v })}
          color="green"
        />
      </div>

      {/* Compensation hint */}
      {(activity.standby || activity.akhir_pekan) && (
        <div className="mt-2 text-xs text-slate-400">
          Multiplier:{' '}
          <span className="font-medium text-violet-600">
            {activity.akhir_pekan ? '×2' : '×1'}{activity.standby ? ' × ×0.5' : ''} = ×{((activity.akhir_pekan ? 2 : 1) * (activity.standby ? 0.5 : 1)).toFixed(1)}
          </span>
        </div>
      )}
    </div>
  )
}

// ── Toggle Chip ───────────────────────────────────────────────────────────────

function ToggleChip({
  label, checked, onChange, color,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
  color: 'amber' | 'blue' | 'green'
}) {
  const colors = {
    amber: checked ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-slate-200 text-slate-500',
    blue:  checked ? 'bg-blue-100 border-blue-400 text-blue-800'   : 'bg-white border-slate-200 text-slate-500',
    green: checked ? 'bg-emerald-100 border-emerald-400 text-emerald-800' : 'bg-white border-slate-200 text-slate-500',
  }
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${colors[color]}`}
    >
      <div className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${checked ? 'border-current bg-current' : 'border-slate-300'}`}>
        {checked && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
      </div>
      {label}
    </button>
  )
}
