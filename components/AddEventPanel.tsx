'use client'
import { useState, useEffect, useRef } from 'react'
import type { Profile, LemburEvent } from '@/lib/types'
import { DEFAULT_PROJECTS, DEFAULT_SUGGESTIONS } from '@/lib/types'
import { calcDuration, calcKompensasi } from '@/lib/calculations'
import { createEvent, updateEvent, getSuggestions, saveSuggestion } from '@/lib/api'

interface Props {
  profile: Profile
  bulan: string
  editingEvent: LemburEvent | null
  onClose: () => void
  onSaved: () => void
}

const ID_WEEKDAYS = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu']

function isWeekend(dateStr: string) {
  if (!dateStr) return false
  const d = new Date(dateStr + 'T00:00:00')
  return d.getDay() === 0 || d.getDay() === 6
}

export default function AddEventPanel({ profile, bulan, editingEvent, onClose, onSaved }: Props) {
  const ev = editingEvent
  const today = new Date().toISOString().slice(0,10)

  const [date,       setDate]       = useState(ev?.hari_tanggal ?? today)
  const [project,    setProject]    = useState(ev?.project ?? '')
  const [kegiatan,   setKegiatan]   = useState<string[]>(ev?.kegiatan?.length ? ev.kegiatan : [''])
  const [dariJam,    setDariJam]    = useState(ev?.dari_jam  ?? '21:00')
  const [sampaiJam,  setSampaiJam]  = useState(ev?.sampai_jam ?? '23:00')
  const [durasi,     setDurasi]     = useState<number>(ev?.durasi ?? 2)
  const [durasiFree, setDurasiFree] = useState(false)  // true = user edited manually
  const [standby,    setStandby]    = useState(ev?.standby     ?? false)
  const [akhirPekan, setAkhirPekan] = useState(ev?.akhir_pekan ?? false)
  const [wfo,        setWfo]        = useState(ev?.wfo         ?? false)
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')
  const [suggestions, setSuggestions] = useState<string[]>(DEFAULT_SUGGESTIONS)

  const komp = calcKompensasi(durasi, standby, akhirPekan)
  const mult = (akhirPekan ? 2 : 1) * (standby ? 0.5 : 1)

  // Auto-detect weekend from date
  useEffect(() => {
    if (!durasiFree) setAkhirPekan(isWeekend(date))
  }, [date, durasiFree])

  // Auto-calc duration from times (unless user overrode manually)
  useEffect(() => {
    if (!durasiFree && dariJam && sampaiJam) {
      setDurasi(parseFloat(calcDuration(dariJam, sampaiJam).toFixed(2)))
    }
  }, [dariJam, sampaiJam, durasiFree])

  useEffect(() => {
    getSuggestions().then(setSuggestions).catch(() => {})
  }, [])

  // Kegiatan helpers
  function setKeg(i: number, val: string) {
    setKegiatan(prev => prev.map((k, j) => j === i ? val : k))
  }
  function addKeg(prefill = '') {
    setKegiatan(prev => [...prev, prefill])
  }
  function removeKeg(i: number) {
    setKegiatan(prev => prev.length > 1 ? prev.filter((_,j) => j !== i) : prev)
  }

  async function handleSave() {
    if (!date || !project || kegiatan.every(k => !k.trim())) {
      setError('Lengkapi tanggal, project, dan minimal satu deskripsi kegiatan.'); return
    }
    setSaving(true); setError('')
    try {
      const payload = {
        bulan,
        hari_tanggal: date,
        project,
        kegiatan: kegiatan.filter(k => k.trim()),
        dari_jam: dariJam,
        sampai_jam: sampaiJam,
        durasi,
        standby,
        akhir_pekan: akhirPekan,
        wfo,
        total_jam: komp,
      }
      if (ev) await updateEvent(ev.id, payload)
      else     await createEvent(payload)
      // Save suggestions
      for (const k of kegiatan.filter(k => k.trim())) await saveSuggestion(k).catch(() => {})
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Terjadi error.')
      setSaving(false)
    }
  }

  const dayName = date ? ID_WEEKDAYS[new Date(date + 'T00:00:00').getDay()] : ''

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100 }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(12,8,6,.75)', backdropFilter:'blur(3px)' }} />

      {/* Panel */}
      <div className="slide-right" style={{ position:'absolute', top:0, right:0, bottom:0, width:500, background:'var(--cream2)', zIndex:2, overflowY:'auto', boxShadow:'-8px 0 48px rgba(0,0,0,.5)', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'22px 28px 18px', borderBottom:'1px solid #e8d8c8', position:'sticky', top:0, background:'var(--cream2)', zIndex:1 }}>
          <div>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:22, fontWeight:700, color:'var(--text)' }}>{ev ? 'Edit Event' : 'Tambah Event Lembur'}</div>
            <div style={{ fontSize:13, color:'var(--muted)' }}>{bulan.replace('-',' / ')} · {profile.nama}</div>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:'50%', border:'1.5px solid #ddd0c4', background:'white', cursor:'pointer', fontSize:16, color:'var(--muted)', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding:'22px 28px', flex:1 }}>

          {/* Date */}
          <div style={{ marginBottom:22 }}>
            <label className="field-label">Tanggal <span className="field-hint">— otomatis cek akhir pekan</span></label>
            <input className="field-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            {date && (
              <div style={{ marginTop:8, padding:'8px 12px', background:'#fff8f0', border:'1px solid #f0d8b0', borderRadius:8, fontSize:12, color:'#8a6020', display:'flex', alignItems:'center', gap:6 }}>
                {akhirPekan ? '🌙' : '☀️'} <strong>{dayName}</strong> — {akhirPekan ? 'Akhir pekan / merah (×2)' : 'Hari biasa (×1)'}
              </div>
            )}
          </div>

          {/* Project */}
          <div style={{ marginBottom:22 }}>
            <label className="field-label">Project / Event</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {DEFAULT_PROJECTS.map(p => (
                <button key={p} onClick={() => setProject(p)}
                  style={{ padding:'7px 14px', borderRadius:20, border:`1.5px solid ${project===p ? 'var(--gold)' : '#ddd0c4'}`, background: project===p ? 'var(--bg)' : 'white', fontSize:13, fontWeight: project===p ? 600 : 500, color: project===p ? 'var(--gold)' : 'var(--brown)', cursor:'pointer', fontFamily:'DM Sans,sans-serif', transition:'all .15s' }}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Kegiatan — multi-row */}
          <div style={{ marginBottom:22 }}>
            <label className="field-label">Deskripsi Kegiatan <span className="field-hint">— bisa lebih dari satu</span></label>
            <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:4 }}>
              {kegiatan.map((k, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                  <div style={{ width:22, height:22, borderRadius:'50%', background:'#f0e4d6', border:'1px solid #ddd0c4', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'var(--muted)', flexShrink:0, marginTop:11 }}>{i+1}</div>
                  <textarea
                    value={k}
                    onChange={e => setKeg(i, e.target.value)}
                    placeholder="Deskripsi kegiatan lembur…"
                    rows={2}
                    style={{ flex:1, padding:'10px 13px', borderRadius:'var(--r2)', border:'1.5px solid #ddd0c4', background:'white', fontFamily:'DM Sans,sans-serif', fontSize:13, color:'var(--text)', outline:'none', resize:'vertical', transition:'border-color .2s' }}
                    onFocus={e => (e.target.style.borderColor='var(--gold)')}
                    onBlur={e => (e.target.style.borderColor='#ddd0c4')}
                  />
                  {i > 0 && (
                    <button onClick={() => removeKeg(i)}
                      style={{ width:28, height:28, borderRadius:7, border:'1px solid #ddd0c4', background:'white', color:'var(--rose)', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:11, fontFamily:'sans-serif' }}>✕</button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => addKeg()}
              style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 14px', borderRadius:20, border:'1.5px dashed #ddd0c4', background:'transparent', fontFamily:'DM Sans,sans-serif', fontSize:12, fontWeight:500, color:'var(--muted)', cursor:'pointer', marginTop:2 }}>
              ＋ Tambah Kegiatan
            </button>
            {/* Suggestion chips */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginTop:10 }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => addKeg(s)}
                  style={{ padding:'4px 11px', borderRadius:20, border:'1px solid #ddd0c4', background:'#f5ede3', fontSize:12, color:'var(--brown)', cursor:'pointer', transition:'all .15s', fontFamily:'DM Sans,sans-serif' }}>
                  {s}
                </button>
              ))}
            </div>
            <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>💡 Klik chip untuk tambah baris kegiatan baru</div>
          </div>

          {/* Times */}
          <div style={{ marginBottom:22 }}>
            <label className="field-label">Waktu Lembur</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--muted)', marginBottom:5 }}>Dari Jam</div>
                <input className="field-input" type="time" value={dariJam} onChange={e => { setDariJam(e.target.value); setDurasiFree(false) }} style={{ fontSize:15, fontWeight:600 }} />
                <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                  {['18:00','20:00','21:00','22:00'].map(t => (
                    <button key={t} onClick={() => { setDariJam(t); setDurasiFree(false) }}
                      style={{ padding:'3px 8px', borderRadius:20, border:'1px solid #e0d0c0', background:'#faf4ee', fontSize:11, color:'var(--muted)', cursor:'pointer', fontFamily:'monospace' }}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:500, color:'var(--muted)', marginBottom:5 }}>Sampai Jam</div>
                <input className="field-input" type="time" value={sampaiJam} onChange={e => { setSampaiJam(e.target.value); setDurasiFree(false) }} style={{ fontSize:15, fontWeight:600 }} />
                <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                  {['00:00','01:00','07:00','11:00'].map(t => (
                    <button key={t} onClick={() => { setSampaiJam(t); setDurasiFree(false) }}
                      style={{ padding:'3px 8px', borderRadius:20, border:'1px solid #e0d0c0', background:'#faf4ee', fontSize:11, color:'var(--muted)', cursor:'pointer', fontFamily:'monospace' }}>{t}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Duration / kompensasi */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', background:'var(--bg)', borderRadius:'var(--r2)', padding:'14px 18px', marginTop:12 }}>
              <div style={{ textAlign:'center' }}>
                <input
                  type="number" min={0} max={24} step={0.25}
                  value={durasi}
                  onChange={e => { setDurasi(parseFloat(e.target.value) || 0); setDurasiFree(true) }}
                  style={{ fontFamily:'Cormorant Garamond,serif', fontSize:26, fontWeight:600, color:'var(--gold)', background:'transparent', border:'none', borderBottom:'1.5px solid rgba(200,153,78,.35)', outline:'none', width:70, textAlign:'center' }}
                />
                <div style={{ fontSize:10, color:'rgba(200,153,78,.45)', marginTop:3 }}>✎ edit manual</div>
                <div style={{ fontSize:11, color:'rgba(242,227,208,.5)', marginTop:2 }}>Durasi (jam)</div>
              </div>
              <div style={{ width:1, background:'var(--border)', height:32 }} />
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:26, fontWeight:600, color:'var(--gold)', lineHeight:1 }}>×{mult.toFixed(1)}</div>
                <div style={{ fontSize:11, color:'rgba(242,227,208,.5)', marginTop:2 }}>Multiplier</div>
              </div>
              <div style={{ width:1, background:'var(--border)', height:32 }} />
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:26, fontWeight:600, color:'var(--gold)', lineHeight:1 }}>{komp.toFixed(2)}</div>
                <div style={{ fontSize:11, color:'rgba(242,227,208,.5)', marginTop:2 }}>Kompensasi</div>
              </div>
            </div>
            {durasiFree && (
              <div style={{ fontSize:11, color:'var(--amber)', marginTop:6 }}>
                ✎ Durasi diedit manual. <button onClick={() => { setDurasiFree(false) }} style={{ background:'none', border:'none', color:'var(--gold)', cursor:'pointer', fontSize:11, fontFamily:'DM Sans,sans-serif', textDecoration:'underline' }}>Reset ke auto</button>
              </div>
            )}
          </div>

          {/* Toggles */}
          <div style={{ marginBottom:22 }}>
            <label className="field-label">Kondisi</label>
            <div style={{ display:'flex', flexWrap:'wrap', gap:9 }}>
              {[
                { key:'akhir', label:'Akhir Pekan / Merah', val:akhirPekan, set:(v:boolean)=>setAkhirPekan(v), color:'var(--gold)', bg:'rgba(200,153,78,.1)', border:'var(--gold)' },
                { key:'stdby', label:'Standby', val:standby, set:(v:boolean)=>setStandby(v), color:'var(--rose)', bg:'rgba(196,122,114,.1)', border:'var(--rose)' },
                { key:'wfo',   label:'WFO', val:wfo, set:(v:boolean)=>setWfo(v), color:'#1e5a2a', bg:'rgba(80,160,100,.1)', border:'#6db880' },
              ].map(tog => (
                <button key={tog.key} onClick={() => tog.set(!tog.val)}
                  style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderRadius:20, border:`1.5px solid ${tog.val ? tog.border : '#ddd0c4'}`, background: tog.val ? tog.bg : 'white', fontFamily:'DM Sans,sans-serif', fontSize:13, fontWeight:500, color: tog.val ? tog.color : 'var(--brown)', cursor:'pointer', transition:'all .15s' }}>
                  <div style={{ width:15, height:15, borderRadius:'50%', border:`2px solid ${tog.val ? tog.border : '#ddd0c4'}`, background: tog.val ? tog.border : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {tog.val && <div style={{ width:5, height:5, borderRadius:'50%', background:'white' }} />}
                  </div>
                  {tog.label}
                </button>
              ))}
            </div>
            <div style={{ marginTop:9, fontSize:12, color:'var(--muted)' }}>Akhir pekan = ×2 · Standby = ×0.5 · Keduanya = ×1</div>
          </div>

          {error && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(196,122,114,.1)', border:'1px solid rgba(196,122,114,.35)', fontSize:13, color:'var(--rose)', marginBottom:8 }}>{error}</div>}
        </div>

        {/* Footer */}
        <div style={{ display:'flex', gap:10, padding:'18px 28px 26px', borderTop:'1px solid #e8d8c8', background:'var(--cream2)', position:'sticky', bottom:0 }}>
          <button onClick={handleSave} disabled={saving}
            style={{ flex:1, padding:13, borderRadius:'var(--r2)', border:'none', background:'linear-gradient(135deg,var(--burg2),var(--burg))', color:'white', fontFamily:'DM Sans,sans-serif', fontSize:14, fontWeight:600, cursor:'pointer', opacity: saving ? .7 : 1 }}>
            {saving ? 'Menyimpan…' : (ev ? 'Update Event ✓' : 'Simpan Event ✓')}
          </button>
          <button onClick={onClose}
            style={{ padding:'13px 18px', borderRadius:'var(--r2)', border:'1.5px solid #ddd0c4', background:'white', color:'var(--brown)', fontFamily:'DM Sans,sans-serif', fontSize:14, fontWeight:500, cursor:'pointer' }}>
            Batal
          </button>
        </div>
      </div>
    </div>
  )
}
