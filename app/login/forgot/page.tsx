'use client'
import { useState } from 'react'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase-client'

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState('')
  const [stage, setStage] = useState<'form' | 'sent' | 'no-gmail'>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    let email: string
    let hasGmail: boolean
    try {
      const res = await fetch(`/api/auth/resolve?username=${encodeURIComponent(username.trim().toLowerCase())}`)
      if (!res.ok) { setError('Username tidak ditemukan.'); setBusy(false); return }
      const data = await res.json()
      email = data.email
      hasGmail = data.hasGmail
    } catch {
      setError('Gagal menghubungi server. Coba lagi.')
      setBusy(false)
      return
    }

    if (!hasGmail) {
      setStage('no-gmail')
      setBusy(false)
      return
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: err } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })

    if (err) { setError(err.message); setBusy(false); return }
    setStage('sent')
    setBusy(false)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: '100vh' }}>
      {/* Left art panel */}
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <img
          src="https://i.pinimg.com/736x/b9/48/63/b948638e173fd8112d2c0d69d576128b.jpg"
          alt=""
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', filter: 'saturate(.9) brightness(.7)' }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,rgba(126,31,44,.55),rgba(18,11,9,.85))' }} />
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '48px 44px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(200,153,78,.18)', border: '1px solid rgba(200,153,78,.4)', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: 'var(--gold2)', fontWeight: 500, marginBottom: 20, width: 'fit-content' }}>
            ✦ Mandala Project
          </div>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 42, fontWeight: 600, lineHeight: 1.2, color: 'var(--cream)', marginBottom: 14 }}>
            Reset password<br />kamu <em style={{ color: 'var(--gold2)', fontStyle: 'italic' }}>dengan mudah.</em>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(242,227,208,.65)', lineHeight: 1.6, maxWidth: 320 }}>
            Masukkan username kamu dan kami akan mengirim link reset ke gmail @daksa.co.id kamu.
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div style={{ background: 'var(--cream2)', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 64px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 44 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🌙</div>
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>Lembur Mandala</div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Overtime Management System</div>
          </div>
        </div>

        {stage === 'form' && (
          <>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Lupa Password?</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 36, lineHeight: 1.6 }}>
              Masukkan username kamu. Link reset akan dikirim ke gmail <span style={{ color: 'var(--brown)', fontWeight: 500 }}>@daksa.co.id</span> kamu.
            </div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--brown)', marginBottom: 8 }}>Username</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: .45, fontSize: 15 }}>👤</span>
                  <input
                    className="field-input"
                    style={{ paddingLeft: 42 }}
                    type="text"
                    placeholder="vania / aditya / cepi …"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoFocus
                    autoCapitalize="none"
                  />
                </div>
              </div>

              {error && (
                <div style={{ background: 'rgba(196,122,114,.1)', border: '1px solid rgba(196,122,114,.35)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--rose)', marginBottom: 16 }}>
                  {error}
                </div>
              )}

              <button className="btn-primary" type="submit" disabled={busy} style={{ width: '100%', opacity: busy ? .7 : 1 }}>
                {busy ? 'Memproses…' : 'Kirim Link Reset →'}
              </button>
            </form>

            <div style={{ marginTop: 28, textAlign: 'center' }}>
              <Link href="/login" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
                ← Kembali ke login
              </Link>
            </div>
          </>
        )}

        {stage === 'sent' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>📬</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Link Terkirim!</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 36 }}>
              Cek inbox gmail <span style={{ color: 'var(--brown)', fontWeight: 500 }}>@daksa.co.id</span> kamu.<br />
              Klik link di email untuk set password baru.
            </div>
            <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
              ← Kembali ke login
            </Link>
          </>
        )}

        {stage === 'no-gmail' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>⚠️</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Gmail Belum Disetup</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 36 }}>
              Kamu belum menghubungkan gmail <span style={{ color: 'var(--brown)', fontWeight: 500 }}>@daksa.co.id</span> ke akun ini.<br /><br />
              Login dulu, lalu setup gmail di menu <strong style={{ color: 'var(--text)' }}>Pengaturan Akun</strong>. Atau minta Vania untuk reset password kamu.
            </div>
            <div style={{ display: 'flex', gap: 16 }}>
              <Link href="/login" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
                ← Login
              </Link>
              <button onClick={() => { setStage('form'); setUsername('') }}
                style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                Coba username lain
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
