import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { isAdminOrSuperAdmin } from '@/lib/auth/supabase-auth'

export const runtime = 'nodejs'
export const maxDuration = 15

// Timeout helper function
function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Operation timeout')), timeoutMs)),
  ])
}

// POST /api/admin/upload-rag-file - Upload PDF/TXT file for RAG
export async function POST(request: NextRequest) {
  try {
    // Create Supabase client for server-side auth
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      },
    )

    // Get current user from Supabase auth with timeout
    const {
      data: { user },
      error: authError,
    } = await withTimeout(supabase.auth.getUser(), 5000)

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await withTimeout(isAdminOrSuperAdmin(user.id), 3000)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 })
    }

    const formData = await withTimeout(request.formData(), 10000)
    const file = formData.get('file') as File
    const institutionId = formData.get('institutionId') as string
    const description = formData.get('description') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!institutionId || isNaN(parseInt(institutionId))) {
      return NextResponse.json({ error: 'Valid institution ID is required' }, { status: 400 })
    }

    // Validate file type (more permissive for TXT files)
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'text/txt',
      'application/octet-stream', // Some browsers detect .txt as this
    ]

    // Additional validation: check file extension for .txt files
    const fileExtension = file.name.toLowerCase().split('.').pop()
    const isValidTxt = fileExtension === 'txt' || fileExtension === 'text'
    const isValidPdf = fileExtension === 'pdf'

    if (!allowedTypes.includes(file.type) && !(isValidTxt || isValidPdf)) {
      console.log(`❌ File type rejected: ${file.type}, extension: ${fileExtension}`)
      return NextResponse.json(
        {
          error: `Invalid file type: ${file.type}. Only PDF and TXT files are allowed.`,
          details: `File: ${file.name}, Type: ${file.type}, Extension: ${fileExtension}`,
        },
        { status: 400 },
      )
    }

    // Override file type for proper detection
    if (isValidTxt && !file.type.startsWith('text/')) {
      console.log(`🔧 Overriding file type for ${file.name}: ${file.type} -> text/plain`)
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Create directory if it doesn't exist
    // Use shared uploads volume that both frontend and backend can access
    // In Docker: shared_uploads volume is mounted to /app/uploads
    const uploadDir =
      process.env.NODE_ENV === 'production' ? '/app/uploads/rag-files' : join(process.cwd(), 'uploads', 'rag-files')
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename
    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${originalName}`
    const filePath = join(uploadDir, fileName)

    // Save file to disk with timeout
    const bytes = await withTimeout(file.arrayBuffer(), 5000)
    const buffer = Buffer.from(bytes)
    await withTimeout(writeFile(filePath, buffer), 5000)

    // Determine file type based on extension (more reliable)
    const fileType = isValidPdf ? 'pdf' : 'txt'

    return NextResponse.json({
      success: true,
      data: {
        fileName: file.name,
        savedAs: fileName,
        filePath: `/uploads/rag-files/${fileName}`,
        fileType,
        fileSize: file.size,
        institutionId: parseInt(institutionId),
        description,
      },
    })
  } catch (error) {
    console.error('Error uploading file:', error)
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 })
  }
}
