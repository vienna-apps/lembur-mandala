'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, LemburMonth, LemburEvent, Deadline } from '@/lib/types'
import { bulanLabel, bulanShort, currentBulan } from '@/lib/types'
import { getAdminMonth, setDeadline, getDeadlines } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import EventList from './EventList'

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

  useEffect(() => {
    loadDeadlines()
  }, [loadDeadlines])

  useEffect(() => {
    loadMonth(activeBulan)
  }, [activeBulan, loadMonth])

  async function saveDL(bulan: string) {
    const date = dlInputs[bulan] ?? null
    await setDeadline(bulan, date)
    await loadDeadlines()
    setDlEditing(null)
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
              <button onClick={() => window.open(`/api/docx/laporan?bulan=${activeBulan}`)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:'var(--r2)', border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--cream)', fontFamily:'DM Sans,sans-serif', fontSize:12, fontWeight:500, cursor:'pointer', whiteSpace:'nowrap' }}>
                📄 Laporan Lembur .docx
              </button>
              <button onClick={() => window.open(`/api/docx/moo?bulan=${activeBulan}`)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'9px 14px', borderRadius:'var(--r2)', border:'none', background:'linear-gradient(135deg,var(--burg2),var(--burg))', color:'white', fontFamily:'DM Sans,sans-serif', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
                ✦ Generate MoO .docx
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

          {/* People list */}
          {loading ? (
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
                        <EventList events={sub.events??[]} readOnly />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
