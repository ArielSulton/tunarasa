'use client'

import { useEffect, useState } from 'react'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { ChatInterface } from '@/components/chat/ChatInterface'
import { AdminConversationPanel } from '@/components/admin/AdminConversationPanel'
import { useUserRole } from '@/components/auth/SuperAdminOnly'

// Force dynamic rendering and disable static optimization
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface Institution {
  institutionId: number
  name: string
  slug: string
  description?: string
  logoUrl?: string
  isActive: boolean
}

interface KomunikasiSlugPageProps {
  params: Promise<{
    slug: string
  }>
}

async function getInstitutionBySlug(slug: string): Promise<Institution | null> {
  try {
    const response = await fetch(`/api/institutions/${slug}`)
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    return data.success ? data.institution : null
  } catch (error) {
    console.error('Error fetching institution:', error)
    return null
  }
}

// Component that uses auth hooks
function KomunikasiSlugContent({ params }: KomunikasiSlugPageProps) {
  const { role } = useUserRole()

  return <KomunikasiSlugInner role={role} params={params} />
}

interface KomunikasiSlugInnerProps {
  role: string | null
  params: Promise<{ slug: string }>
}

function KomunikasiSlugInner({ role, params }: KomunikasiSlugInnerProps) {
  const [institution, setInstitution] = useState<Institution | null>(null)
  const [loading, setLoading] = useState(true)
  const [slug, setSlug] = useState<string>('')

  useEffect(() => {
    const loadParams = async () => {
      const resolvedParams = await params
      setSlug(resolvedParams.slug)
    }
    void loadParams()
  }, [params])

  useEffect(() => {
    const loadInstitution = async () => {
      if (slug) {
        const institutionData = await getInstitutionBySlug(slug)
        setInstitution(institutionData)
        setLoading(false)
      }
    }
    void loadInstitution()
  }, [slug])

  // Only admin gets the admin panel (superadmin has no access to komunikasi)
  if (role === 'admin') {
    return <AdminConversationPanel isVisible={true} onVisibilityChange={() => {}} />
  }

  // Superadmin should not access komunikasi pages
  if (role === 'superadmin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Akses Terbatas</h1>
          <p className="mt-2 text-gray-600">SuperAdmin tidak memiliki akses ke halaman komunikasi.</p>
          <p className="mt-1 text-sm text-gray-500">Silakan gunakan Dashboard untuk manajemen sistem.</p>
          <a href="/dashboard" className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
            Ke Dashboard
          </a>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!institution?.isActive) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <section className="bg-white shadow-sm">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {institution.logoUrl ? (
                <Image
                  src={institution.logoUrl}
                  alt={`${institution.name} logo`}
                  width={48}
                  height={48}
                  className="h-12 w-12 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100">
                  <span className="text-xl font-bold text-blue-600">{institution.name.charAt(0)}</span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{institution.name}</h1>
                {institution.description && <p className="text-sm text-gray-600">{institution.description}</p>}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chat Interface */}
      <section className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <ChatInterface
            institutionId={institution.institutionId}
            institutionName={institution.name}
            institutionSlug={institution.slug}
          />
        </div>
      </section>
    </div>
  )
}

export default function KomunikasiSlugPage({ params }: KomunikasiSlugPageProps) {
  const [isMounted, setIsMounted] = useState(false)

  // Client-side mounting check
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent server-side rendering of auth hooks
  if (!isMounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return <KomunikasiSlugContent params={params} />
}

// Note: generateStaticParams removed since we converted to Client Component
// Institution data is now fetched client-side via API
