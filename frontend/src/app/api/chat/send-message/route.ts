import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { conversations, messages, adminQueue } from '@/lib/db/schema'
import { eq, and, count, desc } from 'drizzle-orm'

/**
 * Send Message API (Anonymous Users)
 *
 * Handles message sending for both service modes with anonymous user support:
 * - full_llm_bot: Direct LLM processing (handled by frontend)
 * - human_cs_support: Route to admin queue
 *
 * No authentication required - users are anonymous with session-based tracking
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, sessionId, serviceMode, inputMethod = 'text' } = body

    if (!message || !sessionId) {
      return NextResponse.json(
        {
          error: 'Message and sessionId are required',
        },
        { status: 400 },
      )
    }

    // Get request metadata for anonymous session tracking
    const userAgent = req.headers.get('user-agent') ?? 'Unknown'
    const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'Unknown'

    // For full_llm_bot mode, this endpoint shouldn't be called
    // The frontend should handle LLM calls directly
    if (serviceMode === 'full_llm_bot') {
      return NextResponse.json(
        {
          error: 'Full LLM bot mode should be handled by frontend',
        },
        { status: 400 },
      )
    }

    // Human CS Support Mode Processing (Anonymous Users)
    if (serviceMode === 'human_cs_support') {
      // Check if conversation already exists for this anonymous session
      const existingConversation = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.sessionId, sessionId), eq(conversations.isActive, true)))
        .orderBy(desc(conversations.createdAt))
        .limit(1)

      let conversationId: number

      if (existingConversation.length === 0) {
        // Create new conversation for anonymous user
        const newConversation = await db
          .insert(conversations)
          .values({
            sessionId,
            userAgent,
            ipAddress,
            serviceMode: 'human_cs_support',
            status: 'waiting',
            lastMessageAt: new Date(),
          })
          .returning()

        conversationId = newConversation[0].conversationId

        // Add to admin queue
        await db.insert(adminQueue).values({
          conversationId,
          priority: 'normal',
          status: 'waiting',
        })
      } else {
        conversationId = existingConversation[0].conversationId
      }

      // Insert user message
      await db.insert(messages).values({
        conversationId,
        messageContent: message,
        messageType: 'user',
        inputMethod,
      })

      // Update conversation last message time
      await db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.conversationId, conversationId))

      // Get queue position
      const queuePosition = await db
        .select({ count: count() })
        .from(adminQueue)
        .where(
          and(
            eq(adminQueue.status, 'waiting'),
            eq(
              adminQueue.queuedAt,
              db
                .select({ queuedAt: adminQueue.queuedAt })
                .from(adminQueue)
                .where(eq(adminQueue.conversationId, conversationId))
                .limit(1),
            ),
          ),
        )

      // Estimate wait time (5 minutes per person in queue)
      const estimatedWaitTime = (queuePosition[0]?.count || 0) * 5

      return NextResponse.json({
        success: true,
        conversationId,
        status: 'waiting',
        queuePosition: queuePosition[0]?.count || 0,
        estimatedWaitTime,
        message: 'Message sent to admin queue successfully',
      })
    }

    return NextResponse.json(
      {
        error: 'Invalid service mode',
      },
      { status: 400 },
    )
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 },
    )
  }
}
