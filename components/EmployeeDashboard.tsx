'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, LemburMonth, LemburEvent, Deadline } from '@/lib/types'
import { currentBulan, bulanLabel, bulanShort } from '@/lib/types'
import { getMyMonths, getMonthDetail, deleteEvent, submitMonth, getDeadlines, updateGmail } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import AddEventPanel from './AddEventPanel'
import UploadPanel from './UploadPanel'
import EventList from './EventList'

interface Props { profile: Profile }

function avatarBg(name: string) {
  const colors = ['#7e1f2c','#1f4e7e','#1f7e4e','#4e1f7e','#7e4e1f','#1f7e7e']
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) & 0xffffff
  return colors[Math.abs(h) % colors.length]
}

export default function EmployeeDashboard({ profile }: Props) {
  const { signOut } = useAuth()
  const router = useRouter()
  const bulanNow = currentBulan()

  const [months, setMonths] = useState<LemburMonth[]>([])
  const [activeBulan, setActiveBulan] = useState(bulanNow)
  const [events, setEvents] = useState<LemburEvent[]>([])
  const [currentMonth, setCurrentMonth] = useState<LemburMonth | null>(null)
  const [deadline, setDeadline] = useState<Deadline | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [editingEvent, setEditingEvent] = useState<LemburEvent | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSettings, setShowSettings] = useState(false)
  const [evTab, setEvTab] = useState<'list'|'detail'>('list')
  const [expandedEv, setExpandedEv] = useState<string|null>(null)
  const [gmailInput, setGmailInput] = useState(profile.gmail ?? '')
  const [gmailBusy, setGmailBusy] = useState(false)
  const [gmailMsg, setGmailMsg] = useState('')

  const loadMonths = useCallback(async () => {
    const data = await getMyMonths()
    setMonths(data)
    return data
  }, [])

  const loadDetail = useCallback(async (bulan: string) => {
    const { month, events: evs } = await getMonthDetail(bulan)
    setCurrentMonth(month)
    setEvents(evs)
  }, [])

  useEffect(() => {
    async function init() {
      setLoading(true)
      await Promise.all([loadMonths(), loadDetail(bulanNow)])
      const deadlines = await getDeadlines()
      setDeadline(deadlines.find(d => d.bulan === bulanNow) ?? null)
      setLoading(false)
    }
    init()
  }, [bulanNow, loadMonths, loadDetail])

  async function switchBulan(bulan: string) {
    setActiveBulan(bulan)
    if (bulan !== bulanNow) {
      router.push(`/history?bulan=${bulan}`)
      return
    }
    await loadDetail(bulan)
  }

  async function handleDelete(id: string) {
    if (!confirm('Hapus event ini?')) return
    await deleteEvent(id)
    await loadDetail(activeBulan)
  }

  async function handleSaveGmail(e: React.FormEvent) {
    e.preventDefault()
    setGmailBusy(true)
    setGmailMsg('')
    const val = gmailInput.trim() || null
    try {
      await updateGmail(val)
      setGmailMsg(val ? `Gmail disimpan: ${val}` : 'Gmail dihapus.')
    } catch (err: unknown) {
      setGmailMsg((err instanceof Error ? err.message : null) ?? 'Gagal menyimpan.')
    }
    setGmailBusy(false)
  }

  async function handleSubmit() {
    if (!confirm('Submit bulan ini ke admin? Kamu masih bisa edit setelahnya, tapi perlu bilang admin.')) return
    await submitMonth(activeBulan)
    await loadDetail(activeBulan)
  }

  const totalDurasi = events.reduce((s, e) => s + e.durasi, 0)
  const totalKomp   = events.reduce((s, e) => s + e.total_jam, 0)
  const isSubmitted = currentMonth?.status === 'submitted'

  // Deadline display
  const dlDate = deadline?.deadline_date ? new Date(deadline.deadline_date) : null
  const today = new Date(); today.setHours(0,0,0,0)
  const daysLeft = dlDate ? Math.ceil((dlDate.getTime() - today.getTime()) / 86400000) : null
  const dlUrgent = daysLeft !== null && daysLeft <= 3

  // Past months that have data — only show months with records
  const pastMonths = months.filter(m => m.bulan !== bulanNow)

  const initials = profile.nama.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()

  if (loading) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ color:'var(--gold)', fontFamily:'Cormorant Garamond,serif', fontSize:22 }}>✦ Memuat…</div>
    </div>
  )

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:24, position:'relative', overflow:'hidden' }}>
      <img src="https://i.pinimg.com/736x/b2/98/80/b2988072879af114fc3e95528bc8a42e.jpg" alt=""
        style={{ position:'absolute', top:0, right:0, width:520, height:520, objectFit:'cover', opacity:.04, pointerEvents:'none', borderRadius:'0 0 0 100%' }} />

      <div style={{ maxWidth:1100, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:16 }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:22, fontWeight:700, color:'var(--gold)' }}>
            ✦ Lembur <span style={{ color:'var(--cream)', fontWeight:400 }}>Mandala</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:24, padding:'6px 14px 6px 6px' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:avatarBg(profile.nama), display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>{initials}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--cream)' }}>{profile.nama}</div>
              <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>NIK {profile.nik}</div>
            </div>
            <button onClick={() => { setShowSettings(true); setGmailMsg('') }}
              title="Pengaturan Akun"
              style={{ padding:'5px 8px', borderRadius:20, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:14, cursor:'pointer', fontFamily:'DM Sans,sans-serif', marginLeft:4 }}>
              ⚙
            </button>
            <button onClick={async () => { await signOut(); router.push('/login') }}
              style={{ padding:'5px 10px', borderRadius:20, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:12, cursor:'pointer', fontFamily:'DM Sans,sans-serif', marginLeft:2 }}>
              Logout
            </button>
          </div>
        </div>

        {/* Deadline banner — current month only */}
        {dlDate && !isSubmitted && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderRadius:'var(--r2)', border:`1px solid ${dlUrgent ? 'rgba(196,122,114,.45)' : 'rgba(212,136,10,.35)'}`, background: dlUrgent ? 'rgba(196,122,114,.1)' : 'var(--amberbg)', marginBottom:16 }}>
            <span style={{ fontSize:20 }}>{dlUrgent ? '⚠️' : '⏰'}</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color: dlUrgent ? 'var(--rose)' : 'var(--gold2)' }}>
                Deadline submit {bulanLabel(bulanNow)}: {dlDate.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                {daysLeft !== null && daysLeft >= 0 && ` · ${daysLeft} hari lagi`}
                {daysLeft !== null && daysLeft < 0 && ' · Sudah lewat!'}
              </div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Pastikan semua event sudah ditambahkan sebelum deadline.</div>
            </div>
          </div>
        )}
        {isSubmitted && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderRadius:'var(--r2)', border:'1px solid rgba(58,158,95,.35)', background:'var(--greenbg)', marginBottom:16 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:13, fontWeight:600, color:'#6fcf97' }}>Sudah submitted pada {currentMonth?.submitted_at ? new Date(currentMonth.submitted_at).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'}) : ''}</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Data bulan ini sudah dikirim ke admin. Hubungi Vania untuk koreksi.</div>
            </div>
          </div>
        )}

        {/* Bento grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:14 }}>

          {/* Hero card */}
          <div className="card" style={{ gridColumn:'1/2', background:'linear-gradient(145deg,var(--burg) 0%,#3a0d15 100%)', border:'1px solid rgba(168,44,58,.4)', padding:'22px 24px', overflow:'hidden', position:'relative' }}>
            <img src="https://i.pinimg.com/736x/cb/75/39/cb753986e9e64022f30f18af44d8846f.jpg" alt=""
              style={{ position:'absolute', right:-20, top:-20, width:180, height:180, objectFit:'cover', borderRadius:'50%', opacity:.18, filter:'saturate(.5)' }} />
            <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'rgba(255,255,255,.12)', border:'1px solid rgba(255,255,255,.2)', borderRadius:20, padding:'4px 12px', fontSize:11, color:'rgba(255,255,255,.8)', fontWeight:500, marginBottom:14 }}>
              📅 {isSubmitted ? 'Submitted' : 'Draft'}
            </div>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:28, fontWeight:700, color:'white', marginBottom:4 }}>{bulanLabel(bulanNow)}</div>
            <div style={{ fontSize:12, color:'rgba(255,255,255,.65)', marginBottom:22 }}>Status: {isSubmitted ? 'Submitted ✓' : 'Draft · bisa edit kapan saja'}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[['Events', events.length],['Total Durasi', `${totalDurasi.toFixed(2)}j`],['Kompensasi', `${totalKomp.toFixed(2)}j`],['Projects', new Set(events.map(e=>e.project)).size]].map(([l,v]) => (
                <div key={l as string}><div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:28, fontWeight:600, color:'white', lineHeight:1 }}>{v}</div><div style={{ fontSize:11, color:'rgba(255,255,255,.55)', marginTop:2 }}>{l}</div></div>
              ))}
            </div>
          </div>

          {/* Stats card */}
          <div className="card card-pad">
            <div style={{ fontSize:22, marginBottom:6 }}>📦</div>
            <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:36, fontWeight:600, color:'var(--gold)', lineHeight:1 }}>{pastMonths.length}</div>
            <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}>Bulan dengan data</div>
            {pastMonths[0] && <div style={{ fontSize:11, color:'var(--muted)', marginTop:8 }}>Terakhir: {bulanShort(pastMonths[0].bulan)} {pastMonths[0].status === 'submitted' ? '✓' : '(draft)'}</div>}
          </div>

          {/* Actions card */}
          <div className="card card-pad" style={{ display:'flex', flexDirection:'column' }}>
            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:1, color:'var(--muted)', marginBottom:8 }}>Quick Actions</div>
            <button onClick={() => { setEditingEvent(null); setShowAdd(true) }}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:'var(--r2)', border:'none', background:'linear-gradient(135deg,var(--gold),#a87830)', color:'var(--bg)', fontSize:14, fontWeight:600, cursor:'pointer', marginBottom:8, width:'100%', fontFamily:'DM Sans,sans-serif', textAlign:'left' }}>
              <span style={{ fontSize:17 }}>＋</span><div><div>Tambah Event</div><div style={{ fontSize:11, opacity:.65 }}>Isi form lembur baru</div></div>
            </button>
            <button onClick={() => setShowUpload(true)}
              style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:'var(--r2)', border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--cream)', fontSize:13, fontWeight:500, cursor:'pointer', marginBottom:8, width:'100%', fontFamily:'DM Sans,sans-serif', textAlign:'left' }}>
              <span style={{ fontSize:17 }}>📂</span><div><div>Upload .xlsx</div><div style={{ fontSize:11, opacity:.65 }}>Import dari file Excel</div></div>
            </button>
            {pastMonths[0] && (
              <button onClick={() => router.push(`/history?bulan=${pastMonths[0].bulan}`)}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:'var(--r2)', border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--cream)', fontSize:13, fontWeight:500, cursor:'pointer', marginBottom:8, width:'100%', fontFamily:'DM Sans,sans-serif', textAlign:'left' }}>
                <span style={{ fontSize:17 }}>📋</span><div><div>Lihat bulan lalu</div><div style={{ fontSize:11, opacity:.65 }}>{bulanShort(pastMonths[0].bulan)}</div></div>
              </button>
            )}
            <div style={{ height:1, background:'linear-gradient(90deg,transparent,var(--border),transparent)', margin:'4px 0' }} />
            {!isSubmitted ? (
              <button onClick={handleSubmit}
                style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 14px', borderRadius:'var(--r2)', border:'none', background:'linear-gradient(135deg,var(--burg2),var(--burg))', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', width:'100%', fontFamily:'DM Sans,sans-serif', textAlign:'left' }}>
                <span style={{ fontSize:17 }}>✓</span><div><div>Submit Bulan Ini</div><div style={{ fontSize:11, opacity:.8 }}>Kirim ke admin</div></div>
              </button>
            ) : (
              <div style={{ padding:'11px 14px', borderRadius:'var(--r2)', border:'1px solid rgba(58,158,95,.3)', background:'rgba(58,158,95,.08)', fontSize:13, color:'#6fcf97', fontWeight:500 }}>
                ✓ Sudah disubmit
              </div>
            )}
          </div>

          {/* Event list — full width */}
          <div className="card" style={{ gridColumn:'1/3' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px 14px', borderBottom:'1px solid var(--border2)' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'var(--cream)' }}>Daftar Event Lembur</div>
              <div style={{ background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:20, padding:'3px 12px', fontSize:12, color:'var(--gold)', fontWeight:600 }}>{events.length} events</div>
            </div>
            {/* Month tabs */}
            <div style={{ padding:'12px 14px 0', borderBottom:'1px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                <button style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, border:'1px solid var(--gold)', background:'var(--bg3)', color:'var(--cream)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                  <span style={{ color:'var(--gold)' }}>{bulanShort(bulanNow)}</span>
                  <span style={{ fontSize:10, padding:'2px 6px', borderRadius:20, fontWeight:600, background:'rgba(196,122,114,.15)', color:'var(--rose)', border:'1px solid rgba(196,122,114,.3)' }}>{isSubmitted ? '✓' : 'Draft'}</span>
                </button>
                {pastMonths.slice(0,4).map(m => (
                  <button key={m.bulan} onClick={() => switchBulan(m.bulan)}
                    style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                    <span>{bulanShort(m.bulan)}</span>
                    <span style={{ fontSize:10, padding:'2px 6px', borderRadius:20, fontWeight:600, background:'rgba(58,158,95,.15)', color:'#6fcf97', border:'1px solid rgba(58,158,95,.25)' }}>✓</span>
                  </button>
                ))}
              </div>
              {/* View toggle */}
              <div style={{ display:'flex', gap:4, padding:'0 2px 10px' }}>
                {(['list','detail'] as const).map(t => (
                  <button key={t} onClick={() => setEvTab(t)}
                    style={{ padding:'5px 14px', borderRadius:20, border:`1px solid ${evTab===t ? 'var(--gold)' : 'var(--border)'}`, background: evTab===t ? 'rgba(200,153,78,.12)' : 'transparent', color: evTab===t ? 'var(--gold)' : 'var(--muted)', fontSize:11, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif', textTransform:'uppercase', letterSpacing:.6 }}>
                    {t === 'list' ? 'List' : 'Detail'}
                  </button>
                ))}
              </div>
            </div>
            {evTab === 'list' && (
              <EventList events={events} readOnly={isSubmitted} onEdit={e => { setEditingEvent(e); setShowAdd(true) }} onDelete={handleDelete} />
            )}
            {evTab === 'detail' && (
              <div style={{ padding:12, display:'flex', flexDirection:'column', gap:4 }}>
                {events.length === 0 && <div style={{ padding:32, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Belum ada events.</div>}
                {events.map(ev => {
                  const open = expandedEv === ev.id
                  const isImg = ev.bukti_url && !ev.bukti_url.includes('.pdf')
                  return (
                    <div key={ev.id} style={{ border:'1px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' }}>
                      <div onClick={() => setExpandedEv(open ? null : ev.id)}
                        style={{ display:'grid', gridTemplateColumns:'90px 1fr auto auto', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', background: open ? 'rgba(200,153,78,.06)' : 'var(--bg3)' }}
                        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background='rgba(200,153,78,.04)' }}
                        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background='var(--bg3)' }}>
                        <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{ev.hari_tanggal}</div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--cream)', display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:10, background:'var(--amberbg)', color:'var(--gold2)', padding:'1px 7px', borderRadius:10, fontFamily:'DM Sans,sans-serif', fontWeight:700 }}>{ev.project}</span>
                            <span style={{ color:'var(--muted)', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:220 }}>{ev.kegiatan.join('; ')}</span>
                          </div>
                          <div style={{ fontSize:11, color:'var(--muted)', marginTop:3 }}>{ev.dari_jam}–{ev.sampai_jam} · {ev.wfo ? 'WFO' : 'WFH'}{ev.standby ? ' · Standby' : ''}{ev.akhir_pekan ? ' · Akhir Pekan' : ''}</div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          {ev.bukti_url && <span style={{ fontSize:10, color:'var(--gold)', background:'rgba(200,153,78,.1)', padding:'2px 7px', borderRadius:8, border:'1px solid rgba(200,153,78,.2)' }}>📎 bukti</span>}
                          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'var(--gold)' }}>{ev.total_jam.toFixed(1)}j</div>
                        </div>
                        <div style={{ color:'var(--muted)', fontSize:12 }}>{open ? '▲' : '▼'}</div>
                      </div>
                      {open && (
                        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border2)', background:'var(--bg2)' }}>
                          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px 16px', fontSize:12, marginBottom:12 }}>
                            {[['Kegiatan', ev.kegiatan.join('; ')],['Durasi', `${ev.durasi.toFixed(2)}j`],['Kompensasi', `${ev.total_jam.toFixed(2)}j`],['Jam Masuk', ev.dari_jam],['Jam Keluar', ev.sampai_jam],['WFO/WFH', ev.wfo?'WFO':'WFH'],['Standby', ev.standby?'Ya':'Tidak'],['Akhir Pekan', ev.akhir_pekan?'Ya':'Tidak']].map(([l,v]) => (
                              <div key={l}><div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:'var(--muted)', marginBottom:2 }}>{l}</div><div style={{ color:'var(--cream)' }}>{v}</div></div>
                            ))}
                          </div>
                          {ev.bukti_url ? (
                            <div style={{ borderTop:'1px solid var(--border2)', paddingTop:10 }}>
                              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:'var(--gold)', marginBottom:8 }}>Bukti Kegiatan</div>
                              {isImg ? (
                                <a href={ev.bukti_url} target="_blank" rel="noreferrer">
                                  <img src={ev.bukti_url} alt="Bukti" style={{ maxWidth:'100%', maxHeight:240, borderRadius:8, border:'1px solid var(--border)', objectFit:'cover', display:'block' }} />
                                </a>
                              ) : (
                                <a href={ev.bukti_url} target="_blank" rel="noreferrer"
                                  style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'8px 14px', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--cream)', fontSize:12, textDecoration:'none' }}>
                                  📄 Lihat Bukti →
                                </a>
                              )}
                            </div>
                          ) : (
                            <div style={{ borderTop:'1px solid var(--border2)', paddingTop:10, fontSize:12, color:'var(--muted)' }}>Belum ada bukti kegiatan.</div>
                          )}
                          {!isSubmitted && (
                            <div style={{ display:'flex', gap:8, marginTop:10 }}>
                              <button onClick={() => { setEditingEvent(ev); setShowAdd(true) }}
                                style={{ padding:'6px 14px', borderRadius:'var(--r2)', border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--cream)', fontSize:12, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                                ✎ Edit
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Progress card */}
          <div className="card card-pad">
            <div style={{ fontSize:11, fontWeight:600, textTransform:'uppercase', letterSpacing:1, color:'var(--muted)', marginBottom:18 }}>Submission Progress</div>
            {[
              { label:'Entry dibuat', sub:`${events.length} events`, done: events.length > 0 },
              { label:'Review & edit', sub:'Masih bisa ditambah/diedit', active: !isSubmitted },
              { label:'Submit ke admin', sub: dlDate ? `⏰ Deadline: ${dlDate.toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}` : 'Belum ada deadline', done: isSubmitted },
              { label:'Laporan dibuat', sub:'Admin generate DOCX', done: false },
            ].map((step, i, arr) => (
              <div key={i} style={{ display:'flex', gap:12, marginBottom:16, position:'relative' }}>
                {i < arr.length-1 && <div style={{ position:'absolute', left:13, top:28, width:1, bottom:-8, background:'var(--border)' }} />}
                <div style={{ width:27, height:27, borderRadius:'50%', border:`2px solid ${step.done ? 'var(--gold)' : step.active ? 'var(--rose)' : 'var(--border)'}`, background: step.done ? 'rgba(200,153,78,.15)' : step.active ? 'rgba(196,122,114,.15)' : 'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, flexShrink:0, marginTop:2 }}>
                  {step.done ? '✓' : step.active ? '●' : '○'}
                </div>
                <div>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--cream)' }}>{step.label}</div>
                  <div style={{ fontSize:11, color: step.active && !step.done ? 'var(--amber)' : 'var(--muted)', marginTop:2 }}>{step.sub}</div>
                </div>
              </div>
            ))}
            {/* Past months */}
            {pastMonths.length > 0 && (
              <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border2)' }}>
                <div style={{ fontSize:10, color:'var(--muted)', fontWeight:700, textTransform:'uppercase', letterSpacing:1, marginBottom:10 }}>Bulan Sebelumnya</div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {pastMonths.slice(0,3).map(m => (
                    <div key={m.bulan} onClick={() => router.push(`/history?bulan=${m.bulan}`)} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'var(--bg3)', borderRadius:8, border:'1px solid var(--border)', cursor:'pointer' }}>
                      <span style={{ fontSize:12, color:'var(--cream)' }}>{bulanLabel(m.bulan)}</span>
                      <span style={{ fontSize:11, color:'#6fcf97', fontWeight:600 }}>✓ {m.status === 'submitted' ? 'Submitted' : 'Draft'} →</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Panels */}
      {showAdd && (
        <AddEventPanel
          profile={profile}
          bulan={bulanNow}
          editingEvent={editingEvent}
          onClose={() => { setShowAdd(false); setEditingEvent(null) }}
          onSaved={async () => { await loadDetail(bulanNow); await loadMonths(); setShowAdd(false); setEditingEvent(null) }}
        />
      )}
      {showUpload && (
        <UploadPanel
          profile={profile}
          bulan={bulanNow}
          onClose={() => setShowUpload(false)}
          onSaved={async () => { await loadDetail(bulanNow); await loadMonths(); setShowUpload(false) }}
        />
      )}

      {/* Settings modal */}
      {showSettings && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
          onClick={e => { if (e.target === e.currentTarget) setShowSettings(false) }}>
          <div className="card card-pad" style={{ width:'100%', maxWidth:420 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:22, fontWeight:700, color:'var(--cream)' }}>Pengaturan Akun</div>
              <button onClick={() => setShowSettings(false)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:20, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>

            <div style={{ fontSize:13, color:'var(--muted)', marginBottom:20, lineHeight:1.6 }}>
              Setup gmail <span style={{ color:'var(--gold2)', fontWeight:500 }}>@daksa.co.id</span> untuk mengaktifkan fitur lupa password.
              Jika belum diisi, reset password harus melalui admin.
            </div>

            <form onSubmit={handleSaveGmail}>
              <div style={{ marginBottom:16 }}>
                <label style={{ display:'block', fontSize:13, fontWeight:500, color:'var(--brown)', marginBottom:8 }}>
                  Gmail Daksa <span style={{ color:'var(--muted)', fontWeight:400 }}>(opsional)</span>
                </label>
                <input
                  className="field-input"
                  type="email"
                  placeholder="nama@daksa.co.id"
                  value={gmailInput}
                  onChange={e => { setGmailInput(e.target.value); setGmailMsg('') }}
                />
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:6 }}>
                  Hanya menerima format @daksa.co.id. Kosongkan untuk menghapus.
                </div>
              </div>

              {gmailMsg && (
                <div style={{ fontSize:13, color: gmailMsg.startsWith('Gmail') || gmailMsg.startsWith('Gmail dihapus') ? 'var(--gold2)' : 'var(--rose)', marginBottom:14, padding:'8px 12px', borderRadius:8, background: gmailMsg.startsWith('Gagal') ? 'rgba(196,122,114,.1)' : 'rgba(200,153,78,.1)', border: `1px solid ${gmailMsg.startsWith('Gagal') ? 'rgba(196,122,114,.3)' : 'rgba(200,153,78,.3)'}` }}>
                  {gmailMsg}
                </div>
              )}

              <div style={{ display:'flex', gap:10 }}>
                <button className="btn-primary" type="submit" disabled={gmailBusy} style={{ flex:1, opacity: gmailBusy ? .7 : 1 }}>
                  {gmailBusy ? 'Menyimpan…' : 'Simpan'}
                </button>
                <button type="button" onClick={() => setShowSettings(false)}
                  style={{ padding:'10px 18px', borderRadius:'var(--r1)', border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:13, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                  Tutup
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
