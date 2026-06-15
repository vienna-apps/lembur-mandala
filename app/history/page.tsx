'use client'
import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import HistoryView from '@/components/HistoryView'
import { Suspense } from 'react'

function HistoryInner() {
  const { session, profile, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const bulan = searchParams.get('bulan') ?? ''

  useEffect(() => {
    if (loading) return
    if (!session) router.replace('/login')
    else if (profile?.is_admin) router.replace('/admin')
  }, [loading, session, profile, router])

  if (loading || !profile) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)', fontFamily: 'Cormorant Garamond, serif', fontSize: 22 }}>✦ Memuat…</div>
    </div>
  )

  return <HistoryView profile={profile} initialBulan={bulan} />
}

export default function HistoryPage() {
  return (
    <Suspense>
      <HistoryInner />
    </Suspense>
  )
}
