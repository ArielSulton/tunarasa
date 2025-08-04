'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Bot, Users, Settings, RefreshCw, CheckCircle, AlertTriangle, Info, Loader2 } from 'lucide-react'
import { useServiceConfig } from '@/lib/hooks/use-service-config'
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
        text: `Service mode changed to ${newMode === 'full_llm_bot' ? 'Full LLM Bot' : 'Human CS Support'} successfully!`,
      })
    } else {
      setMessage({
        type: 'error',
        text: 'Failed to update service mode. Please try again.',
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
      text: 'Configuration refreshed from server',
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
              Service Mode Configuration
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void handleRefresh()}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
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
              <AlertDescription className="text-red-800">Error loading configuration: {error}</AlertDescription>
            </Alert>
          )}

          {/* Current Status */}
          <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">Current Service Mode</h4>
                <p className="mt-1 text-sm text-gray-600">{description}</p>
              </div>
              <Badge
                className={serviceMode === 'full_llm_bot' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'}
              >
                {serviceMode === 'full_llm_bot' ? 'LLM Bot' : 'Human CS'}
              </Badge>
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Select Service Mode</h4>

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
                      <h5 className="font-medium text-gray-900">Full LLM Bot</h5>
                      <p className="mt-1 text-sm text-gray-600">Users receive direct AI responses via RAG system</p>
                      {serviceMode === 'full_llm_bot' && (
                        <Badge className="mt-2 bg-blue-100 text-blue-800">Active</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Human CS Support Mode */}
              <Card
                className={`cursor-pointer transition-all ${
                  serviceMode === 'human_cs_support'
                    ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                    : 'border-gray-200 hover:border-green-300'
                }`}
                onClick={() => !updating && void handleModeChange('human_cs_support')}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100">
                      <Users className="h-5 w-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h5 className="font-medium text-gray-900">Human CS Support</h5>
                      <p className="mt-1 text-sm text-gray-600">Users are routed to admin queue for human assistance</p>
                      {serviceMode === 'human_cs_support' && (
                        <Badge className="mt-2 bg-green-100 text-green-800">Active</Badge>
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
                <span className="text-sm">Updating service mode...</span>
              </div>
            )}
          </div>

          {/* Mode Descriptions */}
          <div className="mt-6 space-y-3 border-t pt-6 text-sm text-gray-600">
            <div className="flex gap-3">
              <Bot className="mt-0.5 h-4 w-4 text-blue-600" />
              <div>
                <span className="font-medium">Full LLM Bot:</span> All user questions are processed directly by the AI
                system using RAG (Retrieval-Augmented Generation). Faster responses, 24/7 availability.
              </div>
            </div>
            <div className="flex gap-3">
              <Users className="mt-0.5 h-4 w-4 text-green-600" />
              <div>
                <span className="font-medium">Human CS Support:</span> User questions are routed to admin queue for
                human review and response. Admins receive LLM suggestions to assist with replies.
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
