import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { AuthStatus } from '@/components/auth/auth-components'
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
  title: 'Tunarasa - A-Z Sign Language Recognition',
  description:
    'Real-time hand gesture recognition for A-Z sign language with AI-powered Q&A assistance. Built with MediaPipe, TensorFlow.js, and FastAPI.',
  keywords: ['sign language', 'gesture recognition', 'accessibility', 'AI', 'MediaPipe', 'TensorFlow'],
  authors: [{ name: 'Tunarasa Team' }],
  viewport: 'width=device-width, initial-scale=1',
  robots: 'index, follow',
  openGraph: {
    title: 'Tunarasa - A-Z Sign Language Recognition',
    description: 'Real-time hand gesture recognition for A-Z sign language with AI-powered Q&A assistance',
    type: 'website',
    locale: 'en_US',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
          <header className="bg-background border-b">
            <div className="container mx-auto flex items-center justify-between px-4 py-3">
              <h1 className="text-xl font-semibold">Tunarasa</h1>
              <AuthStatus />
            </div>
          </header>
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
