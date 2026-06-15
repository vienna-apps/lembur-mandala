'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { Session } from '@supabase/supabase-js'
import { getSupabaseClient } from '@/lib/supabase-client'
import type { Profile } from '@/lib/types'

interface AuthCtx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ session: null, profile: null, loading: true, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const sb = getSupabaseClient()

    async function loadProfile(sess: Session | null) {
      if (!sess) { setProfile(null); setLoading(false); return }
      const { data } = await sb.from('profiles').select('*').eq('id', sess.user.id).single()
      setProfile(data ?? null)
      setLoading(false)
    }

    sb.auth.getSession().then(({ data }) => {
      setSession(data.session)
      loadProfile(data.session)
    })

    const { data: listener } = sb.auth.onAuthStateChange((_ev, sess) => {
      setSession(sess)
      loadProfile(sess)
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  async function signOut() {
    await getSupabaseClient().auth.signOut()
  }

  return <Ctx.Provider value={{ session, profile, loading, signOut }}>{children}</Ctx.Provider>
}

export function useAuth() { return useContext(Ctx) }
