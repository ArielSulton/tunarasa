'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, FileText, AlertCircle, Star, Check, ClipboardList, ArrowRight } from 'lucide-react'
import { type Institution } from '@/hooks/useSelectedInstitution'

interface InstitutionSelectorProps {
  onSelectInstitution?: (institution: Institution) => void
  selectedInstitution?: Institution | null
  showFAQButton?: boolean
  onShowFAQRecommendations?: (institution: Institution) => void
}

export function InstitutionSelector({
  onSelectInstitution,
  selectedInstitution,
  showFAQButton = false,
  onShowFAQRecommendations,
}: InstitutionSelectorProps) {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchInstitutions() {
      try {
        // Fetch public institutions (no auth required for public view)
        const response = await fetch('/api/public/institutions', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Gagal mengambil data institusi: ${response.status}`)
        }

        const data = await response.json()
        if (data.success) {
          // Only show active institutions to public users
          const activeInstitutions = data.data.institutions.filter((inst: Institution) => inst.isActive)
          setInstitutions(activeInstitutions)
        } else {
          throw new Error(data.error ?? 'Gagal mengambil data institusi')
        }
      } catch (err) {
        console.error('Error fetching institutions:', err)
        setError(err instanceof Error ? err.message : 'Gagal memuat institusi')
      } finally {
        setLoading(false)
      }
    }

    void fetchInstitutions()
  }, [])

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900">Pilih Layanan Institusi</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-3/4 rounded bg-gray-300" />
                <div className="h-3 w-full rounded bg-gray-300" />
              </CardHeader>
              <CardContent>
                <div className="h-10 w-full rounded bg-gray-300" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <div className="flex items-center">
          <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
          <span className="font-medium text-red-800">Gagal memuat institusi</span>
        </div>
        <p className="mt-2 text-sm text-red-700">{error}</p>
        <Button onClick={() => window.location.reload()} className="mt-3 bg-red-600 hover:bg-red-700" size="sm">
          Coba Lagi
        </Button>
      </div>
    )
  }

  if (institutions.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <Building2 className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Tidak ada institusi tersedia</h3>
        <p className="mt-2 text-gray-600">
          Saat ini tidak ada institusi aktif yang menyediakan layanan. Silakan cek kembali nanti.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-3xl font-bold text-gray-900">Pilih Layanan Institusi</h3>
        <p className="mt-3 text-lg text-gray-600">
          Pilih institusi yang ingin Anda hubungi untuk mendapatkan informasi layanan.
        </p>
      </div>

      <div
        className={`mx-auto ${institutions.length === 1 ? 'max-w-lg' : institutions.length === 2 ? 'grid max-w-4xl gap-6 md:grid-cols-2' : 'grid gap-6 md:grid-cols-2 lg:grid-cols-3'}`}
      >
        {institutions.map((institution) => {
          const isSelected = selectedInstitution?.institutionId === institution.institutionId
          const isDefault = institution.slug === 'dukcapil'

          return (
            <Card
              key={institution.institutionId}
              className={`group relative cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl ${
                isSelected
                  ? 'border-blue-200 bg-gradient-to-br from-blue-50 via-white to-blue-50/30 shadow-xl ring-2 ring-blue-500'
                  : 'bg-white hover:bg-gradient-to-br hover:from-blue-50/20 hover:via-white hover:to-blue-50/10 hover:shadow-blue-100/50'
              } ${isDefault ? 'border-green-200 ring-2 ring-green-400/30' : 'border-gray-200/60'} overflow-hidden`}
              onClick={() => onSelectInstitution?.(institution)}
            >
              {/* Header dengan Logo dan Title */}
              <CardHeader className="pb-6">
                <div className="flex items-start space-x-4">
                  {/* Logo */}
                  <div className="flex-shrink-0">
                    {institution.logoUrl ? (
                      <div className="relative">
                        <Image
                          src={institution.logoUrl}
                          alt={`${institution.name} logo`}
                          width={72}
                          height={72}
                          className="h-18 w-18 rounded-2xl object-cover shadow-lg ring-4 ring-white"
                        />
                      </div>
                    ) : (
                      <div className="flex h-18 w-18 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 shadow-lg ring-4 ring-white">
                        <Building2 className="h-10 w-10 text-white" />
                      </div>
                    )}
                  </div>

                  {/* Title and Badges */}
                  <div className="min-w-0 flex-1">
                    <div className="space-y-3">
                      <div>
                        <CardTitle className="text-xl leading-tight font-bold text-gray-900">
                          {institution.name}
                        </CardTitle>
                        <div className="mt-2">
                          <Badge variant="secondary" className="bg-gray-100 text-xs font-medium text-gray-700">
                            {institution.slug}
                          </Badge>
                        </div>
                      </div>

                      {/* Status Badges */}
                      <div className="flex flex-wrap gap-2">
                        {isDefault && (
                          <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-sm">
                            <Star className="mr-1 h-3 w-3" />
                            Layanan Utama
                          </Badge>
                        )}
                        {isSelected && (
                          <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm">
                            <span className="mr-1">✓</span>
                            Terpilih
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Description */}
                {institution.description && (
                  <div className="space-y-1">
                    <CardDescription className="text-base leading-relaxed font-medium text-gray-700">
                      {institution.description}
                    </CardDescription>
                  </div>
                )}

                {/* Stats */}
                {institution._count && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col items-center space-y-1 rounded-xl bg-gradient-to-br from-blue-50 to-blue-100/50 p-4 text-center">
                      <FileText className="h-6 w-6 text-blue-600" />
                      <span className="text-lg font-bold text-blue-900">{institution._count.ragFiles}</span>
                      <span className="text-xs font-medium text-blue-700">Dokumen</span>
                    </div>
                    <div className="flex flex-col items-center space-y-1 rounded-xl bg-gradient-to-br from-green-50 to-green-100/50 p-4 text-center">
                      <Users className="h-6 w-6 text-green-600" />
                      <span className="text-lg font-bold text-green-900">{institution._count.conversations}</span>
                      <span className="text-xs font-medium text-green-700">Percakapan</span>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-4 pt-2">
                  {showFAQButton && isSelected && (
                    <Button
                      size="lg"
                      className="h-14 w-full rounded-2xl bg-gradient-to-r from-green-500 via-green-600 to-green-700 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:from-green-600 hover:via-green-700 hover:to-green-800 hover:shadow-xl active:scale-[0.98]"
                      onClick={(e) => {
                        e.stopPropagation()
                        onShowFAQRecommendations?.(institution)
                      }}
                    >
                      <ClipboardList className="mr-2 h-5 w-5" />
                      FAQ Rekomendasi
                    </Button>
                  )}

                  <Link href={`/komunikasi/${institution.slug}`} className="block">
                    <Button
                      size="lg"
                      className="group h-14 w-full rounded-2xl bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:scale-[1.02] hover:from-blue-600 hover:via-blue-700 hover:to-blue-800 hover:shadow-xl active:scale-[0.98]"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Mulai Komunikasi
                      <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-300 group-hover:translate-x-1" />
                    </Button>
                  </Link>
                </div>
              </CardContent>

              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-6 right-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-blue-600 shadow-lg ring-4 ring-white">
                    <Check className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}

              {/* Default Institution Indicator */}
              {isDefault && !isSelected && (
                <div className="absolute top-6 right-6">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-green-600 shadow-lg ring-4 ring-white">
                    <Star className="h-4 w-4 text-white" />
                  </div>
                </div>
              )}
            </Card>
          )
        })}
      </div>

      <div className="text-center">
        <p className="text-gray-500">
          Tidak menemukan institusi yang Anda cari?{' '}
          <Link href="/kontak" className="font-medium text-blue-600 hover:text-blue-700 hover:underline">
            Hubungi kami
          </Link>
        </p>
      </div>
    </div>
  )
}
