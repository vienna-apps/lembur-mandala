import { NextResponse } from 'next/server'

export async function DELETE() {
  return NextResponse.json({ message: 'Use /api/events/[id] instead.' }, { status: 410 })
}

export async function PUT() {
  return NextResponse.json({ message: 'Use /api/events/[id] instead.' }, { status: 410 })
}
