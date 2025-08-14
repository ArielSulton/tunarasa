import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { ragFiles } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { isAdminOrSuperAdmin } from '@/lib/auth/supabase-auth'
import fs from 'fs/promises'
import path from 'path'

// PUT /api/admin/institutions/[id]/rag-files/[ragFileId] - Update RAG file
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string; ragFileId: string }> }) {
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

    const institutionId = parseInt(resolvedParams.id)
    const ragFileId = parseInt(resolvedParams.ragFileId)

    if (isNaN(institutionId) || isNaN(ragFileId)) {
      return NextResponse.json({ error: 'Invalid institution ID or RAG file ID' }, { status: 400 })
    }

    // Verify RAG file exists and belongs to the institution
    const existingFile = await db
      .select()
      .from(ragFiles)
      .where(and(eq(ragFiles.ragFileId, ragFileId), eq(ragFiles.institutionId, institutionId)))
      .limit(1)

    if (existingFile.length === 0) {
      return NextResponse.json({ error: 'RAG file not found' }, { status: 404 })
    }

    const body = await request.json()
    const { fileName, fileType, filePath, fileSize, description, processingStatus } = body

    // Build update object with only provided fields
    const updateData: Partial<typeof ragFiles.$inferInsert> = {}
    if (fileName) updateData.fileName = fileName
    if (fileType) updateData.fileType = fileType
    if (filePath) updateData.filePath = filePath
    if (fileSize !== undefined) updateData.fileSize = fileSize
    if (description !== undefined) updateData.description = description
    if (processingStatus) updateData.processingStatus = processingStatus

    // Always update the updatedAt timestamp
    updateData.updatedAt = new Date()

    // Update the RAG file record
    const [updatedRagFile] = await db
      .update(ragFiles)
      .set(updateData)
      .where(eq(ragFiles.ragFileId, ragFileId))
      .returning()

    // If we're updating the file (new filePath provided), remove the old file
    if (filePath && existingFile[0].filePath !== filePath) {
      try {
        const oldFilePath = path.join(process.cwd(), 'uploads', existingFile[0].filePath)
        await fs.unlink(oldFilePath).catch(() => {
          // Ignore if old file doesn't exist
        })
      } catch (error) {
        console.warn('Failed to remove old file:', error)
      }
    }

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

// DELETE /api/admin/institutions/[id]/rag-files/[ragFileId] - Delete RAG file
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; ragFileId: string }> },
) {
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

    const institutionId = parseInt(resolvedParams.id)
    const ragFileId = parseInt(resolvedParams.ragFileId)

    if (isNaN(institutionId) || isNaN(ragFileId)) {
      return NextResponse.json({ error: 'Invalid institution ID or RAG file ID' }, { status: 400 })
    }

    // Verify RAG file exists and belongs to the institution
    const existingFile = await db
      .select()
      .from(ragFiles)
      .where(and(eq(ragFiles.ragFileId, ragFileId), eq(ragFiles.institutionId, institutionId)))
      .limit(1)

    if (existingFile.length === 0) {
      return NextResponse.json({ error: 'RAG file not found' }, { status: 404 })
    }

    // Delete the RAG file record from database
    await db.delete(ragFiles).where(eq(ragFiles.ragFileId, ragFileId))

    // Remove the physical file
    try {
      const filePath = path.join(process.cwd(), 'uploads', existingFile[0].filePath)
      await fs.unlink(filePath).catch(() => {
        // Ignore if file doesn't exist
      })
    } catch (error) {
      console.warn('Failed to remove physical file:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'RAG file deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting RAG file:', error)
    return NextResponse.json({ error: 'Failed to delete RAG file' }, { status: 500 })
  }
}
