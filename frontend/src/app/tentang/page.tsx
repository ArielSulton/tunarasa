import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'

const techDetails = [
  {
    category: 'Teknologi Frontend',
    items: [
      { name: 'Next.js 15', description: 'Framework React dengan App Router untuk pengembangan web modern' },
      { name: 'React 19', description: 'React terbaru dengan fitur concurrent yang ditingkatkan' },
      { name: 'TypeScript', description: 'JavaScript dengan tipe data untuk pengalaman pengembangan yang lebih baik' },
      { name: 'Tailwind CSS', description: 'Framework CSS utility-first untuk pengembangan UI yang cepat' },
    ],
  },
  {
    category: 'AI & Machine Learning',
    items: [
      { name: 'TensorFlow.js', description: 'Library machine learning untuk pengenalan gesture berbasis browser' },
      { name: 'MediaPipe', description: 'Framework Google untuk pelacakan tangan dan estimasi pose' },
      { name: 'LLaMA via Groq', description: 'Large language model untuk respons Q&A yang cerdas' },
      { name: 'LangChain', description: 'Framework untuk membangun aplikasi bertenaga LLM' },
    ],
  },
  {
    category: 'Infrastruktur Backend',
    items: [
      { name: 'FastAPI', description: 'Framework API Python berperforma tinggi dengan dukungan async' },
      { name: 'PostgreSQL', description: 'Database relasional yang robust untuk persistensi data' },
      { name: 'Pinecone', description: 'Vector database untuk pencarian semantik dan fungsionalitas RAG' },
      { name: 'Docker', description: 'Containerisasi untuk lingkungan deployment yang konsisten' },
    ],
  },
  {
    category: 'Fitur Aksesibilitas',
    items: [
      { name: 'Dukungan SIBI', description: 'Sistem Isyarat Bahasa Indonesia (Indonesian Sign Language)' },
      { name: 'Pengenalan Real-time', description: 'Pengenalan gesture sub-detik dengan akurasi tinggi' },
      { name: 'WCAG 2.1 AA', description: 'Kepatuhan terhadap Web Content Accessibility Guidelines' },
      { name: 'Dukungan Screen Reader', description: 'Kompatibilitas penuh dengan teknologi bantuan' },
    ],
  },
]

const statistics = [
  { label: 'Akurasi Pengenalan Gesture', value: '>85%', color: 'text-green-600' },
  { label: 'Rata-rata Waktu Respons', value: '<2s', color: 'text-blue-600' },
  { label: 'Huruf SIBI yang Didukung', value: '26', color: 'text-orange-600' },
]

export default function Tentang() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 to-blue-800 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="mb-6 text-4xl font-bold lg:text-5xl">Tentang Tunarasa</h1>
            <p className="mx-auto max-w-3xl text-xl text-blue-100">
              Platform komunikasi inklusif yang menggunakan teknologi AI terdepan untuk menciptakan aksesibilitas yang
              setara bagi penyandang tuna rungu dan tuna wicara.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
            <div>
              <h2 className="mb-6 text-3xl font-bold text-gray-900">Misi Kami</h2>
              <div className="space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
                    <span className="font-bold text-white">1</span>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold text-gray-900">Aksesibilitas Universal</h3>
                    <p className="text-gray-600">
                      Memastikan setiap individu memiliki akses yang sama terhadap layanan publik digital.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
                    <span className="font-bold text-white">2</span>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold text-gray-900">Teknologi Inklusif</h3>
                    <p className="text-gray-600">
                      Mengembangkan solusi teknologi yang mendukung komunikasi tanpa hambatan.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
                    <span className="font-bold text-white">3</span>
                  </div>
                  <div>
                    <h3 className="mb-2 font-semibold text-gray-900">Pemberdayaan Komunitas</h3>
                    <p className="text-gray-600">
                      Memberdayakan komunitas penyandang disabilitas melalui teknologi yang mudah digunakan.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <Image
                src="/assets/tech/header_tunarasa.png"
                alt="Tunarasa System"
                width={500}
                height={300}
                className="h-auto w-full rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">Performa Sistem</h2>
            <p className="text-lg text-gray-600">Statistik kinerja dan kemampuan platform Tunarasa</p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {statistics.map((stat, index) => (
              <Card key={index} className="text-center">
                <CardContent className="p-6">
                  <div className={`text-4xl font-bold ${stat.color} mb-2`}>{stat.value}</div>
                  <p className="text-gray-600">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Technology Stack Section */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">Teknologi yang Digunakan</h2>
            <p className="text-lg text-gray-600">Stack teknologi modern untuk performa dan reliabilitas terbaik</p>
          </div>

          <div className="space-y-12">
            {techDetails.map((category, categoryIndex) => (
              <div key={categoryIndex}>
                <h3 className="mb-6 text-center text-2xl font-semibold text-gray-900">{category.category}</h3>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {category.items.map((item, itemIndex) => (
                    <Card key={itemIndex} className="transition-shadow hover:shadow-lg">
                      <CardContent className="p-6">
                        <h4 className="mb-3 text-lg font-semibold text-gray-900">{item.name}</h4>
                        <p className="text-gray-600">{item.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="mb-4 text-3xl font-bold text-gray-900">Tim Pengembang</h2>
            <p className="text-lg text-gray-600">Dikembangkan oleh tim yang berdedikasi untuk aksesibilitas digital</p>
          </div>

          <Card className="text-center">
            <CardContent className="p-8">
              <h3 className="mb-4 text-2xl font-bold text-gray-900">Tunarasa Development Team</h3>
              <p className="mb-6 text-gray-600">
                Tim multidisiplin yang terdiri dari developers, designers, dan accessibility specialists yang
                berkomitmen untuk menciptakan teknologi inklusif.
              </p>
              <div className="flex justify-center space-x-8">
                <div>
                  <div className="text-2xl font-bold text-blue-600">2025</div>
                  <p className="text-sm text-gray-600">Tahun Peluncuran</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-600">AGPL-3.0</div>
                  <p className="text-sm text-gray-600">Lisensi</p>
                </div>
                <div>
                  <div className="text-2xl font-bold text-red-600">Indonesia</div>
                  <p className="text-sm text-gray-600">Dikembangkan di</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
