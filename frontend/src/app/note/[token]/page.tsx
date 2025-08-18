'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, ArrowLeft, FileText, AlertCircle, CheckCircle, Calendar, Hash } from 'lucide-react'

interface NoteData {
  note_id: number
  conversation_id: number
  content: string
  created_at: string
  qr_generated_at: string
}

interface NoteResponse {
  note: NoteData
  access_token: string
  expires_at: string
}

export default function NotePage() {
  const params = useParams()
  const router = useRouter()
  const [noteData, setNoteData] = useState<NoteResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const token = params.token as string

  const fetchNote = useCallback(async () => {
    if (!token) {
      setError('Token tidak valid')
      setIsLoading(false)
      return
    }

    try {
      setIsLoading(true)
      console.log('🔍 Fetching note for token:', token)

      // Fetch note via frontend proxy
      const response = await fetch(`/api/backend/api/v1/summary/note/${token}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      })

      if (!response.ok) {
        if (response.status === 404) {
          setError('Catatan tidak ditemukan atau sudah kadaluarsa')
        } else if (response.status === 403) {
          setError('Akses ditolak untuk catatan ini')
        } else {
          const errorText = await response.text()
          console.error('❌ Note fetch error:', response.status, errorText)
          setError(`Gagal mengambil catatan: ${response.status}`)
        }
        return
      }

      const noteResponse: NoteResponse = await response.json()
      setNoteData(noteResponse)
      console.log('✅ Note fetched successfully:', noteResponse)
    } catch (error) {
      console.error('❌ Error fetching note:', error)
      setError(error instanceof Error ? error.message : 'Gagal mengambil catatan')
    } finally {
      setIsLoading(false)
    }
  }, [token])

  useEffect(() => {
    void fetchNote()
  }, [fetchNote])

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-4xl">
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-4 text-gray-600">Memuat catatan...</p>
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

  if (!noteData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="mx-auto max-w-4xl">
          <CardContent className="py-8">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Data catatan tidak tersedia</AlertDescription>
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
              Catatan Percakapan
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                Berhasil dimuat
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-600">
            Catatan dari percakapan Anda dengan sistem Tunarasa. Dokumen ini berisi informasi dari sesi komunikasi Anda.
          </p>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Note Metadata */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-700">
                <Hash className="h-4 w-4" />
                <span className="font-medium">ID Catatan</span>
              </div>
              <p className="mt-1 text-sm text-blue-600">{noteData.note.note_id}</p>
            </div>

            <div className="rounded-lg border bg-green-50 p-4">
              <div className="flex items-center gap-2 text-green-700">
                <Calendar className="h-4 w-4" />
                <span className="font-medium">Dibuat</span>
              </div>
              <p className="mt-1 text-sm text-green-600">
                {new Date(noteData.note.created_at).toLocaleDateString('id-ID', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>

          {/* Note Content */}
          <div className="rounded-lg border bg-gray-50 p-6">
            <h3 className="mb-4 font-medium text-gray-900">Isi Catatan:</h3>
            <div className="prose max-w-none">
              <pre className="font-sans leading-relaxed break-words whitespace-pre-wrap text-gray-700">
                {noteData.note.content}
              </pre>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
            <Button onClick={() => router.back()} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
          </div>

          {/* Footer Info */}
          <div className="rounded border-l-4 border-blue-500 bg-blue-50 p-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-blue-700">
                  <strong>Token Akses:</strong> {noteData.access_token}
                </p>
                <p className="mt-1 text-xs text-blue-600">
                  Akses kadaluarsa:{' '}
                  {new Date(noteData.expires_at).toLocaleDateString('id-ID', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
