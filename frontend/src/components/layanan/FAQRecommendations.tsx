'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  RefreshCw,
  HelpCircle,
  TrendingUp,
  BarChart3,
  AlertCircle,
  CheckCircle2,
  Database,
  Sparkles,
} from 'lucide-react'

interface FAQRecommendation {
  cluster_id: number
  cluster_name: string
  questions: string[]
  representative_question: string
  question_count: number
}

interface FAQRecommendationResponse {
  success: boolean
  institution_id: number
  data_source: 'database' | 'fallback'
  total_questions: number
  cluster_count: number
  avg_questions_per_cluster: number
  silhouette_score: number
  processing_time_seconds: number
  recommendations: FAQRecommendation[]
  generated_at: number
}

interface FAQRecommendationsProps {
  institutionId: number
  institutionName: string
}

export function FAQRecommendations({ institutionId, institutionName }: FAQRecommendationsProps) {
  const [data, setData] = useState<FAQRecommendationResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRecommendations = useCallback(
    async (forceRefresh = false) => {
      try {
        // Direct backend URL
        const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:8000'
        const endpoint = `${backendUrl}/api/v1/faq/recommendations/${institutionId}${forceRefresh ? '?force_refresh=true' : ''}`

        const response = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`Failed to fetch FAQ recommendations: ${response.status}`)
        }

        const result = await response.json()

        if (result.success) {
          setData(result)
          setError(null)
        } else {
          throw new Error(result.error ?? 'Failed to get recommendations')
        }
      } catch (err) {
        console.error('Error fetching FAQ recommendations:', err)
        setError(err instanceof Error ? err.message : 'Failed to load FAQ recommendations')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [institutionId],
  )

  useEffect(() => {
    void fetchRecommendations()
  }, [fetchRecommendations])

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchRecommendations(true)
  }

  const getDataSourceIcon = (dataSource: 'database' | 'fallback') => {
    return dataSource === 'database' ? (
      <Database className="h-4 w-4 text-green-600" />
    ) : (
      <Sparkles className="h-4 w-4 text-blue-600" />
    )
  }

  const getDataSourceText = (dataSource: 'database' | 'fallback') => {
    return dataSource === 'database' ? 'Dari Database Pengguna' : 'Rekomendasi Cerdas'
  }

  const getQualityBadgeColor = (score: number) => {
    if (score >= 0.7) return 'bg-green-100 text-green-800'
    if (score >= 0.5) return 'bg-yellow-100 text-yellow-800'
    return 'bg-red-100 text-red-800'
  }

  const getQualityText = (score: number) => {
    if (score >= 0.7) return 'Kualitas Tinggi'
    if (score >= 0.5) return 'Kualitas Sedang'
    return 'Kualitas Perlu Ditingkatkan'
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-gray-900">FAQ Rekomendasi</h3>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
        <div className="grid gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 w-3/4 rounded bg-gray-300" />
                <div className="h-3 w-full rounded bg-gray-300" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 w-full rounded bg-gray-300" />
                  <div className="h-3 w-5/6 rounded bg-gray-300" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <Alert className="border-red-200 bg-red-50">
        <AlertCircle className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          <div className="flex items-center justify-between">
            <span>{error}</span>
            <Button
              onClick={() => {
                void fetchRecommendations()
              }}
              size="sm"
              variant="outline"
            >
              Coba Lagi
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || data.recommendations.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
        <HelpCircle className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-4 text-lg font-medium text-gray-900">Belum Ada Rekomendasi FAQ</h3>
        <p className="mt-2 text-gray-600">
          Belum ada data yang cukup untuk memberikan rekomendasi FAQ untuk {institutionName}. Sistem akan menggunakan
          data fallback yang relevan.
        </p>
        <Button
          onClick={() => {
            void handleRefresh()
          }}
          className="mt-4"
          disabled={refreshing}
        >
          {refreshing && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
          Coba Refresh
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">FAQ Rekomendasi</h3>
          <p className="text-gray-600">Pertanyaan yang sering diajukan untuk {institutionName}</p>
        </div>
        <Button
          onClick={() => {
            void handleRefresh()
          }}
          variant="outline"
          size="sm"
          disabled={refreshing}
        >
          {refreshing ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pertanyaan</p>
                <p className="text-2xl font-bold text-gray-900">{data.total_questions}</p>
              </div>
              <HelpCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Kategori</p>
                <p className="text-2xl font-bold text-gray-900">{data.cluster_count}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Rata-rata per Kategori</p>
                <p className="text-2xl font-bold text-gray-900">{data.avg_questions_per_cluster.toFixed(1)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-orange-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Kualitas Clustering</p>
                <p className="text-xl font-bold text-gray-900">{(data.silhouette_score * 100).toFixed(1)}%</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Source and Quality Info */}
      <div className="flex flex-wrap gap-3">
        <Badge variant="secondary" className="flex items-center gap-1">
          {getDataSourceIcon(data.data_source)}
          {getDataSourceText(data.data_source)}
        </Badge>

        <Badge className={`${getQualityBadgeColor(data.silhouette_score)} border-0`}>
          {getQualityText(data.silhouette_score)}
        </Badge>

        <Badge variant="outline">Diproses dalam {(data.processing_time_seconds * 1000).toFixed(0)}ms</Badge>
      </div>

      {/* FAQ Recommendations Grid */}
      <div className="grid gap-6">
        {data.recommendations.map((recommendation, index) => (
          <Card
            key={recommendation.cluster_id}
            className={`transition-all duration-200 hover:shadow-md ${
              index === 0 ? 'bg-blue-50/30 ring-2 ring-blue-500/20' : ''
            }`}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {recommendation.cluster_name}
                    {index === 0 && <Badge className="bg-blue-600 text-xs text-white">Paling Populer</Badge>}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {recommendation.question_count} pertanyaan dalam kategori ini
                  </CardDescription>
                </div>
                <Badge variant="outline" className="ml-2">
                  #{recommendation.cluster_id}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Representative Question */}
              <div className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 font-medium text-gray-900">📌 Pertanyaan Representatif:</p>
                <p className="text-gray-700 italic">&ldquo;{recommendation.representative_question}&rdquo;</p>
              </div>

              {/* Sample Questions */}
              <div>
                <p className="mb-3 font-medium text-gray-900">Contoh pertanyaan dalam kategori ini:</p>
                <div className="space-y-2">
                  {(recommendation.questions || []).slice(0, 3).map((question, qIndex) => (
                    <div
                      key={qIndex}
                      className="flex cursor-pointer items-start gap-2 rounded-md border bg-white p-2 transition-colors hover:bg-gray-50"
                    >
                      <span className="mt-1 text-sm text-gray-400">{qIndex + 1}.</span>
                      <span className="text-sm leading-relaxed text-gray-700">{question}</span>
                    </div>
                  ))}

                  {(recommendation.questions || []).length > 3 && (
                    <div className="pt-2 text-center">
                      <Badge variant="secondary" className="text-xs">
                        +{recommendation.questions.length - 3} pertanyaan lainnya
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Footer Info */}
      <div className="border-t pt-4 text-center text-sm text-gray-500">
        <p>
          Rekomendasi diperbarui pada {new Date(data.generated_at * 1000).toLocaleString('id-ID')} • Sistem clustering
          menggunakan AI untuk mengelompokkan pertanyaan serupa
        </p>
      </div>
    </div>
  )
}
