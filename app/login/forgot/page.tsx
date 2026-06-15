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

    // Resolve user's auth email
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

    // Send reset email via Supabase (goes to their real gmail)
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const { error: err } = await getSupabaseClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/reset-password`,
    })

    if (err) { setError(err.message); setBusy(false); return }
    setStage('sent')
    setBusy(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>

        <div style={{ marginBottom: 32 }}>
          <Link href="/login" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            ← Kembali ke login
          </Link>
        </div>

        <div className="card card-pad">
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 700, color: 'var(--cream)', marginBottom: 8 }}>
            Lupa Password
          </div>

          {stage === 'form' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28, lineHeight: 1.6 }}>
                Masukkan username kamu. Jika kamu sudah setup gmail <span style={{ color: 'var(--gold2)', fontWeight: 500 }}>@daksa.co.id</span>, link reset akan dikirim ke sana.
              </div>

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--brown)', marginBottom: 8 }}>Username</label>
                  <input
                    className="field-input"
                    type="text"
                    placeholder="vania / aditya / cepi …"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    required
                    autoFocus
                    autoCapitalize="none"
                  />
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
            </>
          )}

          {stage === 'sent' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>📬</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cream)', marginBottom: 8 }}>
                Link dikirim!
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                Cek inbox gmail <span style={{ color: 'var(--gold2)', fontWeight: 500 }}>@daksa.co.id</span> kamu. Klik link di email untuk set password baru.
              </div>
              <div style={{ marginTop: 24 }}>
                <Link href="/login" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
                  Kembali ke login →
                </Link>
              </div>
            </div>
          )}

          {stage === 'no-gmail' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cream)', marginBottom: 8 }}>
                Gmail belum disetup
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                Kamu belum menghubungkan gmail <span style={{ color: 'var(--gold2)', fontWeight: 500 }}>@daksa.co.id</span> ke akun ini.<br /><br />
                Login dulu, lalu setup gmail di menu <strong style={{ color: 'var(--cream)' }}>Pengaturan Akun</strong>. Atau minta Vania untuk reset password kamu.
              </div>
              <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
                <Link href="/login" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
                  ← Login
                </Link>
                <button onClick={() => { setStage('form'); setUsername('') }}
                  style={{ fontSize: 13, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                  Coba username lain
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
