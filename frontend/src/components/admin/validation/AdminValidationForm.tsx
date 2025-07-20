'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  Settings,
  Shield,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Zap,
  Clock,
  BarChart3,
  Brain,
  // MessageSquare,
} from 'lucide-react'

// Validation schema for admin settings
const adminValidationSchema = z.object({
  // System Security Settings
  maxLoginAttempts: z.number().min(1).max(10),
  sessionTimeout: z.number().min(5).max(720), // 5 minutes to 12 hours
  enableTwoFactor: z.boolean(),
  ipWhitelisting: z.boolean(),

  // LLM Quality Settings
  confidenceThreshold: z.number().min(0.1).max(1.0),
  responseTimeLimit: z.number().min(1).max(30), // seconds
  enableContentFiltering: z.boolean(),
  maxTokensPerRequest: z.number().min(100).max(4000),

  // Gesture Recognition Settings
  gestureAccuracyThreshold: z.number().min(0.5).max(1.0),
  enableGestureSmoothing: z.boolean(),
  debounceTime: z.number().min(100).max(2000),

  // Monitoring Settings
  enableRealTimeMonitoring: z.boolean(),
  alertThreshold: z.number().min(0.1).max(1.0),
  notificationEmail: z.string().email().optional(),

  // Content Moderation
  enableContentModeration: z.boolean(),
  blockedKeywords: z.string().optional(),
  autoModeration: z.boolean(),
})

type AdminValidationFormData = z.infer<typeof adminValidationSchema>

interface ValidationResult {
  category: string
  status: 'pass' | 'warning' | 'fail'
  message: string
  score: number
}

interface AdminValidationFormProps {
  initialData?: Partial<AdminValidationFormData>
  onSubmit: (data: AdminValidationFormData) => Promise<void>
}

