'use client'

import { useState } from 'react'
import { InstitutionSelector } from '@/components/layanan/InstitutionSelector'
import { FAQRecommendations } from '@/components/layanan/FAQRecommendations'
import { useSelectedInstitution, type Institution } from '@/hooks/useSelectedInstitution'
import { Button } from '@/components/ui/button'
import { ArrowLeft, MessageSquare, Bot, Quote } from 'lucide-react'

const popularQuestions = [
  'Pembentukan kartu keluarga baru',
  'Penerbitan kartu keluarga',
  'Prosedur penerbitan KTP-El baru',
  'Syarat pembuatan KTP-El baru',
  'Pengajuan pembuatan akta kelahiran',
]

export default function Layanan() {
  const { selectedInstitution, selectInstitution, clearSelection } = useSelectedInstitution()
  const [showFAQRecommendations, setShowFAQRecommendations] = useState(false)

  const handleBackToSelection = () => {
    setShowFAQRecommendations(false)
    clearSelection()
  }

  const handleShowFAQRecommendations = (institution: Institution) => {
    selectInstitution(institution)
    setShowFAQRecommendations(true)
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-6 text-center">
            {showFAQRecommendations && selectedInstitution ? (
              <div className="space-y-4">
                <Button onClick={handleBackToSelection} className="mb-4 bg-gray-600 text-white hover:bg-gray-700">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Kembali ke Pilihan Institusi
                </Button>
                <h1 className="text-4xl font-bold text-gray-900 lg:text-6xl">
                  FAQ Rekomendasi{' '}
                  <span
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
                    style={{ fontFamily: 'var(--font-covered-by-your-grace)' }}
                  >
                    {selectedInstitution.name}
                  </span>
                </h1>
                <p className="mx-auto max-w-3xl text-lg leading-relaxed text-gray-600">
                  Sistem AI kami telah menganalisis pertanyaan yang sering diajukan dan mengelompokkannya berdasarkan
                  topik untuk memudahkan Anda menemukan informasi yang diperlukan.
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-4xl leading-tight font-bold text-gray-900 lg:text-6xl">
                  Pertanyaan{' '}
                  <span
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent"
                    style={{ fontFamily: 'var(--font-covered-by-your-grace)' }}
                  >
                    populer
                  </span>{' '}
                  yang diajukan pengguna
                </h1>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {showFAQRecommendations && selectedInstitution ? (
            /* FAQ Recommendations View */
            <FAQRecommendations
              institutionId={selectedInstitution.institutionId}
              institutionName={selectedInstitution.name}
            />
          ) : (
            /* Institution Selection and Popular Questions View */
            <div className="space-y-16">
              {/* Top Section - Service Info and Popular Questions in 2 columns for laptop */}
              <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
                {/* Left Column - Service Info */}
                <div className="space-y-8">
                  <div>
                    <h2
                      className="mb-2 text-3xl font-bold text-green-600"
                      style={{ fontFamily: 'var(--font-covered-by-your-grace)' }}
                    >
                      Pembentukan
                    </h2>
                    <h3 className="mb-6 text-2xl font-bold text-gray-900">kartu keluarga baru</h3>
                    <p className="mb-6 leading-relaxed text-gray-700">
                      Apa yang dimaksud dengan Penerbitan Kartu Keluarga (KK) Baru Karena Membentuk Keluarga Baru?
                    </p>

                    <div className="relative rounded-3xl border border-blue-200/50 bg-gradient-to-br from-blue-50 via-blue-100/50 to-indigo-100/30 p-8 shadow-lg">
                      <div className="absolute -top-4 -left-4 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-lg">
                        <MessageSquare className="h-4 w-4 text-white" />
                      </div>
                      <div className="flex items-start space-x-4">
                        <div className="text-blue-500 opacity-30">
                          <Quote className="h-12 w-12" />
                        </div>
                        <div className="flex-1">
                          <p className="mb-6 text-lg leading-relaxed font-medium text-gray-800">
                            Layanan ini diberikan kepada warga yang baru membentuk keluarga dan perlu membuat Kartu
                            Keluarga (KK) baru. Persyaratannya termasuk fotokopi buku nikah atau kutipan akta perkawinan
                            serta KK lama, dan layanan dilakukan melalui aplikasi Jogja Smart Service (JSS).
                          </p>
                          <div className="flex items-center space-x-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-600">
                              <Bot className="h-5 w-5 text-white" />
                            </div>
                            <cite className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-base font-semibold text-transparent not-italic">
                              Tunarasa Bot
                            </cite>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column - Popular Questions */}
                <div className="space-y-4">
                  <div className="mb-6">
                    <h3 className="mb-3 text-2xl font-bold text-gray-900">Contoh Pertanyaan Populer</h3>
                    <p className="text-base leading-relaxed text-gray-600">
                      Berikut adalah contoh pertanyaan yang sering diajukan. Pilih institusi untuk melihat rekomendasi
                      yang lebih spesifik.
                    </p>
                  </div>

                  {popularQuestions.map((question, index) => (
                    <div
                      key={index}
                      className={`group cursor-pointer rounded-2xl p-5 transition-all duration-300 hover:scale-[1.02] ${
                        index === 0
                          ? 'bg-gradient-to-r from-gray-800 via-gray-700 to-gray-800 text-white shadow-xl hover:shadow-2xl'
                          : 'border-2 border-gray-200/60 bg-white/80 text-gray-700 hover:border-blue-200 hover:bg-white hover:shadow-lg'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-base leading-relaxed font-semibold ${
                            index === 0 ? 'text-white' : 'text-gray-800 group-hover:text-gray-900'
                          }`}
                        >
                          {question}
                        </span>
                        {index === 0 && (
                          <div className="flex items-center space-x-2">
                            <span className="text-lg text-yellow-400">★</span>
                            <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur">
                              Terpopuler
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Section - Institution Selector (Full Width, Single Grid) */}
              <div className="space-y-8">
                {/* Institution Selector */}
                <InstitutionSelector
                  onSelectInstitution={selectInstitution}
                  selectedInstitution={selectedInstitution}
                  showFAQButton={true}
                  onShowFAQRecommendations={handleShowFAQRecommendations}
                />
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
