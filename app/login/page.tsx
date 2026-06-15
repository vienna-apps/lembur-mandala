'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'
import { getSupabaseClient } from '@/lib/supabase-client'

export default function LoginPage() {
  const { session, profile, loading } = useAuth()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Already logged in — redirect
  useEffect(() => {
    if (loading) return
    if (session) {
      if (profile?.is_admin) router.replace('/admin')
      else router.replace('/dashboard')
    }
  }, [loading, session, profile, router])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')

    // Resolve which auth email to use for this username
    let email: string
    try {
      const res = await fetch(`/api/auth/resolve?username=${encodeURIComponent(username.trim().toLowerCase())}`)
      if (!res.ok) { setError('Username tidak ditemukan.'); setBusy(false); return }
      const data = await res.json()
      email = data.email
    } catch {
      setError('Gagal menghubungi server. Coba lagi.')
      setBusy(false)
      return
    }

    const { error: err } = await getSupabaseClient().auth.signInWithPassword({ email, password })
    if (err) { setError('Username atau password salah.'); setBusy(false) }
    // AuthProvider onAuthStateChange will redirect automatically via useEffect above
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
            Catat Lembur<br />kamu <em style={{ color: 'var(--gold2)', fontStyle: 'italic' }}>dengan mudah.</em>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(242,227,208,.65)', lineHeight: 1.6, maxWidth: 320 }}>
            Platform pencatatan lembur bulanan untuk tim Mandala. Submit, pantau, dan generate laporan — semua di satu tempat.
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

        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Selamat Datang</div>
        <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 36 }}>Masuk untuk mencatat lembur bulan ini ✨</div>

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
                autoComplete="username"
                autoCapitalize="none"
              />
            </div>
          </div>

          <div style={{ marginBottom: 8 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--brown)', marginBottom: 8 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: .45, fontSize: 15 }}>🔒</span>
              <input
                className="field-input"
                style={{ paddingLeft: 42 }}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ textAlign: 'right', marginBottom: 20 }}>
            <Link href="/login/forgot" style={{ fontSize: 12, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
              Lupa password?
            </Link>
          </div>

          {error && (
            <div style={{ background: 'rgba(196,122,114,.1)', border: '1px solid rgba(196,122,114,.35)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--rose)', marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button className="btn-primary" type="submit" disabled={busy} style={{ width: '100%', opacity: busy ? .7 : 1 }}>
            {busy ? 'Memuat…' : 'Masuk →'}
          </button>
        </form>

        <div style={{ marginTop: 28, textAlign: 'center', fontSize: 12, color: 'var(--muted)' }}>
          Masalah login? Hubungi <span style={{ color: 'var(--gold)', fontWeight: 500, cursor: 'pointer' }}>Vania (admin)</span>
        </div>
      </div>
    </div>
  )
}
