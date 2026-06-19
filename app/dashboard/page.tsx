'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import EmployeeDashboard from '@/components/EmployeeDashboard'

export default function DashboardPage() {
  const { session, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!session) router.replace('/login')
  }, [loading, session, router])

  if (loading || !profile) return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--gold)', fontFamily: 'Cormorant Garamond, serif', fontSize: 22 }}>✦ Memuat…</div>
    </div>
  )

  return <EmployeeDashboard profile={profile} />
}
