'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  ExternalLink,
  UserPlus,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  Crown,
  Shield,
  AlertCircle,
  Loader2,
  Activity,
  MessageSquare,
  Search,
  Filter,
  Bot,
  User,
  Clock,
  Building,
  FileText,
  Edit,
  Plus,
  Upload,
  Trash2,
} from 'lucide-react'
import { useUserRole } from '@/components/auth/SuperAdminOnly'
import { AdminOnly } from '@/components/auth/AdminOnly'

// Force dynamic rendering and disable static optimization
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'

interface AdminUser {
  id: string
  email: string
  firstName?: string
  lastName?: string
  fullName?: string
  role: 'admin' | 'superadmin'
  status: 'active' | 'inactive'
  lastActive: string | Date | null
  createdAt: string | Date
  invitedBy?: string
}

interface PendingInvitation {
  id: string
  email: string
  role: 'admin' | 'superadmin'
  invitedBy: string
  invitedAt: string | Date
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expiresAt: string | Date
  customMessage?: string
}

interface QALog {
  id: string
  conversationId: number
  question: string
  answer: string
  confidence?: number
  responseTime?: number
  gestureInput?: string
  contextUsed?: string
  evaluationScore?: number
  serviceMode: 'full_llm_bot' | 'bot_with_admin_validation'
  respondedBy: 'llm' | 'admin'
  llmRecommendationUsed: boolean
  createdAt: string | Date
  conversation: {
    sessionId: string
    status: string
    serviceMode: string
  }
  admin?: {
    id: number
    email: string
    fullName: string
  } | null
}

interface QALogsResponse {
  qaLogs: QALog[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNextPage: boolean
    hasPrevPage: boolean
  }
  statistics: {
    totalLogs: number
    averageConfidence: number
    averageResponseTime: number
    llmResponses: number
    adminResponses: number
  }
  filters: {
    serviceMode?: string
    respondedBy?: string
    searchQuery?: string
    dateFrom?: string
    dateTo?: string
    minConfidence?: string
    maxConfidence?: string
  }
}

interface Institution {
  institutionId: number
  name: string
  slug: string
  description?: string
  logoUrl?: string
  contactInfo?: {
    phone?: string
    email?: string
    address?: string
    website?: string
  }
  isActive: boolean
  createdBy: number
  createdAt: string | Date
  updatedAt: string | Date
  _count?: {
    ragFiles: number
    conversations: number
  }
}

interface RagFile {
  ragFileId: number
  institutionId: number
  fileName: string
  fileType: 'pdf' | 'txt'
  filePath: string
  fileSize?: number
  description?: string
  processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
  pineconeNamespace?: string
  isActive: boolean
  createdBy: number
  createdAt: string | Date
  updatedAt: string | Date
}

// Component that uses auth hooks - only rendered client-side
function DashboardAuthContent() {
  const { role: _role, isSuperAdmin, isAdmin } = useUserRole()

  return <DashboardContentInner isSuperAdmin={isSuperAdmin ?? false} isAdmin={isAdmin ?? false} />
}

interface DashboardContentInnerProps {
  isSuperAdmin: boolean
  isAdmin: boolean
}

function DashboardContent() {
  const [isMounted, setIsMounted] = useState(false)

  // Client-side mounting check
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent server-side rendering of auth hooks
  if (!isMounted) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return <DashboardAuthContent />
}

