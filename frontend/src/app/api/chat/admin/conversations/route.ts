import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { conversations, messages, adminQueue } from '@/lib/db/schema'
import { eq, and, desc, count, sql, inArray } from 'drizzle-orm'

/**
 * Admin Conversations API
 *
 * GET: Fetch all conversations in queue with statistics
 */

export async function GET() {
  try {
    console.log('Admin conversations API: Starting request')

    // Check authentication and authorization - require admin access with timeout
    const startAuth = Date.now()
    try {
      await requireAdmin()
      console.log('Admin conversations API: Auth check took', Date.now() - startAuth, 'ms')
    } catch (authError) {
      console.error('Admin conversations API: Auth failed after', Date.now() - startAuth, 'ms:', authError)

      if (authError instanceof Error && authError.message.includes('Admin access required')) {
        return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
      }

      // For any other auth errors (DB timeout, etc.), return auth error
      return NextResponse.json({ error: 'Authentication timeout - please try again' }, { status: 408 })
    }

    // Get conversations with queue status (anonymous users) - limit to recent ones
    const startQuery = Date.now()
    const conversationsWithQueue = await Promise.race([
      db
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
        .where(
          and(
            eq(conversations.isActive, true),
            // Get conversations from both service modes for comprehensive admin view
            sql`conversations.service_mode IN ('bot_with_admin_validation', 'full_llm_bot')`,
            // Only get conversations from last 24 hours for better performance
            sql`conversations.created_at >= NOW() - INTERVAL '24 hours'`,
          ),
        )
        .orderBy(desc(conversations.lastMessageAt))
        .limit(20), // Reduce to 20 for faster loading

      // 8 second timeout for database query
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Database query timeout')), 8000)),
    ])

    console.log('Admin conversations API: Main query took', Date.now() - startQuery, 'ms')
    console.log('Admin conversations API: Found', conversationsWithQueue.length, 'conversations')

    // Get message counts and latest user message input method for each conversation
    const conversationIds = conversationsWithQueue.map((c) => c.conversationId)

    const startMessageQuery = Date.now()
    // Get counts and latest user message input method
    const messageCounts =
      conversationIds.length > 0
        ? await db
            .select({
              conversationId: messages.conversationId,
              count: count(),
            })
            .from(messages)
            .where(inArray(messages.conversationId, conversationIds))
            .groupBy(messages.conversationId)
        : []

    // Get latest user message input method for each conversation
    const latestUserMessages =
      conversationIds.length > 0
        ? await db
            .select({
              conversationId: messages.conversationId,
              inputMethod: messages.inputMethod,
            })
            .from(messages)
            .where(and(inArray(messages.conversationId, conversationIds), eq(messages.messageType, 'user')))
            .orderBy(desc(messages.createdAt))
        : []

    console.log('Admin conversations API: Message counts query took', Date.now() - startMessageQuery, 'ms')

    // Format conversations for frontend (anonymous users)
    const formattedConversations = conversationsWithQueue.map((conv) => {
      const messageInfo = messageCounts.find((mc) => mc.conversationId === conv.conversationId)
      const latestUserMessage = latestUserMessages.find((msg) => msg.conversationId === conv.conversationId)
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
        lastMessage: 'Click to view messages',
        lastMessageAt: conv.lastMessageAt ?? conv.createdAt,
        queuedAt: conv.queuedAt ?? conv.createdAt,
        messageCount: messageInfo?.count ?? 0,
        waitTime: Math.round(waitTime),
        assignedAdminId: conv.assignedAdminId,
        inputMethod: latestUserMessage?.inputMethod ?? 'text',
        serviceMode: conv.serviceMode,
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
          eq(conversations.serviceMode, 'bot_with_admin_validation'),
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

    console.log('Admin conversations API: Total request time', Date.now() - startAuth, 'ms')

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
