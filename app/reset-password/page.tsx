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
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')

    if (token_hash && type === 'recovery') {
      // New email template: ?token_hash=xxx&type=recovery
      getSupabaseClient().auth.verifyOtp({ token_hash, type: 'recovery' }).then(({ error }) => {
        if (error) { setStage('error'); return }
        setStage('form')
      })
      return
    }

    // Fallback: Supabase implicit flow sends #access_token=xxx in the hash.
    // The Supabase client auto-processes the hash on getSession().
    const hash = window.location.hash
    if (hash.includes('type=recovery') && hash.includes('access_token=')) {
      getSupabaseClient().auth.getSession().then(({ data, error }) => {
        if (error || !data.session) { setStage('error'); return }
        setStage('form')
      })
      return
    }

    setStage('error')
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
    await getSupabaseClient().auth.signOut()
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
            Buat password<br />baru <em style={{ color: 'var(--gold2)', fontStyle: 'italic' }}>yang kuat.</em>
          </div>
          <div style={{ fontSize: 14, color: 'rgba(242,227,208,.65)', lineHeight: 1.6, maxWidth: 320 }}>
            Pilih password baru yang aman untuk melindungi akun lembur kamu.
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

        {stage === 'loading' && (
          <>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Memverifikasi…</div>
            <div style={{ fontSize: 14, color: 'var(--muted)' }}>Sedang memverifikasi link reset kamu.</div>
          </>
        )}

        {stage === 'error' && (
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>❌</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Link Tidak Valid</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 36 }}>
              Link reset tidak valid atau sudah kadaluarsa.<br />Minta link reset yang baru.
            </div>
            <Link href="/login/forgot" className="btn-primary" style={{ display: 'inline-block', textAlign: 'center', textDecoration: 'none' }}>
              Minta Link Baru →
            </Link>
          </>
        )}

        {stage === 'form' && (
          <>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>Reset Password</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 36 }}>Masukkan password baru kamu.</div>

            <form onSubmit={handleSubmit}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--brown)', marginBottom: 8 }}>Password Baru</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: .45, fontSize: 15 }}>🔒</span>
                  <input
                    className="field-input"
                    style={{ paddingLeft: 42 }}
                    type="password"
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    autoFocus
                    minLength={8}
                  />
                </div>
              </div>
              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--brown)', marginBottom: 8 }}>Konfirmasi Password</label>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', opacity: .45, fontSize: 15 }}>🔒</span>
                  <input
                    className="field-input"
                    style={{ paddingLeft: 42 }}
                    type="password"
                    placeholder="Ulangi password baru"
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    required
                  />
                </div>
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
          <>
            <div style={{ fontSize: 48, marginBottom: 20 }}>✅</div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>Password Berhasil Diubah!</div>
            <div style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 36 }}>
              Silakan login dengan password baru kamu.
            </div>
            <button className="btn-primary" onClick={() => router.push('/login')} style={{ width: '100%' }}>
              Login Sekarang →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