function DashboardContentInner({ isSuperAdmin, isAdmin }: DashboardContentInnerProps) {
  const [admins, setAdmins] = useState<AdminUser[]>([])
  const [_pendingInvitations, setPendingInvitations] = useState<PendingInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Invitation form state
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'superadmin'>('admin')
  const [customMessage, setCustomMessage] = useState('')
  const [isInviting, setIsInviting] = useState(false)
  const [invitationStatus, setInvitationStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [_institutionStatus, setInstitutionStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [statusMessage, setStatusMessage] = useState('')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

  // QA Logs state
  const [qaLogs, setQaLogs] = useState<QALog[]>([])
  const [qaLogsLoading, setQaLogsLoading] = useState(false)
  const [qaLogsPage, setQaLogsPage] = useState(1)
  const [qaLogsPagination, setQaLogsPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNextPage: false,
    hasPrevPage: false,
  })
  const [qaLogsStatistics, setQaLogsStatistics] = useState({
    totalLogs: 0,
    averageConfidence: 0,
    averageResponseTime: 0,
    llmResponses: 0,
    adminResponses: 0,
  })
  const [qaLogsFilters, setQaLogsFilters] = useState({
    serviceMode: 'all',
    respondedBy: 'all',
    searchQuery: '',
  })
  const [showQaLogs, setShowQaLogs] = useState(false)

  // Institution and RAG file management state
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [_ragFiles, setRagFiles] = useState<RagFile[]>([])
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  const [institutionLoading, setInstitutionLoading] = useState(false)
  const [showInstitutions, setShowInstitutions] = useState(false)
  const [showRagFiles, setShowRagFiles] = useState(false)
  const [institutionDialogOpen, setInstitutionDialogOpen] = useState(false)
  const [_ragFileDialogOpen, _setRagFileDialogOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [fileDescription, setFileDescription] = useState('')

  // Institution form state
  const [institutionName, setInstitutionName] = useState('')
  const [institutionSlug, setInstitutionSlug] = useState('')
  const [institutionDescription, setInstitutionDescription] = useState('')
  const [editingInstitution, setEditingInstitution] = useState<Institution | null>(null)

  // Institution RAG file upload state (for create/edit)
  const [institutionRagFile, setInstitutionRagFile] = useState<File | null>(null)
  const [institutionRagDescription, setInstitutionRagDescription] = useState('')

  // RAG file replacement state
  const [editingRagFile, setEditingRagFile] = useState<RagFile | null>(null)
  const [replaceRagDialogOpen, setReplaceRagDialogOpen] = useState(false)
  const [newRagFile, setNewRagFile] = useState<File | null>(null)
  const [newRagDescription, setNewRagDescription] = useState('')

  // Fetch admin users and invitations
  const fetchAdminData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      // Fetch current admins
      const adminsResponse = await fetch('/api/admin/users')
      if (adminsResponse.ok) {
        const adminsData = await adminsResponse.json()
        if (adminsData.success && adminsData.data) {
          setAdmins(adminsData.data.users ?? [])
        }
      }

      // Fetch pending invitations
      const invitationsResponse = await fetch('/api/admin/invitations')
      if (invitationsResponse.ok) {
        const invitationsData = await invitationsResponse.json()
        if (invitationsData.success && invitationsData.data) {
          setPendingInvitations(invitationsData.data.invitations ?? [])
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch admin data'
      setError(errorMessage)
      console.error('Admin data fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch QA logs
  const fetchQaLogs = useCallback(
    async (page: number = 1) => {
      try {
        setQaLogsLoading(true)

        const params = new URLSearchParams({
          page: page.toString(),
          limit: '20',
        })

        if (qaLogsFilters.serviceMode && qaLogsFilters.serviceMode !== 'all')
          params.append('serviceMode', qaLogsFilters.serviceMode)
        if (qaLogsFilters.respondedBy && qaLogsFilters.respondedBy !== 'all')
          params.append('respondedBy', qaLogsFilters.respondedBy)
        if (qaLogsFilters.searchQuery) params.append('search', qaLogsFilters.searchQuery)

        const response = await fetch(`/api/admin/qa-logs?${params.toString()}`)
        if (response.ok) {
          const data: { success: boolean; data: QALogsResponse } = await response.json()
          if (data.success && data.data) {
            setQaLogs(data.data.qaLogs)
            setQaLogsPagination(data.data.pagination)
            setQaLogsStatistics(data.data.statistics)
            setQaLogsPage(page)
          }
        } else {
          console.error('Failed to fetch QA logs:', response.statusText)
        }
      } catch (error) {
        console.error('Error fetching QA logs:', error)
      } finally {
        setQaLogsLoading(false)
      }
    },
    [qaLogsFilters],
  )

  // Fetch institutions
  const fetchInstitutions = useCallback(async () => {
    try {
      setInstitutionLoading(true)
      const response = await fetch('/api/admin/institutions')
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          console.log('🏢 Institutions data:', data.data.institutions)
          setInstitutions(data.data.institutions ?? [])
        }
      }
    } catch (error) {
      console.error('Error fetching institutions:', error)
    } finally {
      setInstitutionLoading(false)
    }
  }, [])

  // Fetch RAG files for selected institution
  const fetchRagFiles = useCallback(async (institutionId: number) => {
    try {
      setInstitutionLoading(true)
      const response = await fetch(`/api/admin/institutions/${institutionId}/rag-files`)
      if (response.ok) {
        const data = await response.json()
        if (data.success && data.data) {
          setRagFiles(data.data.ragFiles ?? [])
        }
      }
    } catch (error) {
      console.error('Error fetching RAG files:', error)
    } finally {
      setInstitutionLoading(false)
    }
  }, [])

  // Create or update institution with optional RAG file
  const handleSaveInstitution = async () => {
    if (!institutionName.trim() || !institutionSlug.trim()) return

    try {
      setIsInviting(true)
      const method = editingInstitution ? 'PUT' : 'POST'
      const url = editingInstitution
        ? `/api/admin/institutions/${editingInstitution.institutionId}`
        : '/api/admin/institutions'

      // First, create/update the institution
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: institutionName,
          slug: institutionSlug,
          description: institutionDescription || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? `Failed to ${editingInstitution ? 'update' : 'create'} institution`)
      }

      const institutionResult = await response.json()
      console.log('🏢 Institution response:', institutionResult)
      const institutionId = editingInstitution?.institutionId ?? institutionResult.data?.institution?.institutionId

      console.log('📋 Institution ID:', institutionId)
      console.log('📁 RAG file to upload:', !!institutionRagFile)
      console.log('✏️ Is editing institution:', !!editingInstitution)

      // If there's a RAG file to upload and we have the institution ID
      if (institutionRagFile && institutionId && !editingInstitution) {
        try {
          console.log('🔄 Uploading RAG file for institution:', institutionId)

          // Upload file first
          const formData = new FormData()
          formData.append('file', institutionRagFile)
          formData.append('institutionId', institutionId.toString())
          formData.append('description', institutionRagDescription)

          const uploadResponse = await fetch('/api/admin/upload-rag-file', {
            method: 'POST',
            body: formData,
          })

          const uploadResult = await uploadResponse.json()

          if (!uploadResponse.ok) {
            throw new Error(uploadResult.error ?? 'Failed to upload RAG file')
          }

          console.log('✅ File uploaded successfully:', uploadResult.data.fileName)

          // Create RAG file record
          const createRagResponse = await fetch(`/api/admin/institutions/${institutionId}/rag-files`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fileName: uploadResult.data.fileName,
              fileType: uploadResult.data.fileType,
              filePath: uploadResult.data.filePath,
              fileSize: uploadResult.data.fileSize,
              description: institutionRagDescription,
            }),
          })

          const createRagResult = await createRagResponse.json()

          if (!createRagResponse.ok) {
            throw new Error(createRagResult.error ?? 'Failed to create RAG file record')
          }

          console.log('✅ RAG file record created successfully:', createRagResult.data)

          setStatusMessage(`Institusi berhasil ${editingInstitution ? 'diperbarui' : 'dibuat'} dengan file RAG`)
        } catch (ragError) {
          console.error('❌ RAG file error:', ragError)
          // Institution was created, but RAG file failed - still show success but mention the file issue
          setStatusMessage(
            `Institusi berhasil ${editingInstitution ? 'diperbarui' : 'dibuat'}, tetapi gagal mengunggah file RAG: ${
              ragError instanceof Error ? ragError.message : 'Unknown error'
            }`,
          )
        }
      } else {
        setStatusMessage(`Institusi berhasil ${editingInstitution ? 'diperbarui' : 'dibuat'}`)
      }

      setInstitutionStatus('success')

      // Reset form
      setInstitutionName('')
      setInstitutionSlug('')
      setInstitutionDescription('')
      setInstitutionRagFile(null)
      setInstitutionRagDescription('')
      setEditingInstitution(null)
      setInstitutionDialogOpen(false)

      // Refresh institutions
      await fetchInstitutions()
    } catch (error) {
      console.error('❌ Institution save error:', error)
      setInvitationStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Operasi gagal')
    } finally {
      setIsInviting(false)
    }
  }

  useEffect(() => {
    void fetchAdminData()
  }, [fetchAdminData])

  useEffect(() => {
    if (showQaLogs) {
      void fetchQaLogs(1)
    }
  }, [showQaLogs, fetchQaLogs])

  useEffect(() => {
    if (showInstitutions) {
      void fetchInstitutions()
    }
  }, [showInstitutions, fetchInstitutions])

  // Auto-fetch RAG files when institution is selected and files are shown
  useEffect(() => {
    if (showRagFiles && selectedInstitution) {
      void fetchRagFiles(selectedInstitution.institutionId)
    }
  }, [showRagFiles, selectedInstitution, fetchRagFiles])

  // Clear RAG files when no institution is selected
  useEffect(() => {
    if (!selectedInstitution) {
      setRagFiles([])
      setShowRagFiles(false)
    }
  }, [selectedInstitution])

  const handleSendInvitation = async () => {
    if (!inviteEmail) return

    setIsInviting(true)
    setInvitationStatus('idle')

    try {
      const response = await fetch('/api/admin/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          customMessage: customMessage || undefined,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Failed to send invitation')
      }

      await response.json()

      setInvitationStatus('success')
      setStatusMessage(`Invitation sent successfully to ${inviteEmail}`)

      // Reset form
      setInviteEmail('')
      setCustomMessage('')
      setInviteRole('admin')
      setInviteDialogOpen(false)

      // Refresh data
      await fetchAdminData()
    } catch (error) {
      setInvitationStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Failed to send invitation. Please try again.')
      console.error('Invitation error:', error)
    } finally {
      setIsInviting(false)
    }
  }

  const _handleResendInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/admin/invite/${invitationId}/resend`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to resend invitation')
      }

      setStatusMessage('Invitation resent successfully')
      setInvitationStatus('success')
      await fetchAdminData()
    } catch {
      setStatusMessage('Failed to resend invitation')
      setInvitationStatus('error')
    }
  }

  const _handleCancelInvitation = async (invitationId: string) => {
    try {
      const response = await fetch(`/api/admin/invite/${invitationId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        throw new Error('Failed to cancel invitation')
      }

      setStatusMessage('Invitation cancelled successfully')
      setInvitationStatus('success')
      await fetchAdminData()
    } catch {
      setStatusMessage('Failed to cancel invitation')
      setInvitationStatus('error')
    }
  }

  // Handle file upload - DEPRECATED: now integrated with institution creation
  const _handleFileUpload = async () => {
    if (!selectedFile || !selectedInstitution) return

    try {
      setUploading(true)
      setInvitationStatus('idle')

      // Upload file first
      const formData = new FormData()
      formData.append('file', selectedFile)
      formData.append('institutionId', selectedInstitution.institutionId.toString())
      formData.append('description', fileDescription)

      const uploadResponse = await fetch('/api/admin/upload-rag-file', {
        method: 'POST',
        body: formData,
      })

      const uploadResult = await uploadResponse.json()

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error ?? 'Failed to upload file')
      }

      // Create RAG file record
      const createResponse = await fetch(`/api/admin/institutions/${selectedInstitution.institutionId}/rag-files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: uploadResult.data.fileName,
          fileType: uploadResult.data.fileType,
          filePath: uploadResult.data.filePath,
          fileSize: uploadResult.data.fileSize,
          description: fileDescription,
        }),
      })

      const createResult = await createResponse.json()

      if (!createResponse.ok) {
        throw new Error(createResult.error ?? 'Failed to create RAG file record')
      }

      setInvitationStatus('success')
      setStatusMessage(`File "${uploadResult.data.fileName}" berhasil diunggah dan ditambahkan ke RAG`)

      // Reset form
      setSelectedFile(null)
      setFileDescription('')

      // Refresh institutions data and RAG files
      await fetchInstitutions()
      if (selectedInstitution) {
        await fetchRagFiles(selectedInstitution.institutionId)
      }
    } catch (error) {
      setInvitationStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Gagal mengunggah file')
    } finally {
      setUploading(false)
    }
  }

  const _handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'text/plain']
      if (!allowedTypes.includes(file.type)) {
        setInvitationStatus('error')
        setStatusMessage('Tipe file tidak valid. Hanya file PDF dan TXT yang diizinkan.')
        return
      }

      // Validate file size (10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        setInvitationStatus('error')
        setStatusMessage('Ukuran file melebihi batas 10MB')
        return
      }

      setSelectedFile(file)
      setInvitationStatus('idle')
    }
  }

  // Handle RAG file select for institution creation
  const handleInstitutionRagFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'text/plain']
      if (!allowedTypes.includes(file.type)) {
        setInvitationStatus('error')
        setStatusMessage('Tipe file tidak valid. Hanya file PDF dan TXT yang diizinkan.')
        return
      }

      // Validate file size (10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        setInvitationStatus('error')
        setStatusMessage('Ukuran file melebihi batas 10MB')
        return
      }

      setInstitutionRagFile(file)
      setInvitationStatus('idle')
    }
  }

  // Handle new RAG file select for replacement
  const handleNewRagFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'text/plain']
      if (!allowedTypes.includes(file.type)) {
        setInvitationStatus('error')
        setStatusMessage('Tipe file tidak valid. Hanya file PDF dan TXT yang diizinkan.')
        return
      }

      // Validate file size (10MB)
      const maxSize = 10 * 1024 * 1024
      if (file.size > maxSize) {
        setInvitationStatus('error')
        setStatusMessage('Ukuran file melebihi batas 10MB')
        return
      }

      setNewRagFile(file)
      setInvitationStatus('idle')
    }
  }

  // Handle RAG file replacement
  const handleReplaceRagFile = async () => {
    if (!newRagFile || !editingRagFile || !selectedInstitution) return

    try {
      setUploading(true)
      setInvitationStatus('idle')

      // Upload new file first
      const formData = new FormData()
      formData.append('file', newRagFile)
      formData.append('institutionId', selectedInstitution.institutionId.toString())
      formData.append('description', newRagDescription)

      const uploadResponse = await fetch('/api/admin/upload-rag-file', {
        method: 'POST',
        body: formData,
      })

      const uploadResult = await uploadResponse.json()

      if (!uploadResponse.ok) {
        throw new Error(uploadResult.error ?? 'Failed to upload new file')
      }

      // Update RAG file record with new file details
      const updateResponse = await fetch(
        `/api/admin/institutions/${selectedInstitution.institutionId}/rag-files/${editingRagFile.ragFileId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: uploadResult.data.fileName,
            fileType: uploadResult.data.fileType,
            filePath: uploadResult.data.filePath,
            fileSize: uploadResult.data.fileSize,
            description: newRagDescription || editingRagFile.description,
            processingStatus: 'pending',
          }),
        },
      )

      const updateResult = await updateResponse.json()

      if (!updateResponse.ok) {
        throw new Error(updateResult.error ?? 'Failed to update RAG file record')
      }

      setInvitationStatus('success')
      setStatusMessage(`File RAG "${uploadResult.data.fileName}" berhasil diganti`)

      // Reset form
      setNewRagFile(null)
      setNewRagDescription('')
      setEditingRagFile(null)
      setReplaceRagDialogOpen(false)

      // Refresh institutions data and RAG files
      await fetchInstitutions()
      if (selectedInstitution) {
        await fetchRagFiles(selectedInstitution.institutionId)
      }
    } catch (error) {
      setInvitationStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Gagal mengganti file RAG')
    } finally {
      setUploading(false)
    }
  }

  // Handle RAG file deletion
  const handleDeleteRagFile = async (ragFile: RagFile) => {
    if (!selectedInstitution || !window.confirm(`Apakah Anda yakin ingin menghapus file "${ragFile.fileName}"?`)) {
      return
    }

    try {
      setInvitationStatus('idle')
      const response = await fetch(
        `/api/admin/institutions/${selectedInstitution.institutionId}/rag-files/${ragFile.ragFileId}`,
        {
          method: 'DELETE',
        },
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error ?? 'Failed to delete RAG file')
      }

      setInvitationStatus('success')
      setStatusMessage(`File RAG "${ragFile.fileName}" berhasil dihapus`)

      // Refresh institutions data and RAG files
      await fetchInstitutions()
      if (selectedInstitution) {
        await fetchRagFiles(selectedInstitution.institutionId)
      }
    } catch (error) {
      setInvitationStatus('error')
      setStatusMessage(error instanceof Error ? error.message : 'Gagal menghapus file RAG')
    }
  }

  const getRoleIcon = (userRole: string) => {
    return userRole === 'superadmin' ? (
      <Crown className="h-4 w-4 text-amber-600" />
    ) : (
      <Shield className="h-4 w-4 text-blue-600" />
    )
  }

  const getRoleBadge = (userRole: string) => {
    return userRole === 'superadmin' ? (
      <Badge variant="secondary" className="border-amber-200 bg-amber-50 text-amber-700">
        <Crown className="mr-1 h-3 w-3" />
        Super Admin
      </Badge>
    ) : (
      <Badge variant="secondary" className="border-blue-200 bg-blue-50 text-blue-700">
        <Shield className="mr-1 h-3 w-3" />
        Admin
      </Badge>
    )
  }

  const getStatusBadge = (status: string) => {
    return status === 'active' ? (
      <Badge variant="secondary" className="border-green-200 bg-green-50 text-green-700">
        <CheckCircle className="mr-1 h-3 w-3" />
        Aktif
      </Badge>
    ) : (
      <Badge variant="secondary" className="border-gray-200 bg-gray-50 text-gray-700">
        <XCircle className="mr-1 h-3 w-3" />
        Tidak Aktif
      </Badge>
    )
  }

  const formatDate = (date: string | Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date))
  }

  const formatLastActive = (date: string | Date | null) => {
    if (!date) return 'Tidak Pernah'
    try {
      const now = new Date()
      const lastActive = new Date(date)
      const diffInMs = now.getTime() - lastActive.getTime()
      const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24))

      if (diffInDays === 0) {
        return 'Hari Ini'
      } else if (diffInDays === 1) {
        return '1 hari yang lalu'
      } else if (diffInDays < 7) {
        return `${diffInDays} hari yang lalu`
      } else {
        return formatDate(date)
      }
    } catch {
      return 'Tidak Diketahui'
    }
  }

  if (loading) {
    return (
      <div className="bg-background min-h-screen">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="text-primary h-8 w-8 animate-spin" />
            <span className="text-muted-foreground ml-3 text-lg font-medium">Memuat dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-background min-h-screen">
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard Admin</h1>
            <p className="text-muted-foreground mt-2">Kelola administrator dan monitor kesehatan sistem</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => void fetchAdminData()} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Perbarui
            </Button>
          </div>
        </div>

        {/* Alerts */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {invitationStatus !== 'idle' && (
          <Alert variant={invitationStatus === 'success' ? 'default' : 'destructive'}>
            <AlertDescription>{statusMessage}</AlertDescription>
          </Alert>
        )}

        {/* Main Content - Clean Grid Layout */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Grafana Link Card - Fixed and Centered */}
          <Card className="lg:sticky lg:top-8 lg:col-span-1 lg:self-start">
            <CardContent className="flex min-h-[280px] items-center justify-center p-6">
              <div className="w-full space-y-4 text-center">
                <div className="bg-primary/10 mx-auto flex h-16 w-16 items-center justify-center rounded-full">
                  <Activity className="text-primary h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold">Monitoring</h3>
                  <p className="text-muted-foreground mt-2 text-sm leading-relaxed">
                    Analitik lanjutan & metrik sistem
                  </p>
                </div>
                <Button className="w-full" size="lg" asChild>
                  <a
                    href={process.env.NEXT_PUBLIC_GRAFANA_URL ?? 'http://localhost:3030'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Buka Grafana
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Limited Access Card for Admin (Non-SuperAdmin) */}
          {isAdmin && !isSuperAdmin && (
            <Card className="lg:col-span-3">
              <CardContent className="flex items-center justify-center p-8">
                <div className="max-w-md text-center">
                  <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                    <Shield className="h-6 w-6 text-red-600" />
                  </div>
                  <h2 className="mb-2 text-lg font-semibold text-red-600">Akses Terbatas</h2>
                  <p className="mb-4 text-sm text-gray-600">
                    Anda memerlukan hak akses superadmin untuk mengakses area manajemen administrator.
                  </p>
                  <div className="space-y-1 text-xs text-gray-500">
                    <div className="flex items-center justify-center gap-2">
                      <Crown className="h-3 w-3 text-yellow-600" />
                      <span>SuperAdmin: Akses penuh sistem</span>
                    </div>
                    <div className="flex items-center justify-center gap-2">
                      <Shield className="h-3 w-3 text-blue-600" />
                      <span>Admin: Akses terbatas sistem</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Admin Management Actions - SuperAdmin Only */}
          {isSuperAdmin && (
            <Card className="lg:col-span-3">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="text-primary h-5 w-5" />
                      Manajemen Administrator
                    </CardTitle>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {admins.length} administrator{admins.length !== 1 ? '' : ''} aktif saat ini
                    </p>
                  </div>
                  {isSuperAdmin && (
                    <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <UserPlus className="mr-2 h-4 w-4" />
                          Undang Admin
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]">
                        <DialogHeader>
                          <DialogTitle>Undang Administrator Baru</DialogTitle>
                          <DialogDescription>
                            Kirim email undangan untuk menambahkan administrator baru ke sistem.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="invite-email">Alamat Email</Label>
                              <Input
                                id="invite-email"
                                type="email"
                                placeholder="admin@tunarasa.com"
                                value={inviteEmail}
                                onChange={(e) => setInviteEmail(e.target.value)}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="invite-role">Role</Label>
                              <Select
                                value={inviteRole}
                                onValueChange={(value: 'admin' | 'superadmin') => setInviteRole(value)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Pilih peran" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="admin">Admin</SelectItem>
                                  <SelectItem value="superadmin">Super Admin</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="custom-message">Pesan Kustom (Opsional)</Label>
                            <Textarea
                              id="custom-message"
                              placeholder="Tambahkan pesan pribadi ke email undangan..."
                              value={customMessage}
                              onChange={(e) => setCustomMessage(e.target.value)}
                              rows={3}
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setInviteDialogOpen(false)} disabled={isInviting}>
                              Batal
                            </Button>
                            <Button onClick={() => void handleSendInvitation()} disabled={!inviteEmail || isInviting}>
                              {isInviting ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Mengirim...
                                </>
                              ) : (
                                <>
                                  <Send className="mr-2 h-4 w-4" />
                                  Kirim Undangan
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
              </CardHeader>
              <CardContent className="h-[200px] overflow-hidden p-6">
                <div className="h-full">
                  <div className="mb-3 border-t pt-3">
                    <h3 className="mb-2 text-lg font-semibold">Administrator Saat Ini</h3>
                    <p className="text-muted-foreground mb-3 text-sm">
                      Semua administrator sistem dengan peran, status, dan informasi aktivitas mereka
                    </p>
                  </div>

                  {admins.length === 0 ? (
                    <div className="flex h-[120px] items-center justify-center">
                      <div className="text-center">
                        <Shield className="text-muted-foreground/40 mx-auto mb-2 h-8 w-8" />
                        <h3 className="mb-1 text-sm font-semibold">Tidak ada administrator ditemukan</h3>
                        <p className="text-muted-foreground text-xs">
                          Tidak ada administrator yang dikonfigurasi dalam sistem.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-[120px] overflow-hidden rounded-md border">
                      <div className="h-full overflow-y-auto pb-1">
                        <Table className="relative">
                          <TableHeader className="supports-[backdrop-filter]:bg-background/95 bg-background/95 sticky top-0 z-10 backdrop-blur">
                            <TableRow className="border-b">
                              <TableHead className="h-8 px-2 text-xs font-medium">Nama</TableHead>
                              <TableHead className="h-8 px-2 text-xs font-medium">Email</TableHead>
                              <TableHead className="h-8 px-2 text-xs font-medium">Peran</TableHead>
                              <TableHead className="h-8 px-2 text-xs font-medium">Status</TableHead>
                              <TableHead className="h-8 px-2 text-xs font-medium">Terakhir Aktif</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {admins.map((admin, _index) => (
                              <TableRow key={admin.id} className="border-b last:border-0">
                                <TableCell className="h-10 px-2 py-1">
                                  <div className="flex items-center gap-2">
                                    {getRoleIcon(admin.role)}
                                    <div className="min-w-0 flex-1">
                                      <div className="truncate text-xs font-medium">
                                        {admin.fullName ??
                                          (`${admin.firstName ?? ''} ${admin.lastName ?? ''}`.trim() ||
                                            'Pengguna Tanpa Nama')}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="h-10 px-2 py-1">
                                  <div className="truncate font-mono text-xs">{admin.email}</div>
                                </TableCell>
                                <TableCell className="h-10 px-2 py-1">{getRoleBadge(admin.role)}</TableCell>
                                <TableCell className="h-10 px-2 py-1">{getStatusBadge(admin.status)}</TableCell>
                                <TableCell className="h-10 px-2 py-1">
                                  <div className="text-muted-foreground text-xs">
                                    {formatLastActive(admin.lastActive)}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                            {/* Add spacer row for better scroll experience */}
                            {admins.length > 0 && (
                              <TableRow className="h-2">
                                <TableCell colSpan={5} className="h-2 p-0"></TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* QA Logs Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="text-primary h-5 w-5" />
                  QA Logs & System Monitoring
                </CardTitle>
                <p className="text-muted-foreground mt-1 text-sm">
                  Question & Answer logs from the communication system with performance metrics
                </p>
              </div>
              <Button
                variant={showQaLogs ? 'secondary' : 'outline'}
                onClick={() => setShowQaLogs(!showQaLogs)}
                className="flex items-center gap-2"
              >
                {showQaLogs ? 'Sembunyikan Log QA' : 'Lihat Log QA'}
              </Button>
            </div>
          </CardHeader>

          {showQaLogs && (
            <CardContent className="space-y-6">
              {/* Statistics Cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{qaLogsStatistics.totalLogs}</div>
                    <p className="text-muted-foreground text-xs">Total Log</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{qaLogsStatistics.averageConfidence}%</div>
                    <p className="text-muted-foreground text-xs">Rata-rata Kepercayaan</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-orange-600">{qaLogsStatistics.averageResponseTime}ms</div>
                    <p className="text-muted-foreground text-xs">Rata-rata Respons</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Bot className="h-4 w-4 text-purple-600" />
                      <div className="text-2xl font-bold text-purple-600">{qaLogsStatistics.llmResponses}</div>
                    </div>
                    <p className="text-muted-foreground text-xs">Respons LLM</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <User className="h-4 w-4 text-indigo-600" />
                      <div className="text-2xl font-bold text-indigo-600">{qaLogsStatistics.adminResponses}</div>
                    </div>
                    <p className="text-muted-foreground text-xs">Respons Admin</p>
                  </CardContent>
                </Card>
              </div>

              {/* Filters */}
              <div className="bg-muted/50 flex flex-wrap items-center gap-4 rounded-lg border p-4">
                <div className="flex items-center gap-2">
                  <Search className="text-muted-foreground h-4 w-4" />
                  <Input
                    placeholder="Cari pertanyaan/jawaban..."
                    value={qaLogsFilters.searchQuery}
                    onChange={(e) => setQaLogsFilters({ ...qaLogsFilters, searchQuery: e.target.value })}
                    className="w-64"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Filter className="text-muted-foreground h-4 w-4" />
                  <Select
                    value={qaLogsFilters.serviceMode}
                    onValueChange={(value) => setQaLogsFilters({ ...qaLogsFilters, serviceMode: value })}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Semua Mode Layanan" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Mode Layanan</SelectItem>
                      <SelectItem value="full_llm_bot">Full LLM Bot</SelectItem>
                      <SelectItem value="bot_with_admin_validation">Bot + Validasi Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <User className="text-muted-foreground h-4 w-4" />
                  <Select
                    value={qaLogsFilters.respondedBy}
                    onValueChange={(value) => setQaLogsFilters({ ...qaLogsFilters, respondedBy: value })}
                  >
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="Semua Respons" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua Respons</SelectItem>
                      <SelectItem value="llm">Hanya LLM</SelectItem>
                      <SelectItem value="admin">Hanya Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  size="sm"
                  onClick={() => void fetchQaLogs(1)}
                  disabled={qaLogsLoading}
                  className="flex items-center gap-2"
                >
                  {qaLogsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  Terapkan Filter
                </Button>
              </div>

              {/* QA Logs Table */}
              {qaLogsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-primary h-8 w-8 animate-spin" />
                  <span className="text-muted-foreground ml-3">Memuat log QA...</span>
                </div>
              ) : qaLogs.length === 0 ? (
                <div className="py-12 text-center">
                  <MessageSquare className="text-muted-foreground/40 mx-auto mb-4 h-12 w-12" />
                  <h3 className="mb-2 text-lg font-semibold">Tidak ada log QA ditemukan</h3>
                  <p className="text-muted-foreground">
                    {Object.values(qaLogsFilters).some(Boolean)
                      ? 'Tidak ada log yang cocok dengan filter saat ini. Coba sesuaikan kriteria pencarian.'
                      : 'Belum ada log pertanyaan & jawaban yang tercatat.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-[300px]">Pertanyaan</TableHead>
                          <TableHead className="w-[300px]">Jawaban</TableHead>
                          <TableHead className="w-[100px]">Kepercayaan</TableHead>
                          <TableHead className="w-[100px]">Waktu Respons</TableHead>
                          <TableHead className="w-[120px]">Mode Layanan</TableHead>
                          <TableHead className="w-[100px]">Dijawab Oleh</TableHead>
                          <TableHead className="w-[140px]">Waktu</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {qaLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <div className="max-w-[280px] truncate text-sm">{log.question}</div>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-[280px] truncate text-sm">{log.answer}</div>
                            </TableCell>
                            <TableCell>
                              {log.confidence !== null && log.confidence !== undefined ? (
                                <Badge
                                  variant={
                                    log.confidence >= 80 ? 'default' : log.confidence >= 60 ? 'secondary' : 'outline'
                                  }
                                  className="font-mono text-xs"
                                >
                                  {log.confidence}%
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {log.responseTime ? (
                                <div className="flex items-center gap-1">
                                  <Clock className="text-muted-foreground h-3 w-3" />
                                  <span className="font-mono text-xs">{log.responseTime}ms</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {log.serviceMode === 'full_llm_bot' ? 'Full LLM' : 'LLM + Admin'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                {log.respondedBy === 'llm' ? (
                                  <>
                                    <Bot className="h-3 w-3 text-purple-600" />
                                    <span className="text-xs text-purple-600">LLM</span>
                                  </>
                                ) : (
                                  <>
                                    <User className="h-3 w-3 text-indigo-600" />
                                    <span className="text-xs text-indigo-600">Admin</span>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-muted-foreground text-xs">{formatDate(log.createdAt)}</div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {qaLogsPagination.totalPages > 1 && (
                    <div className="flex items-center justify-between">
                      <p className="text-muted-foreground text-sm">
                        Menampilkan {qaLogs.length} dari {qaLogsPagination.total} log
                      </p>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!qaLogsPagination.hasPrevPage || qaLogsLoading}
                          onClick={() => void fetchQaLogs(qaLogsPage - 1)}
                        >
                          Sebelumnya
                        </Button>
                        <span className="text-muted-foreground text-sm">
                          Halaman {qaLogsPagination.page} dari {qaLogsPagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={!qaLogsPagination.hasNextPage || qaLogsLoading}
                          onClick={() => void fetchQaLogs(qaLogsPage + 1)}
                        >
                          Berikutnya
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Institution Management Section - SuperAdmin Only */}
        {isSuperAdmin && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building className="text-primary h-5 w-5" />
                    Manajemen Institusi & RAG
                  </CardTitle>
                  <p className="text-muted-foreground mt-1 text-sm">Kelola institusi dan file knowledge base RAG</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant={showInstitutions ? 'secondary' : 'outline'}
                    onClick={() => {
                      setShowInstitutions(!showInstitutions)
                      if (!showInstitutions) {
                        void fetchInstitutions()
                      }
                    }}
                    className="flex items-center gap-2"
                  >
                    <Building className="h-4 w-4" />
                    {showInstitutions ? 'Sembunyikan Institusi' : 'Kelola Institusi'}
                  </Button>
                  {selectedInstitution && (
                    <div className="flex items-center gap-2">
                      <Button
                        variant={showRagFiles ? 'secondary' : 'outline'}
                        onClick={() => {
                          setShowRagFiles(!showRagFiles)
                          if (!showRagFiles && selectedInstitution) {
                            setRagFiles([]) // Clear previous data
                            void fetchRagFiles(selectedInstitution.institutionId)
                          }
                        }}
                        className="flex items-center gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        {showRagFiles ? 'Sembunyikan File RAG' : 'Lihat File RAG'}
                      </Button>

                      {/* Upload button removed - now integrated with institution creation form */}
                    </div>
                  )}
                </div>
              </div>
            </CardHeader>

            {showInstitutions && (
              <CardContent className="space-y-6">
                {/* Institution Statistics */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-blue-600">{institutions.length}</div>
                      <p className="text-muted-foreground text-xs">Total Institusi</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {institutions.filter((i) => i.isActive).length}
                      </div>
                      <p className="text-muted-foreground text-xs">Institusi Aktif</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {selectedInstitution?._count?.ragFiles ?? 0}
                      </div>
                      <p className="text-muted-foreground text-xs">File RAG Institusi</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Add Institution Button */}
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Institusi</h3>
                  <Dialog open={institutionDialogOpen} onOpenChange={setInstitutionDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setEditingInstitution(null)
                          setInstitutionName('')
                          setInstitutionSlug('')
                          setInstitutionDescription('')
                          setInstitutionRagFile(null)
                          setInstitutionRagDescription('')
                          setInvitationStatus('idle')
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Tambah Institusi
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px]">
                      <DialogHeader>
                        <DialogTitle>{editingInstitution ? 'Edit' : 'Tambah'} Institusi</DialogTitle>
                        <DialogDescription>
                          {editingInstitution
                            ? 'Perbarui detail institusi'
                            : 'Buat institusi baru dengan file RAG knowledge base'}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="institution-name">Nama Institusi</Label>
                          <Input
                            id="institution-name"
                            placeholder="e.g., Dinas Kependudukan Yogyakarta"
                            value={institutionName}
                            onChange={(e) => {
                              setInstitutionName(e.target.value)
                              // Auto-generate slug
                              const slug = e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9\s-]/g, '')
                                .replace(/\s+/g, '-')
                                .replace(/-+/g, '-')
                                .trim()
                              setInstitutionSlug(slug)
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="institution-slug">Slug URL</Label>
                          <Input
                            id="institution-slug"
                            placeholder="e.g., disdukcapil-yogya"
                            value={institutionSlug}
                            onChange={(e) => setInstitutionSlug(e.target.value)}
                          />
                          <p className="text-muted-foreground text-xs">
                            Akan digunakan dalam URL: /komunikasi/{institutionSlug}
                          </p>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="institution-description">Deskripsi (Opsional)</Label>
                          <Textarea
                            id="institution-description"
                            placeholder="Deskripsi singkat layanan yang disediakan institusi ini..."
                            value={institutionDescription}
                            onChange={(e) => setInstitutionDescription(e.target.value)}
                            rows={3}
                          />
                        </div>

                        {/* RAG File Upload Section - Only for new institutions */}
                        {!editingInstitution && (
                          <div className="border-t pt-4">
                            <h4 className="mb-3 text-sm font-semibold">File Knowledge Base (Opsional)</h4>
                            <div className="space-y-3">
                              <div className="space-y-2">
                                <Label htmlFor="institution-rag-file">File RAG (PDF/TXT - Maks 10MB)</Label>
                                <input
                                  id="institution-rag-file"
                                  type="file"
                                  accept=".pdf,.txt"
                                  onChange={handleInstitutionRagFileSelect}
                                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                />
                                {institutionRagFile && (
                                  <p className="text-sm text-green-600">
                                    File terpilih: {institutionRagFile.name} (
                                    {Math.round(institutionRagFile.size / 1024)} KB)
                                  </p>
                                )}
                              </div>

                              {institutionRagFile && (
                                <div className="space-y-2">
                                  <Label htmlFor="institution-rag-description">Deskripsi File RAG (Opsional)</Label>
                                  <Textarea
                                    id="institution-rag-description"
                                    placeholder="Deskripsi singkat tentang konten file ini..."
                                    value={institutionRagDescription}
                                    onChange={(e) => setInstitutionRagDescription(e.target.value)}
                                    rows={2}
                                  />
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            onClick={() => setInstitutionDialogOpen(false)}
                            disabled={isInviting}
                          >
                            Batal
                          </Button>
                          <Button
                            onClick={() => void handleSaveInstitution()}
                            disabled={!institutionName.trim() || !institutionSlug.trim() || isInviting}
                          >
                            {isInviting ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                              </>
                            ) : (
                              <>
                                <Plus className="mr-2 h-4 w-4" />
                                {editingInstitution ? 'Perbarui' : 'Buat'} Institusi
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Institutions List */}
                {institutionLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="text-primary h-8 w-8 animate-spin" />
                    <span className="text-muted-foreground ml-3">Memuat institusi...</span>
                  </div>
                ) : institutions.length === 0 ? (
                  <div className="py-12 text-center">
                    <Building className="text-muted-foreground/40 mx-auto mb-4 h-12 w-12" />
                    <h3 className="mb-2 text-lg font-semibold">Tidak ada institusi ditemukan</h3>
                    <p className="text-muted-foreground">Buat institusi pertama Anda untuk mulai mengelola file RAG.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {institutions.map((institution) => (
                      <Card
                        key={institution.institutionId}
                        className={`cursor-pointer transition-all hover:shadow-md ${
                          selectedInstitution?.institutionId === institution.institutionId
                            ? 'border-primary bg-primary/5'
                            : ''
                        }`}
                        onClick={() => {
                          setSelectedInstitution(institution)
                          setRagFiles([]) // Clear previous RAG files
                          setShowRagFiles(false) // Reset RAG files visibility
                        }}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="font-semibold">{institution.name}</h4>
                              <p className="text-muted-foreground mb-2 text-sm">/{institution.slug}</p>
                              {institution.description && (
                                <p className="text-muted-foreground mb-3 line-clamp-2 text-xs">
                                  {institution.description}
                                </p>
                              )}
                              <div className="text-muted-foreground flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1">
                                  <FileText className="h-3 w-3" />
                                  {institution._count?.ragFiles ?? 0} file
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3 w-3" />
                                  {institution._count?.conversations ?? 0} chats
                                </span>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2">
                              <Badge variant={institution.isActive ? 'default' : 'secondary'}>
                                {institution.isActive ? 'Aktif' : 'Tidak Aktif'}
                              </Badge>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingInstitution(institution)
                                    setInstitutionName(institution.name)
                                    setInstitutionSlug(institution.slug)
                                    setInstitutionDescription(institution.description ?? '')
                                    setInstitutionDialogOpen(true)
                                  }}
                                >
                                  <Edit className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {/* RAG Files Section */}
                {showRagFiles && selectedInstitution && (
                  <div className="space-y-4">
                    <div className="border-t pt-6">
                      <h4 className="mb-4 text-lg font-semibold">File RAG</h4>

                      {_ragFiles.length === 0 ? (
                        <div className="py-8 text-center">
                          <FileText className="text-muted-foreground/40 mx-auto mb-4 h-12 w-12" />
                          <h3 className="mb-2 text-lg font-semibold">Belum ada file RAG</h3>
                          <p className="text-muted-foreground">Unggah file PDF atau TXT pertama untuk institusi ini.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          {_ragFiles.map((ragFile) => (
                            <Card key={ragFile.ragFileId} className="p-4">
                              <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                  <div className="mb-2 flex items-center gap-2">
                                    <FileText className="h-4 w-4 flex-shrink-0 text-blue-600" />
                                    <span className="truncate text-sm font-medium">{ragFile.fileName}</span>
                                    <Badge
                                      variant={ragFile.fileType === 'pdf' ? 'default' : 'secondary'}
                                      className="text-xs"
                                    >
                                      {ragFile.fileType.toUpperCase()}
                                    </Badge>
                                  </div>

                                  {ragFile.description && (
                                    <p className="text-muted-foreground mb-2 line-clamp-2 text-xs">
                                      {ragFile.description}
                                    </p>
                                  )}

                                  <div className="text-muted-foreground flex items-center gap-4 text-xs">
                                    {ragFile.fileSize && <span>{Math.round(ragFile.fileSize / 1024)} KB</span>}
                                    <Badge
                                      variant={
                                        ragFile.processingStatus === 'completed'
                                          ? 'default'
                                          : ragFile.processingStatus === 'failed'
                                            ? 'destructive'
                                            : 'secondary'
                                      }
                                      className="text-xs"
                                    >
                                      {ragFile.processingStatus === 'pending' && 'Menunggu'}
                                      {ragFile.processingStatus === 'processing' && 'Memproses'}
                                      {ragFile.processingStatus === 'completed' && 'Selesai'}
                                      {ragFile.processingStatus === 'failed' && 'Gagal'}
                                    </Badge>
                                  </div>
                                </div>

                                <div className="ml-2 flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    title="Ganti File RAG"
                                    onClick={() => {
                                      setEditingRagFile(ragFile)
                                      setNewRagFile(null)
                                      setNewRagDescription(ragFile.description ?? '')
                                      setReplaceRagDialogOpen(true)
                                    }}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0"
                                    title="Hapus File RAG"
                                    onClick={() => void handleDeleteRagFile(ragFile)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        )}

        {/* Replace RAG File Dialog */}
        <Dialog open={replaceRagDialogOpen} onOpenChange={setReplaceRagDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Ganti File RAG</DialogTitle>
              <DialogDescription>
                Ganti file RAG &quot;{editingRagFile?.fileName}&quot; dengan file baru
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-rag-file">File Baru (PDF/TXT - Maks 10MB)</Label>
                <input
                  id="new-rag-file"
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleNewRagFileSelect}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
                {newRagFile && (
                  <p className="text-sm text-green-600">
                    File terpilih: {newRagFile.name} ({Math.round(newRagFile.size / 1024)} KB)
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-rag-description">Deskripsi (Opsional)</Label>
                <Textarea
                  id="new-rag-description"
                  placeholder="Deskripsi singkat tentang konten file ini..."
                  value={newRagDescription}
                  onChange={(e) => setNewRagDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setReplaceRagDialogOpen(false)} disabled={uploading}>
                  Batal
                </Button>
                <Button onClick={() => void handleReplaceRagFile()} disabled={!newRagFile || uploading}>
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mengganti...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Ganti File
                    </>
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}

// Wrap the dashboard with AdminOnly protection
export default function AdminDashboard() {
  const [isMounted, setIsMounted] = useState(false)

  // Client-side mounting check
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Prevent server-side rendering of auth hooks
  if (!isMounted) {
    return (
      <div className="bg-background flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="border-primary mx-auto h-8 w-8 animate-spin rounded-full border-b-2"></div>
          <p className="text-muted-foreground mt-2">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <AdminOnly>
      <DashboardContent />
    </AdminOnly>
  )
}
