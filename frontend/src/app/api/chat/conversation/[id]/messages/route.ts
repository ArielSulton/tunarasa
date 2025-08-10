import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { conversations, messages, users } from '@/lib/db/schema'
import { eq, and, gt } from 'drizzle-orm'

/**
 * Conversation Messages API
 *
 * GET: Fetch conversation messages (with polling support)
 * POST: Send admin response to conversation
 */

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const conversationId = parseInt(id)
    const url = new URL(req.url)
    const lastMessageId = url.searchParams.get('lastMessageId')

    if (isNaN(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
    }

    // Build query to get messages with conditional where clause
    const whereConditions = lastMessageId
      ? and(eq(messages.conversationId, conversationId), gt(messages.messageId, parseInt(lastMessageId)))
      : eq(messages.conversationId, conversationId)

    const conversationMessages = await db
      .select({
        messageId: messages.messageId,
        messageContent: messages.messageContent,
        messageType: messages.messageType,
        confidence: messages.confidence,
        inputMethod: messages.inputMethod,
        createdAt: messages.createdAt,
        adminName: users.fullName,
      })
      .from(messages)
      .leftJoin(users, eq(messages.adminId, users.userId))
      .where(whereConditions)
      .orderBy(messages.createdAt)

    // Get conversation status
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.conversationId, conversationId))
      .limit(1)

    if (conversation.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Format messages for frontend
    const formattedMessages = conversationMessages.map((msg) => ({
      id: msg.messageId.toString(),
      type: msg.messageType,
      content: msg.messageContent,
      timestamp: msg.createdAt,
      confidence: msg.confidence,
      adminName: msg.adminName,
      inputMethod: msg.inputMethod,
    }))

    console.log(
      '🔧 [DEBUG] Backend GET messages - returning messages:',
      formattedMessages.map((msg) => ({
        id: msg.id,
        type: msg.type,
        contentPreview: msg.content?.substring(0, 50) + '...',
        adminName: msg.adminName,
      })),
    )

    return NextResponse.json({
      success: true,
      conversationId,
      status: conversation[0].status,
      newMessages: lastMessageId ? formattedMessages : undefined,
      messages: lastMessageId ? undefined : formattedMessages,
    })
  } catch (error) {
    console.error('Error fetching conversation messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const conversationId = parseInt(id)
    const body = await req.json()
    const {
      message,
      adminId,
      isLLMRecommendation = false,
      parentMessageId,
      isApprovingLLMRecommendation = false,
    } = body

    console.log('🔧 [DEBUG] Backend POST messages - received request:', {
      conversationId,
      adminId,
      isLLMRecommendation,
      isApprovingLLMRecommendation,
      messageLength: message?.length ?? 0,
      messagePreview: message?.substring(0, 50) + '...',
      parentMessageId,
    })

    if (isNaN(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
    }

    if (!message || !adminId) {
      return NextResponse.json(
        {
          error: 'Message and adminId are required',
        },
        { status: 400 },
      )
    }

    // Verify conversation exists and is in appropriate state
    const conversation = await db
      .select()
      .from(conversations)
      .where(eq(conversations.conversationId, conversationId))
      .limit(1)

    if (conversation.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Insert admin message
    const messageType = isLLMRecommendation ? 'llm_recommendation' : 'admin'
    console.log('🔧 [DEBUG] Backend POST messages - inserting message with type:', messageType)

    const newMessage = await db
      .insert(messages)
      .values({
        conversationId,
        messageContent: message,
        messageType,
        adminId: parseInt(adminId),
        parentMessageId: parentMessageId ? parseInt(parentMessageId) : null,
      })
      .returning()

    console.log('🔧 [DEBUG] Backend POST messages - message inserted with ID:', newMessage[0]?.messageId)

    // If approving LLM recommendation, we need to clean up the pending recommendation
    if (isApprovingLLMRecommendation) {
      console.log('🔧 [DEBUG] Backend POST messages - removing pending LLM recommendations')
      // Delete or mark pending LLM recommendations as processed
      await db
        .delete(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.messageType, 'llm_recommendation')))
    }

    // Update conversation status and timestamp
    const newStatus = isLLMRecommendation ? conversation[0].status : 'resolved'
    await db
      .update(conversations)
      .set({
        status: newStatus,
        assignedAdminId: parseInt(adminId),
        lastMessageAt: new Date(),
        updatedAt: new Date(),
        resolvedAt: newStatus === 'resolved' ? new Date() : null,
      })
      .where(eq(conversations.conversationId, conversationId))

    // Get admin info for response
    const admin = await db
      .select()
      .from(users)
      .where(eq(users.userId, parseInt(adminId)))
      .limit(1)

    return NextResponse.json({
      success: true,
      message: 'Admin response sent successfully',
      messageId: newMessage[0].messageId,
      adminName: admin[0]?.fullName ?? 'Admin',
      timestamp: newMessage[0].createdAt,
    })
  } catch (error) {
    console.error('Error sending admin response:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
