import { NextRequest, NextResponse } from 'next/server'
import { getClient } from '@/lib/db'
import { DEFAULT_SUGGESTIONS } from '@/lib/types'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.toLowerCase().trim() ?? ''

  const { data, error } = await getClient()
    .from('kegiatan_suggestions')
    .select('text, use_count')
    .order('use_count', { ascending: false })
    .limit(50)

  if (error) {
    // Fallback to defaults if table doesn't exist yet
    const defaults = q
      ? DEFAULT_SUGGESTIONS.filter(s => s.toLowerCase().includes(q))
      : DEFAULT_SUGGESTIONS
    return NextResponse.json(defaults)
  }

  let results = (data ?? []).map(r => r.text as string)
  if (q) results = results.filter(s => s.toLowerCase().includes(q))
  return NextResponse.json(results.slice(0, 12))
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const text = (body.text as string)?.trim()
  if (!text) return NextResponse.json({ ok: false })

  const supabase = getClient()
  const { data: existing } = await supabase
    .from('kegiatan_suggestions')
    .select('id, use_count')
    .eq('text', text)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('kegiatan_suggestions')
      .update({ use_count: existing.use_count + 1 })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('kegiatan_suggestions')
      .insert({ text, use_count: 1 })
  }

  return NextResponse.json({ ok: true })
}
