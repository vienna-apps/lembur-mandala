'use client'
import { useState, useRef } from 'react'
import type { Profile, LemburEvent } from '@/lib/types'
import { bulanLabel } from '@/lib/types'
import { uploadXlsx, getMonthDetail, deleteEvent } from '@/lib/api'
import AddEventPanel from './AddEventPanel'

interface ParsedRow {
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
}
interface ParseError { row: number; field: string; message: string }

interface Props {
  profile: Profile
  bulan: string
  onClose: () => void
  onSaved: () => void
}

export default function UploadPanel({ profile, bulan, onClose, onSaved }: Props) {
  const [file,        setFile]        = useState<File | null>(null)
  const [stage,       setStage]       = useState<'pick'|'preview'|'saving'|'done'>('pick')
  const [parsed,      setParsed]      = useState<ParsedRow[]>([])
  const [errors,      setErrors]      = useState<ParseError[]>([])
  const [parsedName,  setParsedName]  = useState('')
  const [parsedNik,   setParsedNik]   = useState('')
  const [globalErr,   setGlobalErr]   = useState('')
  const [savedEvents, setSavedEvents] = useState<LemburEvent[]>([])
  const [editingEv,   setEditingEv]   = useState<LemburEvent | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleParse() {
    if (!file) return
    setGlobalErr('')
    setStage('preview')
    try {
      const result = await uploadXlsx(file, bulan, false)
      setParsed(result.parsed ?? [])
      setErrors(result.errors ?? [])
      setParsedName(result.parsedNama ?? '')
      setParsedNik(result.parsedNik ?? '')
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : 'Gagal memproses file.')
      setStage('pick')
    }
  }

  async function handleCommit() {
    if (!file) return
    setStage('saving')
    try {
      await uploadXlsx(file, bulan, true)
      // Fetch the saved events so user can review & edit them
      const { events } = await getMonthDetail(bulan)
      setSavedEvents(events ?? [])
      setStage('done')
    } catch (e: unknown) {
      setGlobalErr(e instanceof Error ? e.message : 'Gagal menyimpan.')
      setStage('preview')
    }
  }

  async function handleDeleteSaved(id: string) {
    if (!confirm('Hapus event ini?')) return
    await deleteEvent(id)
    const { events } = await getMonthDetail(bulan)
    setSavedEvents(events ?? [])
  }

  function fmtDate(iso: string) {
    const d = new Date(iso + 'T00:00:00')
    return { day: d.getDate(), mon: d.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase() }
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:100 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(12,8,6,.75)', backdropFilter:'blur(3px)' }} />

      <div className="slide-right" style={{ position:'absolute', top:0, right:0, bottom:0, width:560, background:'var(--cream2)', zIndex:2, overflowY:'auto', boxShadow:'-8px 0 48px rgba(0,0,0,.5)', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'22px 28px 18px', borderBottom:'1px solid #e8d8c8', position:'sticky', top:0, background:'var(--cream2)', zIndex:1 }}>
          <div>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:22, fontWeight:700, color:'var(--text)' }}>Upload File Lembur</div>
            <div style={{ fontSize:13, color:'var(--muted)' }}>{bulanLabel(bulan)} · {profile.nama}</div>
          </div>
          <button onClick={onClose} style={{ width:34, height:34, borderRadius:'50%', border:'1.5px solid #ddd0c4', background:'white', cursor:'pointer', fontSize:16, color:'var(--muted)', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>

        <div style={{ padding:'22px 28px', flex:1 }}>

          {/* ── Done: show saved events with edit/delete ── */}
          {stage === 'done' && (
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 16px', borderRadius:'var(--r2)', background:'rgba(58,158,95,.08)', border:'1px solid rgba(58,158,95,.25)', marginBottom:20 }}>
                <span style={{ fontSize:22 }}>✅</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:600, color:'#6fcf97' }}>{savedEvents.length} event berhasil diimport!</div>
                  <div style={{ fontSize:12, color:'var(--muted)', marginTop:1 }}>Kamu bisa edit atau hapus event di bawah ini sebelum submit.</div>
                </div>
              </div>

              {/* Event list with edit/delete */}
              {savedEvents.length === 0 ? (
                <div style={{ textAlign:'center', padding:30, color:'var(--muted)', fontSize:13 }}>Tidak ada event tersimpan.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
                  {savedEvents.map(ev => {
                    const { day, mon } = fmtDate(ev.hari_tanggal)
                    return (
                      <div key={ev.id} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto', alignItems:'center', gap:12, padding:'12px 14px', borderRadius:'var(--r2)', background:'white', border:'1px solid #e8d0b8' }}>
                        {/* Date tile */}
                        <div style={{ width:40, height:40, borderRadius:8, background:'#f5ede3', border:'1px solid #e8d0b8', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <div style={{ fontSize:14, fontWeight:700, color:'var(--gold)', lineHeight:1 }}>{day}</div>
                          <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5 }}>{mon}</div>
                        </div>
                        {/* Info */}
                        <div>
                          <div style={{ display:'inline-flex', alignItems:'center', background:'rgba(200,153,78,.12)', border:'1px solid rgba(200,153,78,.25)', borderRadius:20, padding:'2px 8px', fontSize:10, color:'var(--gold)', fontWeight:600, marginBottom:3 }}>{ev.project}</div>
                          <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.35 }}>{ev.kegiatan.join(' · ')}</div>
                          <div style={{ fontSize:11, color:'var(--muted)', marginTop:3, fontFamily:'monospace' }}>
                            {ev.dari_jam}–{ev.sampai_jam} · {ev.durasi}j → <strong style={{ color:'var(--brown)' }}>{ev.total_jam.toFixed(2)}j</strong>
                            {ev.akhir_pekan && <span style={{ marginLeft:6, color:'var(--amber)', fontWeight:600 }}>Weekend</span>}
                            {ev.standby && <span style={{ marginLeft:6, color:'var(--rose)' }}>Standby</span>}
                            {ev.wfo ? <span style={{ marginLeft:6, color:'#6db880' }}>WFO</span> : <span style={{ marginLeft:6, color:'var(--muted)' }}>WFH</span>}
                          </div>
                        </div>
                        {/* Actions */}
                        <div style={{ display:'flex', gap:5 }}>
                          <button onClick={() => setEditingEv(ev)} title="Edit"
                            style={{ width:30, height:30, borderRadius:7, border:'1px solid #e8d0b8', background:'#f5ede3', color:'var(--brown)', fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✎</button>
                          <button onClick={() => handleDeleteSaved(ev.id)} title="Hapus"
                            style={{ width:30, height:30, borderRadius:7, border:'1px solid rgba(196,122,114,.3)', background:'rgba(196,122,114,.06)', color:'var(--rose)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Pick file ── */}
          {stage === 'pick' && (
            <>
              <div style={{ marginBottom:20, padding:'24px', border:'2px dashed #ddd0c4', borderRadius:'var(--r)', textAlign:'center', cursor:'pointer', background:'#fff8f2' }}
                onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f) }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📂</div>
                <div style={{ fontSize:14, fontWeight:600, color:'var(--brown)', marginBottom:4 }}>{file ? file.name : 'Klik atau drag file .xlsx ke sini'}</div>
                <div style={{ fontSize:12, color:'var(--muted)' }}>Format: template lembur mandala (NIK, Nama, Kegiatan, Tanggal…)</div>
                <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display:'none' }} onChange={e => setFile(e.target.files?.[0] ?? null)} />
              </div>

              {file && (
                <div style={{ padding:'12px 16px', borderRadius:'var(--r2)', background:'rgba(200,153,78,.08)', border:'1px solid rgba(200,153,78,.25)', fontSize:13, color:'var(--brown)', marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
                  <span>📄</span>
                  <span style={{ flex:1, fontWeight:500 }}>{file.name}</span>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>{(file.size/1024).toFixed(1)} KB</span>
                  <button onClick={() => setFile(null)} style={{ background:'none', border:'none', color:'var(--rose)', cursor:'pointer', fontSize:14 }}>✕</button>
                </div>
              )}

              {globalErr && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(196,122,114,.1)', border:'1px solid rgba(196,122,114,.35)', fontSize:13, color:'var(--rose)', marginBottom:12 }}>{globalErr}</div>}

              <div style={{ fontSize:13, color:'var(--muted)', marginBottom:16, lineHeight:1.6 }}>
                <strong style={{ color:'var(--brown)' }}>Format yang diterima:</strong> template standar lembur tim Mandala (.xlsx).<br />
                Kolom: <code style={{ background:'#f0e0d0', padding:'1px 5px', borderRadius:4 }}>NIK · Nama · Kegiatan · Hari, Tanggal · Dari Jam · Sampai Jam · Selama · WFO · Standby · Akhir Pekan · Total Jam</code>
              </div>

              <a href="/api/template" download
                style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, width:'100%', padding:'11px', borderRadius:'var(--r2)', border:'1.5px solid rgba(200,153,78,.5)', background:'rgba(200,153,78,.07)', color:'var(--gold)', fontSize:13, fontWeight:600, textDecoration:'none', marginBottom:12, cursor:'pointer' }}>
                ⬇ Download Template .xlsx
              </a>

              <button onClick={handleParse} disabled={!file} className="btn-primary" style={{ width:'100%', opacity: file ? 1 : .5 }}>
                Periksa File →
              </button>
            </>
          )}

          {/* ── Preview ── */}
          {(stage === 'preview' || stage === 'saving') && (
            <>
              {parsedName && (
                <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(200,153,78,.08)', border:'1px solid rgba(200,153,78,.25)', fontSize:13, color:'var(--brown)', marginBottom:16 }}>
                  👤 Terdeteksi: <strong>{parsedName}</strong> — NIK {parsedNik}
                  {parsedNik && parsedNik !== profile.nik && (
                    <div style={{ marginTop:4, color:'var(--rose)', fontWeight:600 }}>⚠️ NIK di file ({parsedNik}) berbeda dari akun kamu ({profile.nik}). Pastikan ini file kamu sendiri.</div>
                  )}
                </div>
              )}

              {errors.length > 0 && (
                <div style={{ marginBottom:16 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--rose)', marginBottom:8 }}>⚠️ {errors.length} baris perlu diperbaiki:</div>
                  <div style={{ maxHeight:180, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
                    {errors.map((err, i) => (
                      <div key={i} style={{ padding:'8px 12px', borderRadius:8, background:'rgba(196,122,114,.08)', border:'1px solid rgba(196,122,114,.25)', fontSize:12, color:'var(--text)' }}>
                        <span style={{ fontWeight:600, color:'var(--rose)' }}>Baris {err.row} · {err.field}:</span> {err.message}
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop:8, fontSize:12, color:'var(--muted)' }}>Perbaiki file .xlsx lalu upload ulang. Baris yang error tidak akan disimpan.</div>
                </div>
              )}

              {parsed.length > 0 && (
                <>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--brown)', marginBottom:10 }}>✅ {parsed.length} event siap diimport:</div>
                  <div style={{ maxHeight:300, overflowY:'auto', display:'flex', flexDirection:'column', gap:6, marginBottom:16 }}>
                    {parsed.map((row, i) => (
                      <div key={i} style={{ padding:'10px 14px', borderRadius:'var(--r2)', background:'white', border:'1px solid #e8d0b8', fontSize:12 }}>
                        <div style={{ fontWeight:600, color:'var(--brown)', marginBottom:2 }}>
                          {row.hari_tanggal} · <span style={{ color:'var(--gold)' }}>{row.project}</span>
                          {row.akhir_pekan && <span style={{ marginLeft:6, color:'var(--amber)', fontWeight:700 }}>Weekend</span>}
                          {row.standby && <span style={{ marginLeft:6, color:'var(--rose)' }}>Standby</span>}
                        </div>
                        <div style={{ color:'var(--text)' }}>{row.kegiatan.join(' · ')}</div>
                        <div style={{ color:'var(--muted)', marginTop:2 }}>{row.dari_jam}–{row.sampai_jam} · {row.durasi}j → <strong style={{ color:'var(--brown)' }}>{row.total_jam.toFixed(2)}j kompensasi</strong></div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {parsed.length === 0 && errors.length === 0 && (
                <div style={{ textAlign:'center', padding:'30px', color:'var(--muted)', fontSize:13 }}>Tidak ada data yang bisa diparse dari file ini.</div>
              )}

              {globalErr && <div style={{ padding:'10px 14px', borderRadius:8, background:'rgba(196,122,114,.1)', border:'1px solid rgba(196,122,114,.35)', fontSize:13, color:'var(--rose)', marginBottom:12 }}>{globalErr}</div>}
            </>
          )}
        </div>

        {/* Footer */}
        {(stage === 'preview' || stage === 'saving') && (
          <div style={{ display:'flex', gap:10, padding:'18px 28px 26px', borderTop:'1px solid #e8d8c8', background:'var(--cream2)', position:'sticky', bottom:0 }}>
            <button onClick={() => setStage('pick')}
              style={{ padding:'13px 18px', borderRadius:'var(--r2)', border:'1.5px solid #ddd0c4', background:'white', color:'var(--brown)', fontFamily:'DM Sans,sans-serif', fontSize:14, fontWeight:500, cursor:'pointer' }}>
              ← Ganti File
            </button>
            <button onClick={handleCommit} disabled={parsed.length === 0 || errors.length > 0 || stage === 'saving'} className="btn-primary" style={{ flex:1, opacity: (parsed.length === 0 || errors.length > 0) ? .5 : 1 }}>
              {stage === 'saving' ? 'Menyimpan…' : `Simpan ${parsed.length} Event ✓`}
            </button>
          </div>
        )}

        {stage === 'done' && (
          <div style={{ display:'flex', gap:10, padding:'18px 28px 26px', borderTop:'1px solid #e8d8c8', background:'var(--cream2)', position:'sticky', bottom:0 }}>
            <button onClick={() => { onSaved() }}
              className="btn-primary" style={{ flex:1 }}>
              Selesai · Lihat Semua Event →
            </button>
          </div>
        )}
      </div>

      {/* Edit panel — stacked on top of upload panel */}
      {editingEv && (
        <AddEventPanel
          profile={profile}
          bulan={bulan}
          editingEvent={editingEv}
          onClose={() => setEditingEv(null)}
          onSaved={async () => {
            setEditingEv(null)
            const { events } = await getMonthDetail(bulan)
            setSavedEvents(events ?? [])
          }}
        />
      )}
    </div>
  )
}
