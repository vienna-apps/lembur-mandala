// Legacy route — kept for backward compat but points to new tables
import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ message: 'Use /api/months and /api/events instead.' }, { status: 410 })
}

export async function POST() {
  return NextResponse.json({ message: 'Use /api/events instead.' }, { status: 410 })
}
