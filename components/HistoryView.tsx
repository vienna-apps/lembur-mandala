'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { Profile, LemburMonth, LemburEvent } from '@/lib/types'
import { bulanLabel, bulanShort, currentBulan } from '@/lib/types'
import { getMyMonths, getMonthDetail, createEvent } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import EventList from './EventList'

interface Props { profile: Profile; initialBulan: string }

export default function HistoryView({ profile, initialBulan }: Props) {
  const { signOut } = useAuth()
  const router = useRouter()
  const bulanNow = currentBulan()
  const [months,       setMonths]  = useState<LemburMonth[]>([])
  const [activeBulan,  setActive]  = useState(initialBulan || bulanNow)
  const [currentMonth, setMonth]   = useState<LemburMonth | null>(null)
  const [events,       setEvents]  = useState<LemburEvent[]>([])
  const [loading,      setLoading] = useState(true)
  const [copying,      setCopying] = useState<string|null>(null)

  useEffect(() => {
    getMyMonths().then(data => {
      const past = data.filter(m => m.bulan !== bulanNow)
      setMonths(past)
      const target = initialBulan && initialBulan !== bulanNow ? initialBulan : (past[0]?.bulan ?? bulanNow)
      setActive(target)
    })
  }, [bulanNow, initialBulan])

  useEffect(() => {
    if (!activeBulan || activeBulan === bulanNow) return
    setLoading(true)
    getMonthDetail(activeBulan).then(({ month, events: evs }) => {
      setMonth(month)
      setEvents(evs)
      setLoading(false)
    })
  }, [activeBulan, bulanNow])

  async function copyToCurrent(ev: LemburEvent) {
    setCopying(ev.id)
    try {
      await createEvent({
        bulan: bulanNow,
        hari_tanggal: ev.hari_tanggal,
        project: ev.project,
        kegiatan: ev.kegiatan,
        dari_jam: ev.dari_jam,
        sampai_jam: ev.sampai_jam,
        durasi: ev.durasi,
        standby: ev.standby,
        akhir_pekan: ev.akhir_pekan,
        wfo: ev.wfo,
        total_jam: ev.total_jam,
      })
      alert('Event di-copy ke bulan ini ✓')
    } catch {
      alert('Gagal copy event')
    } finally {
      setCopying(null)
    }
  }

  const totalKomp = events.reduce((s, e) => s + e.total_jam, 0)
  const initials  = profile.nama.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()

  const pastMonths = months // already filtered to non-current

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', padding:24 }}>
      <img src="https://i.pinimg.com/736x/47/e9/5a/47e95ac6318e1d895b2fb34b4843763e.jpg" alt=""
        style={{ position:'fixed', top:0, right:0, width:520, height:520, objectFit:'cover', opacity:.04, pointerEvents:'none', borderRadius:'0 0 0 100%', zIndex:0 }} />

      <div style={{ maxWidth:1100, margin:'0 auto', position:'relative', zIndex:1 }}>

        {/* Topbar */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:16, marginBottom:16 }}>
          <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:22, fontWeight:700, color:'var(--gold)' }}>
            ✦ Lembur <span style={{ color:'var(--cream)', fontWeight:400 }}>Mandala</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--bg3)', border:'1px solid var(--border)', borderRadius:24, padding:'6px 14px 6px 6px' }}>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'var(--burg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', flexShrink:0 }}>{initials}</div>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--cream)' }}>{profile.nama}</div>
              <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace' }}>NIK {profile.nik}</div>
            </div>
            <button onClick={async () => { await signOut(); router.push('/login') }}
              style={{ padding:'5px 10px', borderRadius:20, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:12, cursor:'pointer', fontFamily:'DM Sans,sans-serif', marginLeft:4 }}>
              Logout
            </button>
          </div>
        </div>

        {/* Submitted banner */}
        {currentMonth && (
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 20px', borderRadius:'var(--r2)', border:'1px solid rgba(58,158,95,.35)', background:'var(--greenbg)', marginBottom:16 }}>
            <span style={{ fontSize:20 }}>✅</span>
            <div>
              <div style={{ fontSize:13, fontWeight:600, color:'#6fcf97' }}>
                {bulanLabel(activeBulan)} — {currentMonth.status === 'submitted' ? `Sudah Submitted pada ${new Date(currentMonth.submitted_at!).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}` : 'Draft'}
              </div>
              <div style={{ fontSize:11, color:'var(--muted)', marginTop:2 }}>Data ini sudah diterima admin. Hubungi Vania jika ada koreksi.</div>
            </div>
          </div>
        )}

        {/* Month tabs */}
        <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:14 }}>
          <button onClick={() => router.push('/dashboard')}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, border:'1px solid var(--border)', background:'transparent', color:'var(--muted)', fontSize:12, fontWeight:500, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
            <span>{bulanShort(bulanNow)}</span>
            <span style={{ fontSize:10, padding:'2px 6px', borderRadius:20, background:'rgba(196,122,114,.15)', color:'var(--rose)', border:'1px solid rgba(196,122,114,.3)' }}>Draft</span>
          </button>
          {pastMonths.map(m => (
            <button key={m.bulan} onClick={() => setActive(m.bulan)}
              style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:20, border:`1px solid ${activeBulan===m.bulan ? 'var(--gold)' : 'var(--border)'}`, background: activeBulan===m.bulan ? 'var(--bg3)' : 'transparent', color: activeBulan===m.bulan ? 'var(--cream)' : 'var(--muted)', fontSize:12, fontWeight: activeBulan===m.bulan ? 600 : 500, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
              <span style={{ color: activeBulan===m.bulan ? 'var(--gold)' : undefined }}>{bulanShort(m.bulan)}</span>
              <span style={{ fontSize:10, padding:'2px 6px', borderRadius:20, background:'rgba(58,158,95,.15)', color:'#6fcf97', border:'1px solid rgba(58,158,95,.25)' }}>✓</span>
            </button>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:14 }}>

          {/* Event list (read-only + copy) */}
          <div className="card">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 22px 14px', borderBottom:'1px solid var(--border2)' }}>
              <div>
                <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:18, fontWeight:600, color:'var(--cream)' }}>{bulanLabel(activeBulan)} — Event Lembur</div>
                <div style={{ fontSize:12, color:'var(--muted)', marginTop:3 }}>{events.length} events · {totalKomp.toFixed(2)}j kompensasi</div>
              </div>
              <div style={{ display:'inline-flex', alignItems:'center', gap:7, background:'rgba(58,158,95,.12)', border:'1px solid rgba(58,158,95,.3)', borderRadius:20, padding:'5px 14px', fontSize:12, color:'#6fcf97', fontWeight:600 }}>✓ {currentMonth?.status === 'submitted' ? 'Submitted' : 'Draft'}</div>
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'rgba(58,158,95,.08)', border:'none', borderBottom:'1px solid var(--border2)', margin:0, fontSize:12, color:'#6fcf97' }}>
              🔒 <span><strong>Mode baca saja.</strong> Submission ini sudah dikirim ke admin. Hubungi Vania untuk koreksi.</span>
            </div>

            {loading ? (
              <div style={{ padding:'30px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>Memuat…</div>
            ) : (
              <EventList events={events} readOnly onCopy={copyToCurrent} />
            )}

            <div style={{ padding:'12px 14px 14px', borderTop:'1px solid var(--border2)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ fontSize:12, color:'var(--muted)' }}>⧉ = Copy event ini ke submission {bulanShort(bulanNow)} kamu</div>
              <button onClick={() => router.push('/dashboard')}
                style={{ padding:'7px 16px', borderRadius:20, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--cream)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'DM Sans,sans-serif' }}>
                ← Kembali ke {bulanShort(bulanNow)}
              </button>
            </div>
          </div>

          {/* Sidebar */}
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* Summary */}
            <div className="card card-pad">
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--muted)', marginBottom:14 }}>Ringkasan {bulanShort(activeBulan)}</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:16 }}>
                <div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:26, fontWeight:600, color:'var(--gold)' }}>{events.length}</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>Events</div>
                </div>
                <div>
                  <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:26, fontWeight:600, color:'var(--gold)' }}>{totalKomp.toFixed(2)}j</div>
                  <div style={{ fontSize:11, color:'var(--muted)' }}>Kompensasi</div>
                </div>
              </div>
              {/* Per-project breakdown */}
              {Array.from(new Set(events.map(e=>e.project))).map(proj => {
                const jam = events.filter(e=>e.project===proj).reduce((s,e)=>s+e.total_jam,0)
                return (
                  <div key={proj} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'var(--bg3)', borderRadius:8, marginBottom:5, fontSize:12 }}>
                    <span style={{ color:'var(--muted)' }}>{proj}</span>
                    <span style={{ color:'var(--cream)', fontWeight:600 }}>{jam.toFixed(2)}j</span>
                  </div>
                )
              })}
              {currentMonth?.submitted_at && (
                <div style={{ marginTop:14, paddingTop:12, borderTop:'1px solid var(--border2)', fontSize:11, color:'var(--muted)' }}>
                  Submitted: {new Date(currentMonth.submitted_at).toLocaleString('id-ID')}
                </div>
              )}
            </div>

            {/* All months nav — only months with data */}
            <div className="card card-pad">
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:1, color:'var(--muted)', marginBottom:4 }}>Semua Bulan</div>
              <div style={{ fontSize:11, color:'var(--muted)', marginBottom:10 }}>Hanya bulan dengan data yang ditampilkan.</div>
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <div onClick={() => router.push('/dashboard')}
                  style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background:'var(--bg3)', borderRadius:9, border:'1px solid var(--border)', cursor:'pointer' }}>
                  <span style={{ fontSize:12, color:'var(--cream)', fontWeight:600 }}>{bulanShort(bulanNow)}</span>
                  <span style={{ fontSize:10, color:'var(--amber)', fontWeight:600, background:'var(--amberbg)', padding:'2px 8px', borderRadius:20 }}>Draft</span>
                </div>
                {pastMonths.map(m => (
                  <div key={m.bulan} onClick={() => setActive(m.bulan)}
                    style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', background: activeBulan===m.bulan ? 'rgba(200,153,78,.08)' : 'var(--bg3)', borderRadius:9, border:`1px solid ${activeBulan===m.bulan ? 'rgba(200,153,78,.3)' : 'var(--border)'}`, cursor:'pointer' }}>
                    <span style={{ fontSize:12, color: activeBulan===m.bulan ? 'var(--gold)' : 'var(--cream)', fontWeight: activeBulan===m.bulan ? 600 : 400 }}>{bulanShort(m.bulan)}</span>
                    <span style={{ fontSize:10, color:'#6fcf97', fontWeight:600, background:'rgba(58,158,95,.12)', padding:'2px 8px', borderRadius:20 }}>✓ Submit</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
