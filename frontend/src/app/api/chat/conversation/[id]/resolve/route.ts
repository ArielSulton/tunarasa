import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { conversations, adminQueue, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'

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

    // Check authentication and admin role
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user is admin or superadmin
    const dbUser = await db
      .select()
      .from(users)
      .where(and(eq(users.clerkUserId, user.id), eq(users.isActive, true)))
      .limit(1)

    if (dbUser.length === 0) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    const userRole = dbUser[0].roleId
    if (userRole !== 1 && userRole !== 2) {
      // Not superadmin or admin
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

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
      resolvedBy: user.emailAddresses[0]?.emailAddress || user.id,
      resolvedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error resolving conversation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
