import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
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
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  )
}
