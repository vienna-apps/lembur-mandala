'use client'
import type { LemburEvent } from '@/lib/types'

interface Props {
  events: LemburEvent[]
  readOnly?: boolean
  onEdit?: (e: LemburEvent) => void
  onDelete?: (id: string) => void
  onCopy?: (e: LemburEvent) => void
}

function fmtDate(iso: string) {
  const d = new Date(iso + 'T00:00:00')
  return { day: d.getDate(), mon: d.toLocaleDateString('id-ID', { month: 'short' }).toUpperCase() }
}

export default function EventList({ events, readOnly, onEdit, onDelete, onCopy }: Props) {
  if (events.length === 0) return (
    <div style={{ padding:'40px 20px', textAlign:'center', color:'var(--muted)', fontSize:13 }}>
      Belum ada event untuk bulan ini. Klik &ldquo;Tambah Event&rdquo; untuk mulai.
    </div>
  )

  return (
    <div style={{ padding:10 }}>
      {events.map(ev => {
        const { day, mon } = fmtDate(ev.hari_tanggal)
        return (
          <div key={ev.id} style={{ display:'grid', gridTemplateColumns:'auto 1fr auto auto', alignItems:'center', gap:12, padding:12, borderRadius:'var(--r2)', border:'1px solid transparent', cursor: readOnly ? 'default' : 'pointer', transition:'all .15s', marginBottom:4 }}
            onMouseEnter={e => { if (!readOnly) (e.currentTarget as HTMLElement).style.background='rgba(200,153,78,.05)'; (e.currentTarget as HTMLElement).style.borderColor='var(--border2)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background='transparent'; (e.currentTarget as HTMLElement).style.borderColor='transparent' }}>

            {/* Date tile */}
            <div style={{ width:42, height:42, borderRadius:9, background:'var(--bg3)', border:'1px solid var(--border)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--gold)', lineHeight:1 }}>{day}</div>
              <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.5 }}>{mon}</div>
            </div>

            {/* Info */}
            <div>
              <div style={{ display:'inline-flex', alignItems:'center', background:'rgba(200,153,78,.12)', border:'1px solid rgba(200,153,78,.25)', borderRadius:20, padding:'2px 8px', fontSize:10, color:'var(--gold)', fontWeight:600, marginBottom:3 }}>{ev.project}</div>
              <div style={{ fontSize:13, color:'var(--cream)', lineHeight:1.35 }}>
                {ev.kegiatan.join(' · ')}
              </div>
              <div style={{ display:'flex', gap:4, marginTop:4, flexWrap:'wrap' }}>
                {ev.wfo        && <span className="tag tag-wfo">WFO</span>}
                {!ev.wfo       && <span className="tag tag-wfh">WFH</span>}
                {ev.akhir_pekan && <span className="tag tag-wknd">Weekend ×2</span>}
                {ev.standby    && <span className="tag tag-stnby">Standby ×0.5</span>}
              </div>
            </div>

            {/* Time + duration */}
            <div style={{ fontSize:11, color:'var(--muted)', fontFamily:'monospace', textAlign:'right', whiteSpace:'nowrap' }}>
              {ev.dari_jam}–{ev.sampai_jam}
              <div style={{ fontFamily:'Cormorant Garamond,serif', fontSize:14, color:'var(--cream)', fontWeight:600 }}>{ev.total_jam.toFixed(2)}j</div>
            </div>

            {/* Actions */}
            <div style={{ display:'flex', gap:5 }}>
              {onCopy && (
                <button onClick={() => onCopy(ev)} title="Copy event ini"
                  style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--gold)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>⧉</button>
              )}
              {!readOnly && onEdit && (
                <button onClick={() => onEdit(ev)} title="Edit"
                  style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--muted)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✎</button>
              )}
              {!readOnly && onDelete && (
                <button onClick={() => onDelete(ev.id)} title="Hapus"
                  style={{ width:28, height:28, borderRadius:7, border:'1px solid var(--border)', background:'var(--bg3)', color:'var(--rose)', fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
