import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Lembur Mandala',
  description: 'Overtime Report Management - Mandala Project',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full">
      <body className="min-h-full bg-slate-50 antialiased">{children}</body>
    </html>
  )
}
