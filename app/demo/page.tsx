import Link from 'next/link'
import './demo.css'

const sampleEvents = [
  { date: '12 Aug 2026', title: 'BI-FAST reconciliation support', detail: '19:00–22:30 · WFH', project: 'Banking', hours: '3.5j' },
  { date: '16 Aug 2026', title: 'Production release monitoring', detail: '20:00–23:00 · WFO', project: 'Release', hours: '4.5j' },
  { date: '21 Aug 2026', title: 'Monthly report validation', detail: '18:30–21:00 · WFH', project: 'Mandala', hours: '2.5j' },
]

export default function DemoPage() {
  return (
    <main className="demo-shell">
      <div className="demo-wrap">
        <header className="demo-top">
          <div>
            <div className="demo-eyebrow">Read-only public demo</div>
            <h1 className="demo-title">Lembur Mandala</h1>
            <p className="demo-copy">Explore the employee dashboard with safe sample data. No account is required, and nothing here is connected to real employee records.</p>
          </div>
          <nav className="demo-actions" aria-label="Demo actions">
            <Link href="/login">Open full app</Link>
            <Link href="https://vienna-portfolio-psi.vercel.app/">Back to portfolio</Link>
          </nav>
        </header>

        <div className="demo-note"><span>✦</span><span>Demo mode: actions are previews only and do not save or submit data.</span></div>

        <section className="demo-grid" aria-label="Sample overtime dashboard">
          <article className="demo-card demo-hero">
            <div className="demo-month">August 2026</div>
            <div className="demo-status">Status: Draft · editable until submission</div>
            <div className="demo-stats">
              <div className="demo-stat"><strong>3</strong><span>Events</span></div>
              <div className="demo-stat"><strong>9.0h</strong><span>Total duration</span></div>
              <div className="demo-stat"><strong>10.5h</strong><span>Compensation</span></div>
              <div className="demo-stat"><strong>3</strong><span>Projects</span></div>
            </div>
          </article>

          <article className="demo-card">
            <h3>Submission progress</h3>
            <div className="demo-steps">
              <div className="demo-step"><b>✓</b><div><strong>Entries created</strong><span>Three sample overtime events</span></div></div>
              <div className="demo-step"><b>2</b><div><strong>Review and edit</strong><span>Check hours, project, and evidence</span></div></div>
              <div className="demo-step"><b>3</b><div><strong>Submit to admin</strong><span>Locked in this public demo</span></div></div>
            </div>
          </article>

          <article className="demo-card demo-events">
            <div className="demo-events-head"><h2>Overtime events</h2><span className="demo-pill">3 sample events</span></div>
            {sampleEvents.map((event) => (
              <div className="demo-event" key={event.date + event.title}>
                <time>{event.date}</time>
                <div><strong>{event.title}</strong><small>{event.detail}</small></div>
                <span className="demo-project">{event.project}</span>
                <span className="demo-hours">{event.hours}</span>
              </div>
            ))}
          </article>
        </section>
      </div>
    </main>
  )
}
