import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { isAdminOrSuperAdmin } from '@/lib/auth/supabase-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

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

    // Get current user from Supabase auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isAdminOrSuperAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    const institutionId = formData.get('institutionId') as string
    const description = formData.get('description') as string

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    if (!institutionId || isNaN(parseInt(institutionId))) {
      return NextResponse.json({ error: 'Valid institution ID is required' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'text/plain']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only PDF and TXT files are allowed.' }, { status: 400 })
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File size exceeds 10MB limit' }, { status: 400 })
    }

    // Create directory if it doesn't exist
    // Use shared uploads volume that both frontend and backend can access
    const uploadDir = join(process.cwd(), 'uploads', 'rag-files')
    await mkdir(uploadDir, { recursive: true })

    // Generate unique filename
    const timestamp = Date.now()
    const originalName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const fileName = `${timestamp}_${originalName}`
    const filePath = join(uploadDir, fileName)

    // Save file to disk
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Determine file type
    const fileType = file.type === 'application/pdf' ? 'pdf' : 'txt'

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
