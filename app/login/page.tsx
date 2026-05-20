'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateLogin, storeUser } from '@/lib/auth'
import { Lock, User, Clock } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const user = validateLogin(username, password)
    if (user) {
      storeUser(user)
      router.push('/')
    } else {
      setError('Username atau password salah.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm fade-up">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Lembur Mandala</h1>
          <p className="text-white/70 text-sm">Login untuk mencatat lembur kamu</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="contoh: vania"
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-violet-400 focus:outline-none text-slate-800 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border-2 border-slate-200 focus:border-violet-400 focus:outline-none text-slate-800 transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-500 text-sm flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center text-xs font-bold">!</span>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !username || !password}
              className="w-full py-3 rounded-xl gradient-bg text-white font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
            >
              {loading ? 'Masuk...' : 'Masuk'}
            </button>
          </form>

          <div className="px-6 pb-5 text-center text-xs text-slate-400">
            Hubungi admin jika lupa password
          </div>
        </div>
      </div>
    </div>
  )
}
