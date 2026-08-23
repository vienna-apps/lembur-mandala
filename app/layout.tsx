import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'

export const metadata: Metadata = {
  title: 'Lembur Mandala',
  description: 'Overtime Report Management - Mandala Project',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="h-full">
      <body className="h-full antialiased">
        <AuthProvider>{children}</AuthProvider>
        <Script src="/translations.js" strategy="afterInteractive" />
        <Script src="/demo-translations.js" strategy="afterInteractive" />
        <Script src="/i18n.js" strategy="afterInteractive" />
      </body>
    </html>
  )
}
