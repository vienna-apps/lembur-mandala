'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getSupabaseClient } from '@/lib/supabase-client'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [stage, setStage] = useState<'loading' | 'form' | 'done' | 'error'>('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Email template sends: ?token_hash=xxx&type=recovery
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')

    if (!token_hash || type !== 'recovery') {
      setStage('error')
      return
    }

    getSupabaseClient().auth.verifyOtp({ token_hash, type: 'recovery' }).then(({ error }) => {
      if (error) { setStage('error'); return }
      setStage('form')
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { setError('Password tidak cocok.'); return }
    if (password.length < 8) { setError('Password minimal 8 karakter.'); return }

    setBusy(true)
    setError('')
    const { error: err } = await getSupabaseClient().auth.updateUser({ password })
    if (err) { setError(err.message); setBusy(false); return }

    setStage('done')
    // Sign out so they re-login cleanly
    await getSupabaseClient().auth.signOut()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div className="card card-pad">
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, fontWeight: 700, color: 'var(--cream)', marginBottom: 8 }}>
            Reset Password
          </div>

          {stage === 'loading' && (
            <div style={{ color: 'var(--muted)', fontSize: 14, padding: '24px 0' }}>Memverifikasi link…</div>
          )}

          {stage === 'error' && (
            <div style={{ padding: '16px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16, textAlign: 'center' }}>❌</div>
              <div style={{ fontSize: 13, color: 'var(--rose)', lineHeight: 1.6, marginBottom: 20 }}>
                Link reset tidak valid atau sudah kadaluarsa. Minta link reset baru.
              </div>
              <Link href="/login/forgot" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', fontWeight: 500 }}>
                ← Minta link baru
              </Link>
            </div>
          )}

          {stage === 'form' && (
            <>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 28 }}>
                Masukkan password baru kamu.
              </div>
              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--brown)', marginBottom: 8 }}>Password Baru</label>
                  <input
                    className="field-input"
                    type="password"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                    minLength={8}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--brown)', marginBottom: 8 }}>Konfirmasi Password</label>
                  <input
                    className="field-input"
                    type="password"
                    placeholder="Ulangi password baru"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>

                {error && (
                  <div style={{ background: 'rgba(196,122,114,.1)', border: '1px solid rgba(196,122,114,.35)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--rose)', marginBottom: 16 }}>
                    {error}
                  </div>
                )}

                <button className="btn-primary" type="submit" disabled={busy} style={{ width: '100%', opacity: busy ? .7 : 1 }}>
                  {busy ? 'Menyimpan…' : 'Simpan Password Baru →'}
                </button>
              </form>
            </>
          )}

          {stage === 'done' && (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 16 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--cream)', marginBottom: 8 }}>
                Password berhasil diubah!
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 24 }}>
                Silakan login dengan password baru kamu.
              </div>
              <button className="btn-primary" onClick={() => router.push('/login')}>
                Login Sekarang →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
