import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import AuthProvider from '@/components/auth/AuthProvider'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import 'regenerator-runtime/runtime'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Tunarasa - Platform Komunikasi Inklusif',
  description:
    'Menciptakan kota cerdas dengan komunikasi tanpa batas. Platform komunikasi inklusif untuk aksesibilitas layanan publik bagi penyandang disabilitas.',
  keywords: ['komunikasi inklusif', 'aksesibilitas', 'bahasa isyarat', 'SIBI', 'tuna rungu', 'tuna wicara'],
  authors: [{ name: 'Tunarasa Team' }],
  robots: 'index, follow',
  openGraph: {
    title: 'Tunarasa - Platform Komunikasi Inklusif',
    description: 'Menciptakan kota cerdas dengan komunikasi tanpa batas',
    type: 'website',
    locale: 'id_ID',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
