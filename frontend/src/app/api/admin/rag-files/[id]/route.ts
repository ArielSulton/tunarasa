import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { ragFiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isAdminOrSuperAdmin } from '@/lib/auth/supabase-auth'

// GET /api/admin/rag-files/[id] - Get specific RAG file
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
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

    const ragFileId = parseInt(resolvedParams.id)
    if (isNaN(ragFileId)) {
      return NextResponse.json({ error: 'Invalid RAG file ID' }, { status: 400 })
    }

    const ragFile = await db.select().from(ragFiles).where(eq(ragFiles.ragFileId, ragFileId)).limit(1)

    if (ragFile.length === 0) {
      return NextResponse.json({ error: 'RAG file not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ragFile: ragFile[0],
      },
    })
  } catch (error) {
    console.error('Error fetching RAG file:', error)
    return NextResponse.json({ error: 'Failed to fetch RAG file' }, { status: 500 })
  }
}

// PUT /api/admin/rag-files/[id] - Update RAG file
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
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

    const ragFileId = parseInt(resolvedParams.id)
    if (isNaN(ragFileId)) {
      return NextResponse.json({ error: 'Invalid RAG file ID' }, { status: 400 })
    }

    const body = await request.json()
    const { fileName, description, processingStatus, isActive } = body

    // Check if RAG file exists
    const existingRagFile = await db.select().from(ragFiles).where(eq(ragFiles.ragFileId, ragFileId)).limit(1)

    if (existingRagFile.length === 0) {
      return NextResponse.json({ error: 'RAG file not found' }, { status: 404 })
    }

    // Update the RAG file
    const [updatedRagFile] = await db
      .update(ragFiles)
      .set({
        fileName: fileName ?? existingRagFile[0].fileName,
        description,
        processingStatus: processingStatus ?? existingRagFile[0].processingStatus,
        isActive: isActive !== undefined ? isActive : existingRagFile[0].isActive,
        updatedAt: new Date(),
      })
      .where(eq(ragFiles.ragFileId, ragFileId))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        ragFile: updatedRagFile,
      },
    })
  } catch (error) {
    console.error('Error updating RAG file:', error)
    return NextResponse.json({ error: 'Failed to update RAG file' }, { status: 500 })
  }
}

// DELETE /api/admin/rag-files/[id] - Delete RAG file
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
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

    const ragFileId = parseInt(resolvedParams.id)
    if (isNaN(ragFileId)) {
      return NextResponse.json({ error: 'Invalid RAG file ID' }, { status: 400 })
    }

    // Soft delete by setting isActive to false
    const [deactivatedRagFile] = await db
      .update(ragFiles)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(ragFiles.ragFileId, ragFileId))
      .returning()

    if (!deactivatedRagFile) {
      return NextResponse.json({ error: 'RAG file not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        ragFile: deactivatedRagFile,
      },
    })
  } catch (error) {
    console.error('Error deleting RAG file:', error)
    return NextResponse.json({ error: 'Failed to delete RAG file' }, { status: 500 })
  }
}
