'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, LemburMonth, LemburEvent, Deadline } from '@/lib/types'
import { bulanLabel, bulanShort, currentBulan } from '@/lib/types'
import { getAdminMonth, setDeadline, getDeadlines, getMonthDetail, deleteEvent, downloadDocx } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import EventList from './EventList'
import AddEventPanel from './AddEventPanel'

interface Props { profile: Profile }

interface Submission extends LemburMonth {
  profile: Profile
  events: LemburEvent[]
}

function avatarColor(name: string) {
  const palette = ['#7e1f2c','#1f4e7e','#1f7e4e','#4e1f7e','#7e4e1f','#1f7e7e','#7e7e1f']
  let h = 0; for (const c of name) h = (h*31+c.charCodeAt(0)) & 0xffffff
  return palette[Math.abs(h) % palette.length]
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:.8, color:'var(--muted)', marginBottom:2 }}>{label}</div>
      <div style={{ fontSize:12, color:'var(--cream)' }}>{value}</div>
    </div>
  )
}

// Build bulan list: current + past 6 months
function buildBulanList(): string[] {
  const list: string[] = []
  const now = new Date()
  for (let i = 0; i <= 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    list.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
  }
  return list
}

export default function AdminDashboard({ profile }: Props) {
  const { signOut } = useAuth()
  const router = useRouter()
  const bulanList = buildBulanList()
  const bulanNow  = currentBulan()

  const [activeBulan,    setActiveBulan]    = useState(bulanNow)
  const [submissions,    setSubmissions]    = useState<Submission[]>([])
  const [deadlines,      setDeadlines]      = useState<Record<string,Deadline>>({})
  const [expandedPerson, setExpandedPerson] = useState<string|null>(null)
  const [loading,        setLoading]        = useState(true)
  const [dlEditing,      setDlEditing]      = useState<string|null>(null)
  const [dlInputs,       setDlInputs]       = useState<Record<string,string>>({})
  const [downloading,    setDownloading]    = useState<'laporan'|'moo'|null>(null)

  // Admin's own lembur
  const [myEvents,       setMyEvents]       = useState<LemburEvent[]>([])
  const [myPanelOpen,    setMyPanelOpen]    = useState(false)
  const [showEventForm,  setShowEventForm]  = useState(false)
  const [editingMyEvent, setEditingMyEvent] = useState<LemburEvent|null>(null)
  const [copyPrefill,    setCopyPrefill]    = useState<Partial<LemburEvent>|undefined>()
  const [showCopyPicker, setShowCopyPicker] = useState(false)
  const [activeTab,      setActiveTab]      = useState<'submissions'|'events'>('submissions')
  const [expandedEvent,  setExpandedEvent]  = useState<string|null>(null)

  const loadDeadlines = useCallback(async () => {
    const all = await getDeadlines()
    const map: Record<string,Deadline> = {}
    all.forEach(d => { map[d.bulan] = d })
    setDeadlines(map)
    // Pre-fill inputs
    const inputs: Record<string,string> = {}
    all.forEach(d => { if (d.deadline_date) inputs[d.bulan] = d.deadline_date })
    setDlInputs(inputs)
  }, [])

  const loadMonth = useCallback(async (bulan: string) => {
    setLoading(true)
    try {
      const { months } = await getAdminMonth(bulan)
      setSubmissions(months ?? [])
    } catch { setSubmissions([]) }
    setLoading(false)
  }, [])

  const loadMyEvents = useCallback(async (bulan: string) => {
    try {
      const { events } = await getMonthDetail(bulan)
      setMyEvents(events ?? [])
    } catch { setMyEvents([]) }
  }, [])

  useEffect(() => {
    loadDeadlines()
  }, [loadDeadlines])

  useEffect(() => {
    loadMonth(activeBulan)
    loadMyEvents(activeBulan)
  }, [activeBulan, loadMonth, loadMyEvents])

  async function saveDL(bulan: string) {
    const date = dlInputs[bulan] ?? null
    await setDeadline(bulan, date)
    await loadDeadlines()
    setDlEditing(null)
  }

  async function handleDownload(type: 'laporan'|'moo') {
    setDownloading(type)
    try {
      if (type === 'laporan') {
        await downloadDocx(`/api/docx/laporan?bulan=${activeBulan}`, `Laporan-Lembur-Mandala-${activeBulan}.docx`)
      } else {
        await downloadDocx(`/api/docx/moo?bulan=${activeBulan}`, `MoO-Mandala-${activeBulan}.zip`)
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Gagal mengunduh dokumen.')
    } finally {
      setDownloading(null)
    }
  }

  function openCopyForm(ev: LemburEvent) {
    setCopyPrefill({ hari_tanggal: ev.hari_tanggal, project: ev.project, kegiatan: ev.kegiatan, dari_jam: ev.dari_jam, sampai_jam: ev.sampai_jam, durasi: ev.durasi, standby: ev.standby, akhir_pekan: ev.akhir_pekan, wfo: ev.wfo })
    setEditingMyEvent(null)
    setShowEventForm(true)
    setMyPanelOpen(true)
  }

  async function handleDeleteMyEvent(id: string) {
    await deleteEvent(id)
    await loadMyEvents(activeBulan)
  }

  const dl = deadlines[activeBulan]
  const dlDate = dl?.deadline_date ? new Date(dl.deadline_date) : null
  const today = new Date(); today.setHours(0,0,0,0)
  const daysLeft = dlDate ? Math.ceil((dlDate.getTime()-today.getTime())/86400000) : null

  const submitted    = submissions.filter(s => s.status === 'submitted')
  const notSubmitted = submissions.filter(s => s.status !== 'submitted')
  // People with no record at all won't appear — by design (no denominator)

  const totalEvents = submissions.reduce((s,m) => s + (m.events?.length??0), 0)
  const totalDurasi = submissions.reduce((s,m) => s + (m.events??[]).reduce((a,e)=>a+e.total_jam,0), 0)

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:24 }}>
      <div style={{ maxWidth:1150, margin:'0 auto', display:'grid', gridTemplateColumns:'268px 1fr', gap:14 }}>

        {/* Full-width topbar */}
        <div style={{ gridColumn:'1/-1', display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:2 }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:22, fontWeight:700, color:'var(--gold)' }}>
            ✦ Lembur <span style={{ color:'var(--cream)', fontWeight:400 }}>Mandala</span> — Admin
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'linear-gradient(135deg,rgba(126,31,44,.3),rgba(168,44,58,.15))', border:'1px solid rgba(168,44,58,.4)', borderRadius:20, padding:'6px 14px', fontSize:12, color:'var(--rose)', fontWeight:600 }}>
              👑 {profile.nama} · Tech Lead
            </div>
            <button onClick={async () => { await signOut(); router.push('/login') }} className="btn-ghost">Logout</button>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1.5, color:'var(--muted)', padding:'0 10px', marginBottom:2 }}>Bulan</div>

          {bulanList.map(bulan => {
            const d = deadlines[bulan]
            const sub = submissions // note: only loaded for activeBulan
            const isActive = bulan === activeBulan
            return (
              <div key={bulan} onClick={() => setActiveBulan(bulan)}
                style={{ padding:'12px 14px', borderRadius:'var(--r2)', border:`1px solid ${isActive ? 'var(--border)' : 'transparent'}`, background: isActive ? 'var(--bg2)' : 'transparent', cursor:'pointer', transition:'all .15s' }}
                onMouseEnter={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background='var(--bg3)'; (e.currentTarget as HTMLElement).style.borderColor='var(--border)' }}}
                onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.borderColor='transparent' }}}>
                <div style={{ fontSize:13, fontWeight:600, color:'var(--cream)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  {bulanShort(bulan)}
                  {isActive && <span style={{ fontSize:10, fontWeight:600, background:'var(--amberbg)', color:'var(--gold2)', padding:'2px 8px', borderRadius:20 }}>{submitted.length} orang</span>}
                </div>
                {isActive && <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>{submitted.length} orang submit</div>}
                {d?.deadline_date && (
                  <div style={{ fontSize:11, color:'var(--amber)', marginTop:3 }}>⏰ {new Date(d.deadline_date).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}</div>
                )}
                {/* Deadline editor */}
                {isActive && (
                  <div style={{ marginTop:6 }}>
                    {dlEditing === bulan ? (
                      <div style={{ display:'flex', alignItems:'center', gap:6 }} onClick={e => e.stopPropagation()}>
                        <input type="date" value={dlInputs[bulan]??''} onChange={e => setDlInputs(p=>({...p,[bulan]:e.target.value}))}
                          style={{ flex:1, padding:'4px 8px', borderRadius:6, border:'1px solid rgba(200,153,78,.4)', background:'var(--bg3)', color:'var(--cream)', fontSize:11, fontFamily:'DM Sans,sans-serif', outline:'none' }} />
                        <button onClick={() => saveDL(bulan)} style={{ padding:'4px 8px', borderRadius:6, border:'none', background:'var(--gold)', color:'var(--bg)', fontSize:10, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>Simpan</button>
                        <button onClick={() => setDlEditing(null)} style={{ padding:'4px 6px', borderRadius:6, border:'none', background:'transparent', color:'var(--muted)', fontSize:11, cursor:'pointer' }}>✕</button>
                      </div>
                    ) : (
                      <button onClick={e => { e.stopPropagation(); setDlEditing(bulan) }}
                        style={{ fontSize:10, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'DM Sans,sans-serif', paddingTop:3, textDecoration:'underline', textUnderlineOffset:2 }}>
                        {d?.deadline_date ? '✎ ubah deadline' : '＋ set deadline'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Sidebar art */}
          <div style={{ marginTop:4, borderRadius:18, overflow:'hidden', position:'relative', height:150, border:'1px solid var(--border)' }}>
            <img src="https://i.pinimg.com/736x/0d/9c/d0/0d9cd0fe3cc52b83c3181815c3020db9.jpg" alt=""
              style={{ width:'100%', height:'100%', objectFit:'cover', filter:'brightness(.6) saturate(.8)' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to top,rgba(18,11,9,.9),transparent 60%)', display:'flex', flexDirection:'column', justifyContent:'flex-end', padding:'14px 12px' }}>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:15, fontWeight:600, color:'var(--cream)' }}>Collect the <em style={{ color:'var(--gold)' }}>Reports</em> ✦</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:2 }}>Generate laporan bulan ini</div>
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r3)', overflow:'hidden', display:'flex', flexDirection:'column' }}>

          {/* Header */}
          <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border2)', display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div>
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:24, fontWeight:700, color:'var(--cream)' }}>{bulanLabel(activeBulan)}</div>
              <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{submitted.length} orang sudah submit · Periode: 1–{new Date(Number(activeBulan.split('-')[0]), Number(activeBulan.split('-')[1]), 0).getDate()} {bulanShort(activeBulan)}</div>
            </div>
            <div style={{ display:'flex', gap:7, flexShrink:0, flexWrap:'wrap' }}>
              <button onClick={() => handleDownload('laporan')} disabled={downloading !== null}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:'var(--r2)', border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--cream)', fontFamily:'DM Sans,sans-serif', fontSize:12, fontWeight:500, cursor: downloading ? 'not-allowed' : 'pointer', whiteSpace:'nowrap', opacity: downloading === 'laporan' ? .6 : 1 }}>
                {downloading === 'laporan' ? '⏳ Mengunduh…' : '📄 Laporan Lembur .docx'}
              </button>
              <button onClick={() => handleDownload('moo')} disabled={downloading !== null}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:'var(--r2)', border:'none', background:'linear-gradient(135deg,var(--burg2),var(--burg))', color:'white', fontFamily:'DM Sans,sans-serif', fontSize:12, fontWeight:600, cursor: downloading ? 'not-allowed' : 'pointer', whiteSpace:'nowrap', opacity: downloading === 'moo' ? .6 : 1 }}>
                {downloading === 'moo' ? '⏳ Mengunduh…' : '✦ Generate MoO .zip'}
              </button>
            </div>
          </div>

          {/* Deadline alert */}
          {dlDate && (
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 24px', background:'rgba(212,136,10,.08)', borderBottom:'1px solid rgba(212,136,10,.2)' }}>
              <span style={{ fontSize:16 }}>⏰</span>
              <div style={{ fontSize:12, color:'var(--gold2)', flex:1 }}>
                <strong>Deadline submit {bulanShort(activeBulan)}:</strong> {dlDate.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                {daysLeft !== null && daysLeft >= 0 && ` · ${daysLeft} hari lagi`}
                {notSubmitted.length > 0 && ` · belum submit: ${notSubmitted.map(s=>s.profile.nama.split(' ')[0]).join(', ')}`}
              </div>
              <button onClick={() => setDlEditing(activeBulan)}
                style={{ fontSize:11, color:'var(--muted)', background:'none', border:'none', cursor:'pointer', fontFamily:'DM Sans,sans-serif', textDecoration:'underline', textUnderlineOffset:2 }}>✎ ubah</button>
            </div>
          )}

          {/* Stats */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', borderBottom:'1px solid var(--border2)' }}>
            {[['Orang Submit', submitted.length], ['Total Events', totalEvents], ['Total Kompensasi', `${totalDurasi.toFixed(1)}j`], ['Status', notSubmitted.length > 0 ? `${notSubmitted.length} belum` : 'Semua ✓']].map(([l,v]) => (
              <div key={l as string} style={{ padding:'14px 20px', borderRight:'1px solid var(--border2)' }}>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:26, fontWeight:600, color:'var(--gold)' }}>{v}</div>
                <div style={{ fontSize:11, color:'var(--muted)', marginTop:1 }}>{l}</div>
              </div>
            ))}
          </div>

          {/* Tab bar */}
          <div style={{ display:'flex', borderBottom:'1px solid var(--border2)', padding:'0 16px' }}>
            {(['submissions','events'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{ padding:'10px 16px', background:'none', border:'none', borderBottom: activeTab===tab ? '2px solid var(--gold)' : '2px solid transparent', color: activeTab===tab ? 'var(--gold)' : 'var(--muted)', fontFamily:'DM Sans,sans-serif', fontSize:12, fontWeight:600, cursor:'pointer', textTransform:'uppercase', letterSpacing:.8, marginBottom:-1 }}>
                {tab === 'submissions' ? 'Submissions' : 'Events'}
              </button>
            ))}
          </div>

          {/* People list */}
          {activeTab === 'submissions' && (loading ? (
            <div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Memuat…</div>
          ) : (
            <div style={{ padding:12 }}>
              <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2, color:'var(--muted)', padding:'4px 4px 10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                SUBMISSION STATUS
                <span style={{ fontSize:10, color:'var(--muted)', fontWeight:400 }}>Klik nama untuk lihat events</span>
              </div>

              {submissions.length === 0 && (
                <div style={{ padding:'30px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>Belum ada yang submit untuk bulan ini.</div>
              )}

              {submissions.map(sub => {
                const initials = sub.profile.nama.split(' ').map((w:string)=>w[0]).join('').slice(0,2).toUpperCase()
                const jam = (sub.events??[]).reduce((s:number,e:LemburEvent)=>s+e.total_jam,0)
                const expanded = expandedPerson === sub.id
                return (
                  <div key={sub.id}>
                    <div onClick={() => setExpandedPerson(expanded ? null : sub.id)}
                      style={{ display:'grid', gridTemplateColumns:'1fr auto auto auto', alignItems:'center', gap:14, padding:'12px 12px', borderRadius:'var(--r2)', border:'1px solid transparent', cursor:'pointer', transition:'all .15s', marginBottom:4 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background='rgba(200,153,78,.05)'; (e.currentTarget as HTMLElement).style.borderColor='var(--border2)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.borderColor='transparent' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
                        <div style={{ width:36, height:36, borderRadius:'50%', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:13, color:'white', flexShrink:0, background:avatarColor(sub.profile.nama) }}>{initials}</div>
                        <div>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--cream)' }}>{sub.profile.nama}</div>
                          <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace', marginTop:1 }}>NIK {sub.profile.nik}</div>
                        </div>
                      </div>
                      <div style={{ fontSize:12, color:'var(--muted)', textAlign:'right', whiteSpace:'nowrap' }}>
                        <strong style={{ color:'var(--cream)' }}>{(sub.events??[]).length}</strong> events
                      </div>
                      <div>
                        <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'var(--gold)', textAlign:'right', lineHeight:1 }}>{jam.toFixed(1)}j</div>
                        <div style={{ fontSize:10, color:'var(--muted)' }}>kompensasi</div>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:5, padding:'4px 11px', borderRadius:20, fontSize:11, fontWeight:600, whiteSpace:'nowrap', ...(sub.status==='submitted' ? {background:'rgba(58,158,95,.12)',color:'#6fcf97',border:'1px solid rgba(58,158,95,.25)'} : {background:'var(--amberbg)',color:'var(--gold2)',border:'1px solid rgba(212,136,10,.22)'}) }}>
                        <div style={{ width:6, height:6, borderRadius:'50%', background:'currentColor' }} />
                        {sub.status === 'submitted' ? 'Submitted' : 'Draft'}
                      </div>
                    </div>
                    {expanded && (
                      <div style={{ margin:'0 8px 8px 8px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' }}>
                        <EventList events={sub.events??[]} readOnly onCopy={openCopyForm} />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* Events tab */}
          {activeTab === 'events' && (() => {
            type EvWithProfile = LemburEvent & { profile: Profile }
            const allEvts: EvWithProfile[] = submissions.flatMap(s => (s.events ?? []).map(e => ({ ...e, profile: s.profile }))).sort((a,b) => a.hari_tanggal.localeCompare(b.hari_tanggal) || a.dari_jam.localeCompare(b.dari_jam))
            // Group by date + project into merged rows
            const groupMap = new Map<string, EvWithProfile[]>()
            allEvts.forEach(e => {
              const k = `${e.hari_tanggal}__${e.project}`
              if (!groupMap.has(k)) groupMap.set(k, [])
              groupMap.get(k)!.push(e)
            })
            const groups = Array.from(groupMap.entries()).map(([k, evs]) => ({
              key: k,
              hari_tanggal: evs[0].hari_tanggal,
              project: evs[0].project,
              evs,
              peserta: [...new Set(evs.map(e => e.profile.nama))],
              kegiatan: [...new Set(evs.flatMap(e => e.kegiatan))],
              dari_jam: [...evs.map(e => e.dari_jam)].sort()[0],
              sampai_jam: [...evs.map(e => e.sampai_jam)].sort().reverse()[0],
            }))
            return (
              <div style={{ padding:12, display:'flex', flexDirection:'column', gap:4 }}>
                {loading && <div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Memuat…</div>}
                {!loading && groups.length === 0 && <div style={{ padding:40, textAlign:'center', color:'var(--muted)', fontSize:13 }}>Belum ada events bulan ini.</div>}
                {!loading && groups.map(g => {
                  const open = expandedEvent === g.key
                  return (
                    <div key={g.key} style={{ border:'1px solid var(--border)', borderRadius:'var(--r2)', overflow:'hidden' }}>
                      <div onClick={() => setExpandedEvent(open ? null : g.key)}
                        style={{ display:'grid', gridTemplateColumns:'90px 1fr auto auto', alignItems:'center', gap:10, padding:'10px 14px', cursor:'pointer', background: open ? 'rgba(200,153,78,.06)' : 'var(--bg3)' }}
                        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background='rgba(200,153,78,.04)' }}
                        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background='var(--bg3)' }}>
                        <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>{g.hari_tanggal}</div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:600, color:'var(--cream)', display:'flex', alignItems:'center', gap:6 }}>
                            <span style={{ fontSize:10, background:'var(--amberbg)', color:'var(--gold2)', padding:'1px 7px', borderRadius:10, fontFamily:'DM Sans,sans-serif', fontWeight:700 }}>{g.project}</span>
                            <span style={{ color:'var(--muted)', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:240 }}>{g.kegiatan.join('; ')}</span>
                          </div>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:3 }}>
                            <span style={{ fontSize:11, color:'var(--muted)' }}>{g.dari_jam}–{g.sampai_jam}</span>
                            <span style={{ fontSize:10, color:'var(--muted)' }}>·</span>
                            {g.peserta.map(n => (
                              <span key={n} style={{ fontSize:10, background:'rgba(200,153,78,.12)', color:'var(--gold)', border:'1px solid rgba(200,153,78,.2)', padding:'1px 7px', borderRadius:10 }}>{n.split(' ')[0]}</span>
                            ))}
                          </div>
                        </div>
                        <div style={{ fontSize:11, color:'var(--muted)', textAlign:'right', whiteSpace:'nowrap' }}>{g.evs.length} orang</div>
                        <div style={{ color:'var(--muted)', fontSize:12 }}>{open ? '▲' : '▼'}</div>
                      </div>
                      {open && (
                        <div style={{ borderTop:'1px solid var(--border2)', background:'var(--bg2)' }}>
                          {g.evs.map((ev, i) => (
                            <div key={ev.id} style={{ padding:'12px 14px', borderBottom: i < g.evs.length-1 ? '1px solid var(--border2)' : 'none' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                                <div style={{ fontSize:12, fontWeight:600, color:'var(--cream)' }}>{ev.profile.nama}</div>
                                <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>NIK {ev.profile.nik}</div>
                              </div>
                              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'6px 16px', fontSize:12 }}>
                                <Detail label="Kegiatan" value={ev.kegiatan.join('; ')} />
                                <Detail label="Jam" value={`${ev.dari_jam}–${ev.sampai_jam}`} />
                                <Detail label="Durasi" value={`${ev.durasi.toFixed(2)}j`} />
                                <Detail label="Kompensasi" value={`${ev.total_jam.toFixed(2)}j`} />
                                <Detail label="WFO/WFH" value={ev.wfo ? 'WFO' : 'WFH'} />
                                <Detail label="Standby" value={ev.standby ? 'Ya' : 'Tidak'} />
                              </div>
                              {ev.bukti_urls && ev.bukti_urls.length > 0 && (
                                <div style={{ marginTop:8 }}>
                                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--gold)', marginBottom:6 }}>Bukti ({ev.bukti_urls.length})</div>
                                  <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                                    {ev.bukti_urls.map((url, j) => (
                                      url.match(/\.(heic|heif)$/i)
                                        ? <div key={j} style={{ width:64, height:64, borderRadius:6, border:'1px solid var(--border)', background:'var(--bg3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'var(--muted)', fontFamily:'monospace' }}>HEIC</div>
                                        : <a key={j} href={url} target="_blank" rel="noreferrer"><img src={url} alt={`Bukti ${j+1}`} style={{ width:64, height:64, borderRadius:6, border:'1px solid var(--border)', objectFit:'cover', display:'block' }} /></a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* Lembur Saya */}
          {!loading && (
            <div style={{ borderTop:'1px solid var(--border2)', margin:'0 0 0 0' }}>
              <div onClick={() => setMyPanelOpen(o => !o)}
                style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px', cursor:'pointer' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(200,153,78,.04)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2, color:'var(--gold)' }}>✦ Lembur Saya</span>
                  <span style={{ fontSize:11, color:'var(--muted)' }}>{myEvents.length} events · {myEvents.reduce((s,e)=>s+e.total_jam,0).toFixed(1)}j</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <button onClick={e => { e.stopPropagation(); setShowCopyPicker(true); setMyPanelOpen(true) }}
                    style={{ padding:'5px 12px', borderRadius:'var(--r2)', border:'1px solid var(--gold)', background:'transparent', color:'var(--gold)', fontFamily:'DM Sans,sans-serif', fontSize:11, fontWeight:500, cursor:'pointer' }}>
                    ⧉ Salin Event
                  </button>
                  <button onClick={e => { e.stopPropagation(); setCopyPrefill(undefined); setEditingMyEvent(null); setShowEventForm(true); setMyPanelOpen(true) }}
                    style={{ padding:'5px 12px', borderRadius:'var(--r2)', border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--cream)', fontFamily:'DM Sans,sans-serif', fontSize:11, fontWeight:500, cursor:'pointer' }}>
                    ＋ Tambah Event
                  </button>
                  <span style={{ color:'var(--muted)', fontSize:13 }}>{myPanelOpen ? '▲' : '▼'}</span>
                </div>
              </div>
              {myPanelOpen && (
                <div style={{ borderTop:'1px solid var(--border2)' }}>
                  <EventList
                    events={myEvents}
                    onEdit={ev => { setEditingMyEvent(ev); setCopyPrefill(undefined); setShowEventForm(true) }}
                    onDelete={handleDeleteMyEvent}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showEventForm && (
        <AddEventPanel
          profile={profile}
          bulan={activeBulan}
          editingEvent={editingMyEvent}
          prefill={copyPrefill}
          onClose={() => { setShowEventForm(false); setEditingMyEvent(null); setCopyPrefill(undefined) }}
          onSaved={() => { setShowEventForm(false); setEditingMyEvent(null); setCopyPrefill(undefined); loadMyEvents(activeBulan) }}
        />
      )}

      {showCopyPicker && (
        <div
          onClick={() => setShowCopyPicker(false)}
          style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,.6)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r1)', width:'100%', maxWidth:680, maxHeight:'80vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
            <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <span style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, color:'var(--gold)', letterSpacing:.5 }}>Salin Event dari Submission Lain</span>
              <button onClick={() => setShowCopyPicker(false)} style={{ background:'none', border:'none', color:'var(--muted)', fontSize:18, cursor:'pointer', lineHeight:1 }}>✕</button>
            </div>
            <div style={{ overflowY:'auto', padding:'12px 16px', display:'flex', flexDirection:'column', gap:16 }}>
              {submissions.filter(s => s.profile.id !== profile.id && (s.events?.length ?? 0) > 0).length === 0 && (
                <div style={{ color:'var(--muted)', textAlign:'center', padding:'32px 0', fontFamily:'DM Sans,sans-serif', fontSize:13 }}>Belum ada event dari orang lain bulan ini.</div>
              )}
              {submissions.filter(s => s.profile.id !== profile.id && (s.events?.length ?? 0) > 0).map(s => (
                <div key={s.profile.id}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:1.2, color:'var(--gold)', marginBottom:6 }}>
                    {s.profile.nama}
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    {(s.events ?? []).map(ev => (
                      <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:'var(--r2)' }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:12, color:'var(--cream)', fontFamily:'DM Sans,sans-serif', fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
                            {ev.kegiatan.join('; ')}
                          </div>
                          <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>
                            {ev.hari_tanggal} · {ev.dari_jam}–{ev.sampai_jam} · {ev.project}
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const { id: _id, user_id: _uid, month_id: _mid, created_at: _ca, ...rest } = ev
                            setCopyPrefill(rest)
                            setEditingMyEvent(null)
                            setShowCopyPicker(false)
                            setShowEventForm(true)
                          }}
                          style={{ padding:'4px 12px', borderRadius:'var(--r2)', border:'1px solid var(--gold)', background:'transparent', color:'var(--gold)', fontFamily:'DM Sans,sans-serif', fontSize:11, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                          Salin →
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
