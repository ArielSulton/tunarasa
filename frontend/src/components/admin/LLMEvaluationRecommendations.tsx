/**
 * LLM Evaluation Recommendations Component
 * Displays AI quality metrics and improvement suggestions from DeepEval
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Brain,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Clock,
  Target,
  BarChart3,
  RefreshCw,
  Download,
  Eye,
} from 'lucide-react'
import { adminApiClient, LLMEvaluationSummary, LLMQualityReport } from '@/lib/api/admin-client'

export function LLMEvaluationRecommendations() {
  const [summary, setSummary] = useState<LLMEvaluationSummary | null>(null)
  const [report, setReport] = useState<LLMQualityReport | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [timePeriod, setTimePeriod] = useState('24h')

  useEffect(() => {
    void fetchEvaluationData()
  }, [timePeriod])

  const fetchEvaluationData = async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch evaluation summary and quality report
      const [summaryResponse, reportResponse] = await Promise.all([
        adminApiClient.getLLMEvaluationSummary('30d'),
        adminApiClient.getLLMQualityReport({ period: '30d' }),
      ])

      if (summaryResponse.success && summaryResponse.data) {
        setSummary(summaryResponse.data)
      } else {
        console.error('Failed to fetch evaluation summary:', summaryResponse.error)
      }

      if (reportResponse.success && reportResponse.data) {
        setReport(reportResponse.data)
      } else {
        console.error('Failed to fetch quality report:', reportResponse.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load evaluation data')
    } finally {
      setIsLoading(false)
    }
  }

  const getQualityColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'excellent':
        return 'bg-green-500'
      case 'good':
        return 'bg-blue-500'
      case 'acceptable':
        return 'bg-yellow-500'
      default:
        return 'bg-red-500'
    }
  }

  const getQualityIcon = (level: string) => {
    switch (level.toLowerCase()) {
      case 'excellent':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'good':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'acceptable':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      default:
        return <XCircle className="h-4 w-4 text-red-600" />
    }
  }

  const formatCategoryName = (category: string) => {
    return category
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="text-primary h-6 w-6" />
          <h2 className="text-2xl font-bold">LLM Evaluation & Recommendations</h2>
        </div>

        <div className="flex items-center gap-2">
          <Select value={timePeriod} onValueChange={setTimePeriod}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={() => void fetchEvaluationData} disabled={isLoading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      {report && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Overall Quality</p>
                  <p className="text-2xl font-bold">{(report.overall_quality_score * 100).toFixed(1)}%</p>
                </div>
                <Target className="text-primary h-8 w-8" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Pass Rate</p>
                  <p className="text-2xl font-bold">{(report.overall_pass_rate * 100).toFixed(1)}%</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground text-sm font-medium">Categories</p>
                  <p className="text-2xl font-bold">{report.total_categories_evaluated}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="metrics" className="space-y-4">
        <TabsList>
          <TabsTrigger value="metrics">Quality Metrics</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="trends">Trends</TabsTrigger>
        </TabsList>

        {/* Quality Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          {report && (
            <div className="grid gap-4">
              {Object.entries(report.category_quality_scores).map(([category, scores]) => (
                <Card key={category}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{formatCategoryName(category)}</CardTitle>
                      <div className="flex items-center gap-2">
                        {getQualityIcon(scores.quality_level)}
                        <Badge variant="outline" className={getQualityColor(scores.quality_level)}>
                          {scores.quality_level}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Score Progress */}
                      <div>
                        <div className="mb-2 flex justify-between text-sm">
                          <span>Average Score</span>
                          <span>{(scores.average_score * 100).toFixed(1)}%</span>
                        </div>
                        <Progress value={scores.average_score * 100} className="h-2" />
                      </div>

                      {/* Statistics */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Pass Rate:</span>
                          <span className="ml-2 font-medium">{(scores.pass_rate * 100).toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Evaluations:</span>
                          <span className="ml-2 font-medium">{scores.total_evaluations}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Recommendations Tab */}
        <TabsContent value="recommendations" className="space-y-4">
          {report && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Improvement Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.recommendations.length > 0 ? (
                  <div className="space-y-3">
                    {report.recommendations.map((recommendation, index) => (
                      <Alert key={index}>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>{recommendation.description}</AlertDescription>
                      </Alert>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground py-8 text-center">
                    <CheckCircle className="mx-auto mb-4 h-12 w-12 text-green-500" />
                    <p>No immediate improvements needed!</p>
                    <p className="text-sm">All metrics are performing within acceptable ranges.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Trends Tab */}
        <TabsContent value="trends" className="space-y-4">
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Evaluation Summary - {summary.period_hours}h
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div>
                    <h4 className="mb-3 font-medium">Period Statistics</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total Evaluations:</span>
                        <span className="font-medium">{summary.total_qa_analyzed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Average Score:</span>
                        <span className="font-medium">{(summary.overall_quality_score * 100).toFixed(1)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pass Rate:</span>
                        <span className="font-medium">
                          {summary.key_metrics?.avg_confidence
                            ? (summary.key_metrics.avg_confidence * 100).toFixed(1)
                            : 'N/A'}
                          %
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 font-medium">Category Performance</h4>
                    <div className="space-y-2">
                      {summary.recommendations?.map((recommendation, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{recommendation.title}:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{(recommendation.confidence * 100).toFixed(0)}%</span>
                            <div
                              className={`h-2 w-2 rounded-full ${
                                recommendation.confidence >= 0.7
                                  ? 'bg-green-500'
                                  : recommendation.confidence >= 0.5
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                              }`}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          <Download className="mr-1 h-4 w-4" />
          Export Report
        </Button>
        <Button variant="outline" size="sm">
          <Eye className="mr-1 h-4 w-4" />
          View Detailed Logs
        </Button>
      </div>
    </div>
  )
}
