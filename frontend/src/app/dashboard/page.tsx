'use client'

import { useState, useEffect } from 'react'
import { useAdminClient } from '@/lib/hooks/use-admin-client'
import type { AdminSession, GestureAnalytics as ApiGestureAnalytics } from '@/lib/api/admin-client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Users,
  Activity,
  BarChart3,
  Settings,
  AlertCircle,
  CheckCircle,
  Hand,
  MessageCircle,
  Database,
  Server,
  Shield,
  Zap,
  Clock,
  TrendingUp,
  RefreshCw,
  Search,
  Globe,
  Cpu,
  MemoryStick,
  HardDrive,
  Wifi,
  Monitor,
  Smartphone,
  Tablet,
  Laptop,
} from 'lucide-react'
import { QALogsViewer } from '@/components/admin/QALogsViewer'

// Force dynamic rendering to prevent build-time Clerk evaluation
export const dynamic = 'force-dynamic'

interface DashboardStats {
  totalSessions: number
  totalConversations: number
  totalGestures: number
  activeSessions: number
  averageAccuracy: number
  averageResponseTime: number
  systemHealth: 'healthy' | 'warning' | 'error'
  uptime: number
}

interface SessionData {
  id: string
  userId: string
  startTime: Date
  lastActivity: Date
  gestureCount: number
  conversationCount: number
  accuracy: number
  device: string
  location: string
  status: 'active' | 'idle' | 'ended'
}

interface LocalGestureAnalytics {
  letter: string
  count: number
  accuracy: number
  averageConfidence: number
  improvements: number
}

interface SystemMetrics {
  cpu: number
  memory: number
  storage: number
  network: number
  latency: number
  errorRate: number
}

