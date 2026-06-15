import { NextResponse } from 'next/server'

// Legacy export endpoint — replaced by /api/docx/laporan and /api/docx/moo
export async function GET() {
  return NextResponse.json({ message: 'Use /api/docx/laporan or /api/docx/moo instead.' }, { status: 410 })
}
