import { NextResponse } from 'next/server'
import { getClient } from '@/lib/db'

// Called daily by Vercel Cron to prevent Supabase free-tier from pausing
export async function GET() {
  const { count, error } = await getClient()
    .from('lembur_entries')
    .select('*', { count: 'exact', head: true })

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, rows: count, ts: new Date().toISOString() })
}
