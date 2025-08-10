import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { conversations, adminQueue } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Resolve Conversation API
 *
 * POST: Mark conversation as resolved and remove from admin queue
 */

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const conversationId = parseInt(params.id)

    if (isNaN(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
    }

    // Check authentication and authorization - require admin access
    const authUser = await requireAdmin()

    // Check if conversation exists
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.conversationId, conversationId))
      .limit(1)

    if (conversation.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Update conversation status to resolved
    await db
      .update(conversations)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(conversations.conversationId, conversationId))

    // Update admin queue status
    await db
      .update(adminQueue)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
      })
      .where(eq(adminQueue.conversationId, conversationId))

    return NextResponse.json({
      success: true,
      message: 'Conversation resolved successfully',
      conversationId,
      resolvedBy: authUser.email ?? authUser.full_name ?? authUser.supabase_user_id,
      resolvedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error resolving conversation:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
