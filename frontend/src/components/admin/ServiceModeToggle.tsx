'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bot, Users, Settings, RefreshCw, CheckCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { useServiceConfig } from '@/hooks/use-service-config'
import type { ServiceMode } from '@/lib/db/schema'

interface ServiceModeToggleProps {
  className?: string
}

export function ServiceModeToggle({ className }: ServiceModeToggleProps) {
  const { serviceMode, description, loading, error, updateServiceMode, refreshConfig } = useServiceConfig()
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null)

  const handleModeChange = async (newMode: ServiceMode) => {
    if (newMode === serviceMode) return

    setUpdating(true)
    setMessage(null)

    const success = await updateServiceMode(newMode)

    if (success) {
      setMessage({
        type: 'success',
        text: `Mode layanan berhasil diubah ke ${newMode === 'full_llm_bot' ? 'Bot LLM Penuh' : 'Bot + Validasi Admin'}!`,
      })
    } else {
      setMessage({
        type: 'error',
        text: 'Gagal mengupdate mode layanan. Silakan coba lagi.',
      })
    }

    setUpdating(false)

    // Clear message after 5 seconds
    setTimeout(() => setMessage(null), 5000)
  }

  const handleRefresh = async () => {
    await refreshConfig()
    setMessage({
      type: 'info',
      text: 'Konfigurasi direfresh dari server',
    })
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div className={className}>
      <Card className="border-2 border-blue-200">
        <CardHeader className="bg-blue-50">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Settings className="h-5 w-5" />
              Konfigurasi Mode Layanan
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Segarkan
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Status Messages */}
          {message && (
            <Alert
              className={`mb-6 ${
                message.type === 'success'
                  ? 'border-green-200 bg-green-50'
                  : message.type === 'error'
                    ? 'border-red-200 bg-red-50'
                    : 'border-blue-200 bg-blue-50'
              }`}
            >
              {message.type === 'success' && <CheckCircle className="h-4 w-4 text-green-600" />}
              {message.type === 'error' && <AlertTriangle className="h-4 w-4 text-red-600" />}
              {message.type === 'info' && <Info className="h-4 w-4 text-blue-600" />}
              <AlertDescription
                className={
                  message.type === 'success'
                    ? 'text-green-800'
                    : message.type === 'error'
                      ? 'text-red-800'
                      : 'text-blue-800'
                }
              >
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">Error memuat konfigurasi: {error}</AlertDescription>
            </Alert>
          )}

          {/* Current Status */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Mode Layanan Saat Ini</h4>
                <p className="mt-1 text-sm text-gray-600">{description}</p>
              </div>
              <Badge
                className={serviceMode === 'full_llm_bot' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
              >
                {serviceMode === 'full_llm_bot' ? 'LLM Bot' : 'Admin Validation'}
              </Badge>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Pilih Mode Layanan</h4>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Full LLM Bot Mode */}
              <Card
                className={`cursor-pointer transition-all ${
                  serviceMode === 'full_llm_bot'
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-blue-300'
                }`}
                onClick={() => !updating && void handleModeChange('full_llm_bot')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100">
                      <Bot className="h-5 w-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">Bot LLM Penuh</h5>
                      <p className="mt-1 text-sm text-gray-600">
                        Pengguna menerima respons AI langsung melalui sistem RAG
                      </p>
                      {serviceMode === 'full_llm_bot' && (
                        <Badge className="mt-2 bg-blue-100 text-blue-800">Aktif</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Bot + Admin Validation Mode */}
              <Card
                className={`cursor-pointer transition-all ${
                  serviceMode === 'bot_with_admin_validation'
                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                    : 'border-gray-200 hover:border-green-300'
                }`}
                onClick={() => !updating && void handleModeChange('bot_with_admin_validation')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">Bot + Validasi Admin</h5>
                      <p className="mt-1 text-sm text-gray-600">
                        AI menghasilkan respons tetapi admin harus menyetujui sebelum dikirim ke pengguna
                      </p>
                      {serviceMode === 'bot_with_admin_validation' && (
                        <Badge className="mt-2 bg-green-100 text-green-800">Aktif</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 flex justify-center">
            {updating && (
              <div className="flex items-center gap-2 text-blue-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Mengupdate mode layanan...</span>
              </div>
            )}
          </div>

          {/* Mode Descriptions */}
          <div className="mt-6 space-y-3 border-t pt-6 text-sm text-gray-600">
            <div className="flex gap-3">
              <Bot className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <span className="font-medium">Bot LLM Penuh:</span> Semua pertanyaan pengguna diproses langsung oleh
                sistem AI menggunakan RAG (Retrieval-Augmented Generation). Respons lebih cepat, tersedia 24/7.
              </div>
            </div>
            <div className="flex gap-3">
              <Users className="mt-0.5 h-4 w-4 text-green-600" />
              <div>
                <span className="font-medium">Bot + Validasi Admin:</span> AI secara otomatis menghasilkan respons
                tetapi admin harus memvalidasi dan menyetujuinya sebelum dikirim ke pengguna.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
