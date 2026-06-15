import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/db'

// Called daily by Vercel Cron to prevent Supabase free-tier from pausing
export async function GET() {
  const { count, error } = await getAdminClient()
    .from('lembur_events')
    .select('*', { count: 'exact', head: true })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rows: count, ts: new Date().toISOString() })
}
