/**
 * Q&A Logs Viewer Component
 * Displays conversation logs with Grafana integration links
 */

'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  MessageCircle,
  Search,
  Filter,
  ExternalLink,
  Eye,
  BarChart3,
  Calendar,
  Clock,
  User,
  Activity,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react'
import { adminApiClient, ConversationItem, ConversationDetails } from '@/lib/api/admin-client'
import { LLMEvaluationRecommendations } from './LLMEvaluationRecommendations'

interface QALogsViewerProps {
  grafanaBaseUrl?: string
}

export function QALogsViewer({ grafanaBaseUrl = 'http://localhost:3000' }: QALogsViewerProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [selectedConversation, setSelectedConversation] = useState<ConversationDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Pagination and filtering
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [dateRange, setDateRange] = useState('7d')

  // Stats
  const [stats, setStats] = useState({
    totalConversations: 0,
    activeConversations: 0,
    avgConfidence: 0,
    avgResponseTime: 0,
  })

  useEffect(() => {
    void fetchConversations()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, statusFilter, dateRange])

  const fetchConversations = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = {
        page: currentPage,
        limit: 20,
        search: searchTerm || undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined,
        date_from: getDateFromRange(dateRange),
      }

      const response = await adminApiClient.getConversations(params)

      if (response.success && response.data) {
        setConversations(response.data.conversations)
        setTotalPages(response.data.total_pages ?? 1)

        // Calculate stats
        const conversations = response.data.conversations
        setStats({
          totalConversations: response.data.total,
          activeConversations: conversations.filter((c) => c.is_active).length,
          avgConfidence: conversations.reduce((sum, c) => sum + (c.avg_confidence ?? 0), 0) / conversations.length || 0,
          avgResponseTime:
            conversations.reduce((sum, c) => sum + (c.total_response_time ?? 0), 0) / conversations.length || 0,
        })
      } else {
        setError(response.error ?? 'Failed to fetch conversations')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSearch = () => {
    setCurrentPage(1)
    void fetchConversations()
  }

  const viewConversationDetails = async (conversationId: string) => {
    try {
      const response = await adminApiClient.getConversationDetails(conversationId)
      if (response.success && response.data) {
        setSelectedConversation(response.data)
      } else {
        console.error('Failed to fetch conversation details:', response.error)
      }
    } catch (error) {
      console.error('Error fetching conversation details:', error)
    }
  }

  const getDateFromRange = (range: string): string => {
    const now = new Date()
    switch (range) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'bg-green-500' : 'bg-gray-500'
  }

  const getGrafanaLinks = () => {
    const baseParams = `&from=now-${dateRange}&to=now`
    return {
      overview: `${grafanaBaseUrl}/d/tunarasa-overview/tunarasa-overview${baseParams}`,
      llmMetrics: `${grafanaBaseUrl}/d/llm-metrics/llm-performance${baseParams}`,
      conversationAnalytics: `${grafanaBaseUrl}/d/conversation-analytics/conversation-analytics${baseParams}`,
      deepevalDashboard: `${grafanaBaseUrl}/d/deepeval-monitoring/deepeval-llm-evaluation${baseParams}`,
    }
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
      {/* Header with Grafana Links */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="text-primary h-6 w-6" />
          <h2 className="text-2xl font-bold">Q&A Logs & Monitoring</h2>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void fetchConversations()} disabled={isLoading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Button variant="outline" size="sm" asChild>
            <a href={getGrafanaLinks().overview} target="_blank" rel="noopener noreferrer">
              <BarChart3 className="mr-1 h-4 w-4" />
              Grafana Overview
              <ExternalLink className="ml-1 h-3 w-3" />
            </a>
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Total Conversations</p>
                <p className="text-2xl font-bold">{stats.totalConversations}</p>
              </div>
              <MessageCircle className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Active Sessions</p>
                <p className="text-2xl font-bold">{stats.activeConversations}</p>
              </div>
              <Activity className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Avg Confidence</p>
                <p className="text-2xl font-bold">{(stats.avgConfidence * 100).toFixed(1)}%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Avg Response Time</p>
                <p className="text-2xl font-bold">{stats.avgResponseTime.toFixed(1)}s</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grafana Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Grafana Monitoring Dashboards
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" asChild>
              <a href={getGrafanaLinks().overview} target="_blank" rel="noopener noreferrer">
                <Activity className="mr-2 h-4 w-4" />
                System Overview
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>

            <Button variant="outline" asChild>
              <a href={getGrafanaLinks().llmMetrics} target="_blank" rel="noopener noreferrer">
                <TrendingUp className="mr-2 h-4 w-4" />
                LLM Performance
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>

            <Button variant="outline" asChild>
              <a href={getGrafanaLinks().conversationAnalytics} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="mr-2 h-4 w-4" />
                Conversation Analytics
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>

            <Button variant="outline" asChild>
              <a href={getGrafanaLinks().deepevalDashboard} target="_blank" rel="noopener noreferrer">
                <CheckCircle className="mr-2 h-4 w-4" />
                DeepEval Monitoring
                <ExternalLink className="ml-1 h-3 w-3" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="conversations" className="space-y-4">
        <TabsList>
          <TabsTrigger value="conversations">Conversation Logs</TabsTrigger>
          <TabsTrigger value="llm-evaluation">LLM Evaluation</TabsTrigger>
          <TabsTrigger value="details">Conversation Details</TabsTrigger>
        </TabsList>

        {/* Conversations Tab */}
        <TabsContent value="conversations" className="space-y-4">
          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search conversations..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-64"
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <Button onClick={handleSearch} size="sm">
                    Search
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-gray-400" />
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <Select value={dateRange} onValueChange={setDateRange}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1h">Last Hour</SelectItem>
                      <SelectItem value="24h">Last 24h</SelectItem>
                      <SelectItem value="7d">Last 7 days</SelectItem>
                      <SelectItem value="30d">Last 30 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Conversations Table */}
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="py-8 text-center">Loading conversations...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conversation ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Messages</TableHead>
                      <TableHead>Avg Confidence</TableHead>
                      <TableHead>Response Time</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {conversations.map((conversation) => (
                      <TableRow key={conversation.conversation_id}>
                        <TableCell className="font-mono text-sm">
                          {conversation.conversation_id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {conversation.user_info?.full_name ?? conversation.user_id}
                          </div>
                        </TableCell>
                        <TableCell>{conversation.message_count}</TableCell>
                        <TableCell>
                          {conversation.avg_confidence ? `${(conversation.avg_confidence * 100).toFixed(1)}%` : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {conversation.total_response_time ? `${conversation.total_response_time.toFixed(1)}s` : 'N/A'}
                        </TableCell>
                        <TableCell>{formatDate(conversation.created_at)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${getStatusColor(conversation.is_active)}`}></div>
                            <Badge variant={conversation.is_active ? 'default' : 'secondary'}>
                              {conversation.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void viewConversationDetails(conversation.conversation_id)}
                          >
                            <Eye className="mr-1 h-4 w-4" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Page {currentPage} of {totalPages}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* LLM Evaluation Tab */}
        <TabsContent value="llm-evaluation">
          <LLMEvaluationRecommendations />
        </TabsContent>

        {/* Conversation Details Tab */}
        <TabsContent value="details" className="space-y-4">
          {selectedConversation ? (
            <Card>
              <CardHeader>
                <CardTitle>Conversation Details: {selectedConversation.conversation_id.slice(0, 8)}...</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Conversation Info */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-medium">User</p>
                    <p className="text-sm text-gray-600">{selectedConversation.user_info?.full_name ?? 'Unknown'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <Badge variant={selectedConversation.is_active ? 'default' : 'secondary'}>
                      {selectedConversation.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-sm text-gray-600">{formatDate(selectedConversation.created_at)}</p>
                  </div>
                </div>

                <Separator />

                {/* Messages */}
                <div>
                  <h4 className="mb-3 font-medium">Messages</h4>
                  <div className="max-h-96 space-y-3 overflow-y-auto">
                    {(selectedConversation.messages ?? []).map((message) => (
                      <div
                        key={message.message_id}
                        className={`rounded-lg p-3 ${
                          message.is_from_user
                            ? 'border-l-4 border-blue-500 bg-blue-50'
                            : 'border-l-4 border-gray-500 bg-gray-50'
                        }`}
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <Badge variant={message.is_from_user ? 'default' : 'secondary'}>
                            {message.is_from_user ? 'User' : 'System'}
                          </Badge>
                          <div className="text-xs text-gray-500">
                            {formatDate(message.timestamp)}
                            {message.confidence && ` • Confidence: ${(message.confidence * 100).toFixed(1)}%`}
                            {message.response_time && ` • ${message.response_time.toFixed(1)}s`}
                          </div>
                        </div>
                        <p className="text-sm">{message.content}</p>
                        {message.gesture_input && (
                          <p className="mt-1 text-xs text-gray-600">
                            <strong>Gesture:</strong> {message.gesture_input}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Admin Notes */}
                {(selectedConversation.notes ?? []).length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-3 font-medium">Admin Notes</h4>
                      <div className="space-y-2">
                        {(selectedConversation.notes ?? []).map((note) => (
                          <div key={note.note_id} className="rounded-lg border-l-4 border-yellow-500 bg-yellow-50 p-3">
                            <p className="text-sm">{note.content}</p>
                            <p className="mt-1 text-xs text-gray-500">
                              By {note.admin_user_id} • {formatDate(note.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="py-8 text-center text-gray-500">
                  Select a conversation from the list to view details
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
