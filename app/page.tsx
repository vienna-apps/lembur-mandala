'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function HomePage() {
  const { session, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!session) { router.replace('/login'); return }
    if (profile?.is_admin) router.replace('/admin')
    else router.replace('/dashboard')
  }, [loading, session, profile, router])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)', fontFamily: 'Cormorant Garamond, serif', fontSize: 22 }}>✦ Memuat…</div>
    </div>
  )
}
