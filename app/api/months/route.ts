import { NextRequest, NextResponse } from 'next/server'
import { getAdminClient, verifyToken } from '@/lib/db'

function token(req: NextRequest) {
  return req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
}

// GET /api/months — current user's months (sorted newest first)
export async function GET(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getAdminClient()
  const { data, error } = await db
    .from('lembur_months')
    .select('*')
    .eq('user_id', user.id)
    .order('bulan', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// POST /api/months — ensure a month row exists, return it
export async function POST(req: NextRequest) {
  const user = await verifyToken(token(req))
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bulan } = await req.json()
  if (!bulan) return NextResponse.json({ error: 'bulan required' }, { status: 400 })

  const db = getAdminClient()
  // Upsert — do nothing if already exists
  const { data, error } = await db
    .from('lembur_months')
    .upsert({ user_id: user.id, bulan }, { onConflict: 'user_id,bulan', ignoreDuplicates: true })
    .select()
    .single()

  if (error) {
    // If upsert returned nothing (row existed), fetch it
    const { data: existing } = await db
      .from('lembur_months')
      .select('*')
      .eq('user_id', user.id)
      .eq('bulan', bulan)
      .single()
    return NextResponse.json(existing)
  }
  return NextResponse.json(data, { status: 201 })
}
