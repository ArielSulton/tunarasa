import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { conversations, messages, adminQueue } from '@/lib/db/schema'
import { eq, and, desc, count, sql } from 'drizzle-orm'

/**
 * Admin Conversations API
 *
 * GET: Fetch all conversations in queue with statistics
 */

export async function GET() {
  try {
    // Check authentication and authorization - require admin access
    await requireAdmin()

    // Get conversations with queue status (anonymous users)
    const conversationsWithQueue = await db
      .select({
        conversationId: conversations.conversationId,
        sessionId: conversations.sessionId,
        userAgent: conversations.userAgent,
        ipAddress: conversations.ipAddress,
        serviceMode: conversations.serviceMode,
        status: conversations.status,
        priority: conversations.priority,
        lastMessageAt: conversations.lastMessageAt,
        createdAt: conversations.createdAt,
        queueStatus: adminQueue.status,
        queuedAt: adminQueue.queuedAt,
        assignedAdminId: adminQueue.assignedAdminId,
      })
      .from(conversations)
      .leftJoin(adminQueue, eq(conversations.conversationId, adminQueue.conversationId))
      .where(and(eq(conversations.isActive, true), eq(conversations.serviceMode, 'human_cs_support')))
      .orderBy(desc(conversations.lastMessageAt))

    // Get message counts for each conversation
    const conversationIds = conversationsWithQueue.map((c) => c.conversationId)

    const messageCounts =
      conversationIds.length > 0
        ? await db
            .select({
              conversationId: messages.conversationId,
              count: count(),
              lastMessage: sql<string>`(
          SELECT message_content
          FROM messages m2
          WHERE m2.conversation_id = messages.conversation_id
          ORDER BY m2.created_at DESC
          LIMIT 1
        )`,
            })
            .from(messages)
            .where(sql`conversation_id IN (${conversationIds.join(',')})`)
            .groupBy(messages.conversationId)
        : []

    // Format conversations for frontend (anonymous users)
    const formattedConversations = conversationsWithQueue.map((conv) => {
      const messageInfo = messageCounts.find((mc) => mc.conversationId === conv.conversationId)
      const waitTime = conv.queuedAt
        ? (Date.now() - new Date(conv.queuedAt).getTime()) / (1000 * 60)
        : (Date.now() - new Date(conv.createdAt).getTime()) / (1000 * 60)

      // Generate anonymous user display name based on session and IP
      const anonymousName = `User-${conv.sessionId.slice(-8)}`
      const userInfo =
        conv.ipAddress && conv.ipAddress !== 'Unknown' ? `${anonymousName} (${conv.ipAddress})` : anonymousName

      return {
        id: conv.conversationId.toString(),
        sessionId: conv.sessionId,
        userName: userInfo,
        userAgent: conv.userAgent ?? 'Unknown',
        status: conv.status || 'active',
        priority: conv.priority || 'normal',
        lastMessage: messageInfo?.lastMessage ?? 'No messages yet',
        lastMessageAt: conv.lastMessageAt ?? conv.createdAt,
        queuedAt: conv.queuedAt ?? conv.createdAt,
        messageCount: messageInfo?.count ?? 0,
        waitTime: Math.round(waitTime),
        assignedAdminId: conv.assignedAdminId,
      }
    })

    // Calculate statistics
    const totalConversations = conversationsWithQueue.length
    const waitingInQueue = conversationsWithQueue.filter(
      (c) => c.status === 'waiting' || c.queueStatus === 'waiting',
    ).length
    const activeConversations = conversationsWithQueue.filter(
      (c) => c.status === 'in_progress' || c.queueStatus === 'in_progress',
    ).length

    // Get today's resolved conversations count
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayResolvedQuery = await db
      .select({ count: count() })
      .from(conversations)
      .where(
        and(
          eq(conversations.serviceMode, 'human_cs_support'),
          eq(conversations.status, 'resolved'),
          sql`conversations.resolved_at >= ${today.toISOString()}`,
        ),
      )

    const todayResolved = todayResolvedQuery[0]?.count || 0

    // Calculate average response time (mock data for now)
    const averageResponseTime = Math.round(Math.random() * 5 + 2) // 2-7 minutes
    const averageResolutionTime = Math.round(Math.random() * 15 + 10) // 10-25 minutes

    const stats = {
      totalConversations,
      activeConversations,
      waitingInQueue,
      averageResponseTime,
      averageResolutionTime,
      todayResolved,
    }

    return NextResponse.json({
      success: true,
      conversations: formattedConversations,
      stats,
    })
  } catch (error) {
    console.error('Error fetching admin conversations:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