export default function AdminDashboard() {
  const adminClient = useAdminClient()
  const [stats, setStats] = useState<DashboardStats>({
    totalSessions: 0,
    totalConversations: 0,
    totalGestures: 0,
    activeSessions: 0,
    averageAccuracy: 0,
    averageResponseTime: 0,
    systemHealth: 'healthy',
    uptime: 0,
  })

  const [sessions, setSessions] = useState<SessionData[]>([])
  const [gestureAnalytics, setGestureAnalytics] = useState<LocalGestureAnalytics[]>([])
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>({
    cpu: 0,
    memory: 0,
    storage: 0,
    network: 0,
    latency: 0,
    errorRate: 0,
  })

  const [lastUpdate, setLastUpdate] = useState(new Date())
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [settings, setSettings] = useState({
    confidenceThreshold: 0.7,
    enableSmoothing: true,
    debounceTime: 500,
    rateLimit: 100,
    maxSessions: 1000,
    autoCleanup: true,
  })

  // Fetch dashboard data from backend API
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch dashboard statistics
        const statsResponse = await adminClient.getDashboardStats()

        if (statsResponse.success && statsResponse.data) {
          const statsData = statsResponse.data
          setStats({
            totalSessions: statsData.total_sessions || 0,
            totalConversations: statsData.total_conversations || 0,
            totalGestures: statsData.total_gestures || 0,
            activeSessions: statsData.active_sessions || 0,
            averageAccuracy: statsData.average_accuracy || 0,
            averageResponseTime: statsData.average_response_time || 0,
            systemHealth: statsData.system_health || 'healthy',
            uptime: statsData.uptime || 0,
          })
        } else {
          console.error('Failed to fetch dashboard stats:', statsResponse.error)
          // Keep current stats or show error state - no fallback to dummy data
        }

        // Fetch session data
        const sessionsResponse = await adminClient.getSessions()

        if (sessionsResponse.success && sessionsResponse.data) {
          const sessionsData = sessionsResponse.data
          setSessions(
            sessionsData.sessions?.map((session: AdminSession) => ({
              id: session.id,
              userId: session.user_id,
              startTime: new Date(session.start_time),
              lastActivity: new Date(session.last_activity),
              gestureCount: session.gesture_count || 0,
              conversationCount: session.conversation_count || 0,
              accuracy: session.accuracy || 0,
              device: session.device || 'Unknown',
              location: session.location || 'Unknown',
              status: session.status || 'ended',
            })) || [],
          )
        } else {
          console.error('Failed to fetch sessions:', sessionsResponse.error)
          // Keep current sessions or set to empty array - no fallback to dummy data
          setSessions([])
        }

        // Fetch gesture analytics
        const analyticsResponse = await adminClient.getGestureAnalytics()

        if (analyticsResponse.success && analyticsResponse.data) {
          const analyticsData = analyticsResponse.data
          setGestureAnalytics(
            analyticsData.gesture_analytics?.map((gesture: ApiGestureAnalytics) => ({
              letter: gesture.letter,
              count: gesture.count || 0,
              accuracy: gesture.accuracy || 0,
              averageConfidence: gesture.average_confidence || 0,
              improvements: gesture.improvements || 0,
            })) || [],
          )
        } else {
          // Fallback to mock data
          console.warn('Failed to fetch gesture analytics:', analyticsResponse.error)
          setGestureAnalytics([
            { letter: 'A', count: 1245, accuracy: 94.2, averageConfidence: 0.92, improvements: 15 },
            { letter: 'B', count: 1189, accuracy: 89.5, averageConfidence: 0.87, improvements: 8 },
            { letter: 'C', count: 1067, accuracy: 91.8, averageConfidence: 0.89, improvements: 12 },
            { letter: 'D', count: 998, accuracy: 86.3, averageConfidence: 0.84, improvements: 22 },
            { letter: 'E', count: 1334, accuracy: 93.7, averageConfidence: 0.91, improvements: 7 },
          ])
        }

        // Fetch system metrics
        const metricsResponse = await adminClient.getSystemMetrics()

        if (metricsResponse.success && metricsResponse.data) {
          const metricsData = metricsResponse.data
          setSystemMetrics({
            cpu: metricsData.cpu_usage || 0,
            memory: metricsData.memory_usage || 0,
            storage: metricsData.storage_usage || 0,
            network: metricsData.network_usage || 0,
            latency: metricsData.response_time || 0,
            errorRate: metricsData.error_rate || 0,
          })
        } else {
          // Fallback to mock data
          console.warn('Failed to fetch system metrics:', metricsResponse.error)
          setSystemMetrics({
            cpu: 45.2,
            memory: 67.8,
            storage: 34.5,
            network: 89.1,
            latency: 12.5,
            errorRate: 0.02,
          })
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        // Keep current stats or show error state - no fallback to dummy data
      }

      setLastUpdate(new Date())
    }

    fetchDashboardData()

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        fetchDashboardData()
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [autoRefresh, adminClient])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500'
      case 'idle':
        return 'bg-yellow-500'
      case 'ended':
        return 'bg-gray-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getHealthStatus = () => {
    switch (stats.systemHealth) {
      case 'healthy':
        return { color: 'text-green-600', icon: CheckCircle, text: 'System Healthy' }
      case 'warning':
        return { color: 'text-yellow-600', icon: AlertCircle, text: 'System Warning' }
      case 'error':
        return { color: 'text-red-600', icon: AlertCircle, text: 'System Error' }
      default:
        return { color: 'text-gray-600', icon: AlertCircle, text: 'Unknown' }
    }
  }

  const filteredSessions = sessions.filter(
    (session) =>
      session.userId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.device.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const healthStatus = getHealthStatus()

  const handleSaveSettings = async () => {
    setSettingsLoading(true)
    try {
      const response = await adminClient.updateSettings({
        confidence_threshold: settings.confidenceThreshold,
        enable_smoothing: settings.enableSmoothing,
        debounce_time: settings.debounceTime,
        rate_limit: settings.rateLimit,
        max_sessions: settings.maxSessions,
        auto_cleanup: settings.autoCleanup,
      })

      if (response.success) {
        console.log('Settings saved successfully')
        // Could add a toast notification here
      } else {
        console.error('Failed to save settings:', response.error)
      }
    } catch (error) {
      console.error('Error saving settings:', error)
    } finally {
      setSettingsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="mt-1 text-gray-600">Tunarasa Sign Language Recognition System</p>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
              <Label htmlFor="auto-refresh" className="text-sm">
                Auto-refresh
              </Label>
            </div>

            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>

            <div className="text-sm text-gray-500">Last updated: {lastUpdate.toLocaleTimeString()}</div>
          </div>
        </div>

        {/* System Status Alert */}
        <Alert
          className={
            stats.systemHealth === 'healthy' ? 'border-green-200 bg-green-50' : 'border-yellow-200 bg-yellow-50'
          }
        >
          <healthStatus.icon className="h-4 w-4" />
          <AlertDescription className={healthStatus.color}>
            {healthStatus.text} - Uptime: {stats.uptime}% | Active Sessions: {stats.activeSessions}
          </AlertDescription>
        </Alert>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Sessions</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSessions.toLocaleString()}</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="mr-1 h-3 w-3" />
                +12.5% from last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Gestures</CardTitle>
              <Hand className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalGestures.toLocaleString()}</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="mr-1 h-3 w-3" />
                +8.3% from last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Conversations</CardTitle>
              <MessageCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConversations.toLocaleString()}</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="mr-1 h-3 w-3" />
                +15.7% from last month
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Accuracy Rate</CardTitle>
              <BarChart3 className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.averageAccuracy}%</div>
              <div className="flex items-center text-xs text-green-600">
                <TrendingUp className="mr-1 h-3 w-3" />
                +2.1% from last month
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="qa-logs">Q&A Logs</TabsTrigger>
            <TabsTrigger value="system">System</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Performance Metrics */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    Performance Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Average Response Time</span>
                        <span>{stats.averageResponseTime}s</span>
                      </div>
                      <Progress value={Math.max(0, 100 - stats.averageResponseTime * 20)} className="h-2" />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>System Uptime</span>
                        <span>{stats.uptime}%</span>
                      </div>
                      <Progress value={stats.uptime} className="h-2" />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">{stats.activeSessions}</div>
                      <div className="text-sm text-gray-600">Active Now</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-600">{stats.averageAccuracy}%</div>
                      <div className="text-sm text-gray-600">Accuracy</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">{stats.averageResponseTime}s</div>
                      <div className="text-sm text-gray-600">Response</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* System Health */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    System Health
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-blue-600" />
                        <span className="text-sm">CPU Usage</span>
                      </div>
                      <span className="text-sm font-medium">{systemMetrics.cpu}%</span>
                    </div>
                    <Progress value={systemMetrics.cpu} className="h-2" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MemoryStick className="h-4 w-4 text-green-600" />
                        <span className="text-sm">Memory</span>
                      </div>
                      <span className="text-sm font-medium">{systemMetrics.memory}%</span>
                    </div>
                    <Progress value={systemMetrics.memory} className="h-2" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HardDrive className="h-4 w-4 text-purple-600" />
                        <span className="text-sm">Storage</span>
                      </div>
                      <span className="text-sm font-medium">{systemMetrics.storage}%</span>
                    </div>
                    <Progress value={systemMetrics.storage} className="h-2" />

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-orange-600" />
                        <span className="text-sm">Network</span>
                      </div>
                      <span className="text-sm font-medium">{systemMetrics.network}%</span>
                    </div>
                    <Progress value={systemMetrics.network} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-green-500"></div>
                    <span className="text-gray-600">2 minutes ago</span>
                    <span>New user session started from Jakarta, ID</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                    <span className="text-gray-600">5 minutes ago</span>
                    <span>Gesture recognition accuracy improved for letter &apos;A&apos;</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                    <span className="text-gray-600">8 minutes ago</span>
                    <span>User completed 50 gesture recognitions</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="h-2 w-2 rounded-full bg-yellow-500"></div>
                    <span className="text-gray-600">12 minutes ago</span>
                    <span>System maintenance completed successfully</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sessions Tab */}
          <TabsContent value="sessions" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Active Sessions
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Search className="h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search sessions..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Session ID</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Gestures</TableHead>
                      <TableHead>Accuracy</TableHead>
                      <TableHead>Device</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSessions.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell className="font-mono text-sm">{session.id}</TableCell>
                        <TableCell>{session.userId}</TableCell>
                        <TableCell>{Math.floor((Date.now() - session.startTime.getTime()) / 1000 / 60)} mins</TableCell>
                        <TableCell>{session.gestureCount}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{session.accuracy}%</span>
                            <Progress value={session.accuracy} className="h-2 w-16" />
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {session.device === 'Desktop' && <Monitor className="h-4 w-4" />}
                            {session.device === 'Mobile' && <Smartphone className="h-4 w-4" />}
                            {session.device === 'Tablet' && <Tablet className="h-4 w-4" />}
                            {session.device === 'Laptop' && <Laptop className="h-4 w-4" />}
                            {session.device}
                          </div>
                        </TableCell>
                        <TableCell>{session.location}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${getStatusColor(session.status)}`}></div>
                            <Badge variant={session.status === 'active' ? 'default' : 'secondary'}>
                              {session.status}
                            </Badge>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Gesture Performance */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Hand className="h-5 w-5" />
                    Gesture Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {gestureAnalytics.map((gesture) => (
                      <div key={gesture.letter} className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 font-bold text-white">
                            {gesture.letter}
                          </div>
                          <div>
                            <div className="font-medium">{gesture.count.toLocaleString()} detections</div>
                            <div className="text-sm text-gray-600">{gesture.accuracy}% accuracy</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-medium">{Math.round(gesture.averageConfidence * 100)}%</div>
                          <div className="text-xs text-gray-600">avg confidence</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Usage Trends */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Usage Trends
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Daily Active Users</span>
                      <span className="font-medium">+15.2%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Session Duration</span>
                      <span className="font-medium">+8.7%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Gesture Accuracy</span>
                      <span className="font-medium">+3.1%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Response Time</span>
                      <span className="font-medium text-green-600">-12.4%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Q&A Logs Tab */}
          <TabsContent value="qa-logs" className="space-y-6">
            <QALogsViewer />
          </TabsContent>

          {/* System Tab */}
          <TabsContent value="system" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    System Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg bg-green-50 p-4 text-center">
                      <Database className="mx-auto mb-2 h-8 w-8 text-green-600" />
                      <div className="font-medium">Database</div>
                      <div className="text-sm text-green-600">Healthy</div>
                    </div>
                    <div className="rounded-lg bg-blue-50 p-4 text-center">
                      <Zap className="mx-auto mb-2 h-8 w-8 text-blue-600" />
                      <div className="font-medium">API</div>
                      <div className="text-sm text-blue-600">Online</div>
                    </div>
                    <div className="rounded-lg bg-purple-50 p-4 text-center">
                      <Shield className="mx-auto mb-2 h-8 w-8 text-purple-600" />
                      <div className="font-medium">Security</div>
                      <div className="text-sm text-purple-600">Protected</div>
                    </div>
                    <div className="rounded-lg bg-orange-50 p-4 text-center">
                      <Globe className="mx-auto mb-2 h-8 w-8 text-orange-600" />
                      <div className="font-medium">CDN</div>
                      <div className="text-sm text-orange-600">Active</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Resource Usage
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>CPU Usage</span>
                        <span>{systemMetrics.cpu}%</span>
                      </div>
                      <Progress value={systemMetrics.cpu} className="h-2" />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>Memory Usage</span>
                        <span>{systemMetrics.memory}%</span>
                      </div>
                      <Progress value={systemMetrics.memory} className="h-2" />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>Storage Usage</span>
                        <span>{systemMetrics.storage}%</span>
                      </div>
                      <Progress value={systemMetrics.storage} className="h-2" />
                    </div>
                    <div>
                      <div className="mb-1 flex justify-between text-sm">
                        <span>Network Usage</span>
                        <span>{systemMetrics.network}%</span>
                      </div>
                      <Progress value={systemMetrics.network} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* User Statistics */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Statistics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">1,247</div>
                    <div className="text-sm text-gray-600">Total Users</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">156</div>
                    <div className="text-sm text-gray-600">Active Today</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600">89</div>
                    <div className="text-sm text-gray-600">New This Week</div>
                  </div>
                </CardContent>
              </Card>

              {/* User Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    User Activity
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Daily Active Users</span>
                      <span className="font-medium">156</span>
                    </div>
                    <Progress value={78} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Weekly Active Users</span>
                      <span className="font-medium">892</span>
                    </div>
                    <Progress value={65} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Monthly Active Users</span>
                      <span className="font-medium">1,247</span>
                    </div>
                    <Progress value={89} className="h-2" />
                  </div>
                </CardContent>
              </Card>

              {/* User Feedback */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    User Feedback
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">4.7</div>
                    <div className="text-sm text-gray-600">Average Rating</div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>5 Stars</span>
                      <span>67%</span>
                    </div>
                    <Progress value={67} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span>4 Stars</span>
                      <span>23%</span>
                    </div>
                    <Progress value={23} className="h-2" />
                    <div className="flex justify-between text-sm">
                      <span>3 Stars</span>
                      <span>8%</span>
                    </div>
                    <Progress value={8} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent User Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent User Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
                        U
                      </div>
                      <div>
                        <div className="font-medium">user_abc123</div>
                        <div className="text-sm text-gray-600">Completed 25 gesture recognitions</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">2 min ago</div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-sm font-bold text-white">
                        N
                      </div>
                      <div>
                        <div className="font-medium">new_user_456</div>
                        <div className="text-sm text-gray-600">Started first session</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">5 min ago</div>
                  </div>
                  <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-600 text-sm font-bold text-white">
                        P
                      </div>
                      <div>
                        <div className="font-medium">power_user_789</div>
                        <div className="text-sm text-gray-600">Achieved 95% accuracy milestone</div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">8 min ago</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  System Settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div className="space-y-4">
                      <h3 className="font-medium">Recognition Settings</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="confidence">Confidence Threshold</Label>
                          <Input
                            id="confidence"
                            type="number"
                            value={settings.confidenceThreshold}
                            onChange={(e) =>
                              setSettings({ ...settings, confidenceThreshold: parseFloat(e.target.value) })
                            }
                            className="w-24"
                            step="0.1"
                            min="0"
                            max="1"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="smoothing">Enable Smoothing</Label>
                          <Switch
                            id="smoothing"
                            checked={settings.enableSmoothing}
                            onCheckedChange={(checked) => setSettings({ ...settings, enableSmoothing: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="debounce">Debounce Time (ms)</Label>
                          <Input
                            id="debounce"
                            type="number"
                            value={settings.debounceTime}
                            onChange={(e) => setSettings({ ...settings, debounceTime: parseInt(e.target.value) })}
                            className="w-24"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-medium">System Settings</h3>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="rate-limit">Rate Limit (req/min)</Label>
                          <Input
                            id="rate-limit"
                            type="number"
                            value={settings.rateLimit}
                            onChange={(e) => setSettings({ ...settings, rateLimit: parseInt(e.target.value) })}
                            className="w-24"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="max-sessions">Max Sessions</Label>
                          <Input
                            id="max-sessions"
                            type="number"
                            value={settings.maxSessions}
                            onChange={(e) => setSettings({ ...settings, maxSessions: parseInt(e.target.value) })}
                            className="w-24"
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="auto-cleanup">Auto Cleanup</Label>
                          <Switch
                            id="auto-cleanup"
                            checked={settings.autoCleanup}
                            onCheckedChange={(checked) => setSettings({ ...settings, autoCleanup: checked })}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-end gap-4">
                    <Button
                      variant="outline"
                      onClick={() =>
                        setSettings({
                          confidenceThreshold: 0.7,
                          enableSmoothing: true,
                          debounceTime: 500,
                          rateLimit: 100,
                          maxSessions: 1000,
                          autoCleanup: true,
                        })
                      }
                    >
                      Reset to Defaults
                    </Button>
                    <Button onClick={handleSaveSettings} disabled={settingsLoading}>
                      {settingsLoading ? 'Saving...' : 'Save Changes'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
