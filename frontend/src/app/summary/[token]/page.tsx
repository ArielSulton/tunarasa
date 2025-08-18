'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Download, ArrowLeft, FileText, AlertCircle, CheckCircle } from 'lucide-react'

export default function SummaryPage() {
  const params = useParams()
  const router = useRouter()
  const [summary, setSummary] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const token = params.token as string

  const fetchSummary = useCallback(async () => {
    if (!token) {
      setError('Token tidak valid')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      console.log('🔍 Fetching summary for token:', token)

      // Fetch summary via frontend proxy
      const response = await fetch(`/api/backend/api/v1/summary/${token}?format=text`, {
        method: 'GET',
        headers: {
          Accept: 'text/plain',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Ringkasan tidak ditemukan atau sudah kadaluarsa')
        } else if (response.status === 403) {
          setError('Akses ditolak untuk ringkasan ini')
        } else {
          const errorText = await response.text()
          console.error('❌ Summary fetch error:', response.status, errorText)
          setError(`Gagal mengambil ringkasan: ${response.status}`)
        }
        return
      }

      const summaryText = await response.text()
      setSummary(summaryText)
      console.log('✅ Summary fetched successfully, length:', summaryText.length)
    } catch (error) {
      console.error('❌ Error fetching summary:', error)
      setError(error instanceof Error ? error.message : 'Gagal mengambil ringkasan')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  const downloadPDF = useCallback(async () => {
    if (!token) return

    try {
      console.log('📥 Downloading PDF for token:', token)

      const response = await fetch(`/api/backend/api/v1/summary/${token}?format=pdf`, {
        method: 'GET',
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ringkasan-percakapan-${token.substring(0, 8)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      console.log('✅ PDF download initiated')
    } catch (error) {
      console.error('❌ Error downloading PDF:', error)
      setError('Gagal mengunduh PDF')
    }
  }, [token])

  useEffect(() => {
    void fetchSummary()
  }, [fetchSummary])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-4xl">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-4 text-gray-600">Memuat ringkasan percakapan...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-4xl">
          <CardContent className="py-8">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="mt-6 text-center">
              <Button onClick={() => router.back()} variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Kembali
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card className="mx-auto max-w-4xl">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Ringkasan Percakapan
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Berhasil dimuat
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Ringkasan percakapan Anda dengan sistem Tunarasa. Dokumen ini berisi informasi penting dari sesi komunikasi
            Anda.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Summary Content */}
          <div className="rounded-lg border bg-gray-50 p-6">
            <h3 className="mb-4 font-medium text-gray-900">Isi Ringkasan:</h3>
            <div className="prose max-w-none">
              <pre className="font-sans leading-relaxed break-words whitespace-pre-wrap text-gray-700">{summary}</pre>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>

            <div className="flex gap-2">
              <Button onClick={() => void downloadPDF()} className="bg-blue-600 text-white hover:bg-blue-700">
                <Download className="mr-2 h-4 w-4" />
                Unduh PDF
              </Button>
            </div>
          </div>

          {/* Footer Info */}
          <div className="rounded border-l-4 border-blue-500 bg-blue-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Token:</strong> {token}
                </p>
                <p className="mt-1 text-xs text-blue-600">
                  Simpan token ini untuk mengakses ringkasan di masa depan. Token akan kadaluarsa sesuai kebijakan
                  sistem.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