export function AdminValidationForm({ initialData, onSubmit }: AdminValidationFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<AdminValidationFormData>({
    resolver: zodResolver(adminValidationSchema),
    defaultValues: {
      maxLoginAttempts: 5,
      sessionTimeout: 60,
      enableTwoFactor: true,
      ipWhitelisting: false,
      confidenceThreshold: 0.7,
      responseTimeLimit: 10,
      enableContentFiltering: true,
      maxTokensPerRequest: 1024,
      gestureAccuracyThreshold: 0.8,
      enableGestureSmoothing: true,
      debounceTime: 500,
      enableRealTimeMonitoring: true,
      alertThreshold: 0.9,
      enableContentModeration: true,
      autoModeration: false,
      ...initialData,
    },
  })

  const watchedValues = watch()

  // Real-time validation scoring
  const calculateValidationScore = (): number => {
    let score = 0
    let maxScore = 0

    // Security score (40%)
    maxScore += 40
    if (watchedValues.enableTwoFactor) score += 15
    if (watchedValues.maxLoginAttempts <= 5) score += 10
    if (watchedValues.sessionTimeout <= 120) score += 10
    if (watchedValues.ipWhitelisting) score += 5

    // Performance score (30%)
    maxScore += 30
    if (watchedValues.responseTimeLimit <= 5) score += 15
    if (watchedValues.confidenceThreshold >= 0.7) score += 10
    if (watchedValues.maxTokensPerRequest <= 2000) score += 5

    // Quality score (30%)
    maxScore += 30
    if (watchedValues.gestureAccuracyThreshold >= 0.8) score += 10
    if (watchedValues.enableContentFiltering) score += 10
    if (watchedValues.enableRealTimeMonitoring) score += 10

    return Math.round((score / maxScore) * 100)
  }

  // Perform comprehensive validation
  const performValidation = async (): Promise<ValidationResult[]> => {
    const results: ValidationResult[] = []

    // Security validation
    const securityScore =
      (watchedValues.enableTwoFactor ? 25 : 0) +
      (watchedValues.maxLoginAttempts <= 5 ? 25 : 0) +
      (watchedValues.sessionTimeout <= 120 ? 25 : 0) +
      (watchedValues.ipWhitelisting ? 25 : 0)

    results.push({
      category: 'Security',
      status: securityScore >= 75 ? 'pass' : securityScore >= 50 ? 'warning' : 'fail',
      message: `Security score: ${securityScore}%. ${
        securityScore >= 75
          ? 'Excellent security configuration.'
          : securityScore >= 50
            ? 'Good security, consider enabling 2FA and IP whitelisting.'
            : 'Security needs improvement. Enable 2FA and reduce session timeout.'
      }`,
      score: securityScore,
    })

    // Performance validation
    const performanceScore =
      (watchedValues.responseTimeLimit <= 5 ? 40 : watchedValues.responseTimeLimit <= 10 ? 20 : 0) +
      (watchedValues.confidenceThreshold >= 0.7 ? 30 : 0) +
      (watchedValues.maxTokensPerRequest <= 2000 ? 30 : 0)

    results.push({
      category: 'Performance',
      status: performanceScore >= 80 ? 'pass' : performanceScore >= 60 ? 'warning' : 'fail',
      message: `Performance score: ${performanceScore}%. ${
        performanceScore >= 80
          ? 'Optimal performance settings.'
          : performanceScore >= 60
            ? 'Good performance, consider reducing response time limit.'
            : 'Performance needs optimization. Reduce token limits and improve thresholds.'
      }`,
      score: performanceScore,
    })

    // Quality validation
    const qualityScore =
      (watchedValues.gestureAccuracyThreshold >= 0.8 ? 30 : 0) +
      (watchedValues.enableContentFiltering ? 35 : 0) +
      (watchedValues.enableRealTimeMonitoring ? 35 : 0)

    results.push({
      category: 'Quality',
      status: qualityScore >= 80 ? 'pass' : qualityScore >= 60 ? 'warning' : 'fail',
      message: `Quality score: ${qualityScore}%. ${
        qualityScore >= 80
          ? 'Excellent quality controls.'
          : qualityScore >= 60
            ? 'Good quality settings, enable content filtering for better results.'
            : 'Quality controls need improvement. Enable monitoring and filtering.'
      }`,
      score: qualityScore,
    })

    return results
  }

  const onFormSubmit = async (data: AdminValidationFormData) => {
    setIsSubmitting(true)
    try {
      const validation = await performValidation()
      setValidationResults(validation)

      // Check if any critical validations failed
      const criticalFailures = validation.filter((v) => v.status === 'fail')
      if (criticalFailures.length > 0) {
        throw new Error(`Critical validation failures: ${criticalFailures.map((v) => v.category).join(', ')}`)
      }

      await onSubmit(data)
    } catch (error) {
      console.error('Validation failed:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const overallScore = calculateValidationScore()
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {/* Validation Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Admin Validation Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="text-center">
              <div className={`text-3xl font-bold ${getScoreColor(overallScore)}`}>{overallScore}%</div>
              <div className="text-sm text-gray-600">Overall Score</div>
              <Progress value={overallScore} className="mt-2" />
            </div>

            {validationResults.map((result) => (
              <div key={result.category} className="text-center">
                <div className="mb-1 flex items-center justify-center gap-2">
                  {getStatusIcon(result.status)}
                  <span className="font-medium">{result.category}</span>
                </div>
                <div className={`text-xl font-bold ${getScoreColor(result.score)}`}>{result.score}%</div>
                <div className="mt-1 text-xs text-gray-600">{result.message.split('.')[0]}</div>
              </div>
            ))}
          </div>

          {validationResults.length > 0 && (
            <div className="mt-4 space-y-2">
              {validationResults.map((result) => (
                <Alert
                  key={result.category}
                  className={
                    result.status === 'pass'
                      ? 'border-green-200 bg-green-50'
                      : result.status === 'warning'
                        ? 'border-yellow-200 bg-yellow-50'
                        : 'border-red-200 bg-red-50'
                  }
                >
                  {getStatusIcon(result.status)}
                  <AlertDescription>
                    <strong>{result.category}:</strong> {result.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Security Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxLoginAttempts">Max Login Attempts</Label>
                <Input id="maxLoginAttempts" type="number" {...register('maxLoginAttempts', { valueAsNumber: true })} />
                {errors.maxLoginAttempts && <p className="text-sm text-red-600">{errors.maxLoginAttempts.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="sessionTimeout">Session Timeout (minutes)</Label>
                <Input id="sessionTimeout" type="number" {...register('sessionTimeout', { valueAsNumber: true })} />
                {errors.sessionTimeout && <p className="text-sm text-red-600">{errors.sessionTimeout.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="enableTwoFactor">Enable Two-Factor Authentication</Label>
                <Switch
                  id="enableTwoFactor"
                  checked={watchedValues.enableTwoFactor}
                  onCheckedChange={(checked) => setValue('enableTwoFactor', checked)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="ipWhitelisting">IP Whitelisting</Label>
                <Switch
                  id="ipWhitelisting"
                  checked={watchedValues.ipWhitelisting}
                  onCheckedChange={(checked) => setValue('ipWhitelisting', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LLM Quality Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" />
              LLM Quality Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="confidenceThreshold">Confidence Threshold</Label>
                <Input
                  id="confidenceThreshold"
                  type="number"
                  step="0.1"
                  min="0.1"
                  max="1.0"
                  {...register('confidenceThreshold', { valueAsNumber: true })}
                />
                {errors.confidenceThreshold && (
                  <p className="text-sm text-red-600">{errors.confidenceThreshold.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="responseTimeLimit">Response Time Limit (seconds)</Label>
                <Input
                  id="responseTimeLimit"
                  type="number"
                  {...register('responseTimeLimit', { valueAsNumber: true })}
                />
                {errors.responseTimeLimit && <p className="text-sm text-red-600">{errors.responseTimeLimit.message}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxTokensPerRequest">Max Tokens per Request</Label>
                <Input
                  id="maxTokensPerRequest"
                  type="number"
                  {...register('maxTokensPerRequest', { valueAsNumber: true })}
                />
                {errors.maxTokensPerRequest && (
                  <p className="text-sm text-red-600">{errors.maxTokensPerRequest.message}</p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enableContentFiltering">Enable Content Filtering</Label>
                <Switch
                  id="enableContentFiltering"
                  checked={watchedValues.enableContentFiltering}
                  onCheckedChange={(checked) => setValue('enableContentFiltering', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Gesture Recognition Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Gesture Recognition Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="gestureAccuracyThreshold">Accuracy Threshold</Label>
                <Input
                  id="gestureAccuracyThreshold"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="1.0"
                  {...register('gestureAccuracyThreshold', { valueAsNumber: true })}
                />
                {errors.gestureAccuracyThreshold && (
                  <p className="text-sm text-red-600">{errors.gestureAccuracyThreshold.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="debounceTime">Debounce Time (ms)</Label>
                <Input id="debounceTime" type="number" {...register('debounceTime', { valueAsNumber: true })} />
                {errors.debounceTime && <p className="text-sm text-red-600">{errors.debounceTime.message}</p>}
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enableGestureSmoothing">Enable Gesture Smoothing</Label>
                <Switch
                  id="enableGestureSmoothing"
                  checked={watchedValues.enableGestureSmoothing}
                  onCheckedChange={(checked) => setValue('enableGestureSmoothing', checked)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Advanced Settings */}
        <Card>
          <CardHeader>
            <CardTitle
              className="flex cursor-pointer items-center gap-2"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <Settings className="h-5 w-5" />
              Advanced Settings
              <Badge variant="outline" className="ml-auto">
                {showAdvanced ? 'Hide' : 'Show'}
              </Badge>
            </CardTitle>
          </CardHeader>
          {showAdvanced && (
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="alertThreshold">Alert Threshold</Label>
                  <Input
                    id="alertThreshold"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="1.0"
                    {...register('alertThreshold', { valueAsNumber: true })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notificationEmail">Notification Email</Label>
                  <Input id="notificationEmail" type="email" {...register('notificationEmail')} />
                  {errors.notificationEmail && (
                    <p className="text-sm text-red-600">{errors.notificationEmail.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="blockedKeywords">Blocked Keywords (comma separated)</Label>
                <Textarea
                  id="blockedKeywords"
                  placeholder="Enter blocked keywords separated by commas..."
                  {...register('blockedKeywords')}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="enableRealTimeMonitoring">Real-time Monitoring</Label>
                  <Switch
                    id="enableRealTimeMonitoring"
                    checked={watchedValues.enableRealTimeMonitoring}
                    onCheckedChange={(checked) => setValue('enableRealTimeMonitoring', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="enableContentModeration">Content Moderation</Label>
                  <Switch
                    id="enableContentModeration"
                    checked={watchedValues.enableContentModeration}
                    onCheckedChange={(checked) => setValue('enableContentModeration', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="autoModeration">Auto Moderation</Label>
                  <Switch
                    id="autoModeration"
                    checked={watchedValues.autoModeration}
                    onCheckedChange={(checked) => setValue('autoModeration', checked)}
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Action Buttons */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => performValidation().then(setValidationResults)}>
            <BarChart3 className="mr-2 h-4 w-4" />
            Validate Settings
          </Button>

          <Button type="submit" disabled={isSubmitting || !isDirty} className="min-w-32">
            {isSubmitting ? (
              <>
                <Clock className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
