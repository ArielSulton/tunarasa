import Link from 'next/link'
import { Button } from '@/components/ui/button'

const popularQuestions = [
  'Pembentukan kartu keluarga baru',
  'Penerbitan kartu keluarga',
  'Prosedur penerbitan KTP-El baru',
  'Syarat pembuatan KTP-El baru',
  'Pengajuan pembuatan akta kelahiran',
]

export default function Layanan() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100">
      {/* Header */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-6 text-4xl font-bold text-gray-900 lg:text-5xl">
              Pertanyaan{' '}
              <span className="text-blue-600" style={{ fontFamily: 'cursive' }}>
                populer
              </span>{' '}
              yang di ajukan oleh pengguna
            </h1>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="pb-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
            {/* Left Column - Service Info */}
            <div className="space-y-8">
              <div>
                <h2 className="mb-2 text-3xl font-bold text-green-600" style={{ fontFamily: 'cursive' }}>
                  Pembentukan
                </h2>
                <h3 className="mb-6 text-2xl font-bold text-gray-900">kartu keluarga baru</h3>
                <p className="mb-6 leading-relaxed text-gray-700">
                  Apa yang dimaksud dengan Penerbitan Kartu Keluarga (KK) Baru Karena Membentuk Keluarga Baru?
                </p>

                <div className="mb-8 rounded-2xl border-l-4 border-blue-400 bg-blue-100 p-8">
                  <div className="flex items-start">
                    <div className="mr-4 text-4xl text-blue-500">❝</div>
                    <div>
                      <p className="mb-4 leading-relaxed text-gray-800 italic">
                        Layanan ini diberikan kepada warga yang baru membentuk keluarga dan perlu membuat Kartu Keluarga
                        (KK) baru. Persyaratannya termasuk fotokopi buku nikah atau kutipan akta perkawinan serta KK
                        lama, dan layanan dilakukan melalui aplikasi Jogja Smart Service (JSS).
                      </p>
                      <cite className="text-sm font-medium text-blue-600 italic">- Tunarasa Bot</cite>
                    </div>
                  </div>
                </div>

                <Link href="/komunikasi">
                  <Button className="rounded-full bg-green-500 px-8 py-4 text-lg font-medium text-white hover:bg-green-600">
                    Mulai komunikasi →
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right Column - Popular Questions */}
            <div className="space-y-3">
              {popularQuestions.map((question, index) => (
                <div
                  key={index}
                  className={`cursor-pointer rounded-xl p-4 transition-all duration-200 ${
                    index === 0
                      ? 'bg-gray-600 text-white shadow-lg'
                      : 'border border-gray-200 bg-white/70 text-gray-700 hover:bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{question}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
