import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { conversations, messages, adminQueue } from '@/lib/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import { getBackendUrl } from '@/lib/utils/backend'

/**
 * Send Message API (Anonymous Users)
 *
 * Handles message sending for both service modes with anonymous user support:
 * - full_llm_bot: Direct LLM processing (handled by frontend)
 * - bot_with_admin_validation: LLM generates response but admin must approve
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

    // Bot with Admin Validation Mode Processing
    if (serviceMode === 'bot_with_admin_validation') {
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
            serviceMode: 'bot_with_admin_validation',
            status: 'waiting',
            lastMessageAt: new Date(),
          })
          .returning()

        conversationId = newConversation[0].conversationId

        // Add to admin queue for validation
        await db.insert(adminQueue).values({
          conversationId,
          priority: 'normal',
          status: 'waiting',
        })
      } else {
        conversationId = existingConversation[0].conversationId

        // Reset conversation status to 'waiting' for new user message
        // This allows continuing the conversation even after it was resolved
        await db
          .update(conversations)
          .set({
            status: 'waiting',
            lastMessageAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(conversations.conversationId, conversationId))
      }

      // Insert user message
      await db.insert(messages).values({
        conversationId,
        messageContent: message,
        messageType: 'user',
        inputMethod,
      })

      // Generate LLM response (but don't send to user yet)
      let llmResponse = ''
      const backendUrl = getBackendUrl()
      const ragUrl = `${backendUrl}/api/v1/rag/ask`
      console.log('🤖 [SendMessage] Backend URL:', backendUrl)
      console.log('🤖 [SendMessage] RAG URL:', ragUrl)
      console.log('🤖 [SendMessage] Environment check:', {
        NEXT_PUBLIC_BACKEND_URL: process.env.NEXT_PUBLIC_BACKEND_URL,
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
        BACKEND_URL: process.env.BACKEND_URL,
        NODE_ENV: process.env.NODE_ENV,
      })

      try {
        const requestBody = {
          question: message,
          session_id: `admin-validation-${conversationId}`,
          language: 'id',
          max_sources: 3,
          similarity_threshold: 0.7,
        }

        console.log('🤖 [SendMessage] Request body:', JSON.stringify(requestBody, null, 2))

        const llmApiResponse = await fetch(ragUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
          // Add timeout to prevent hanging
          signal: AbortSignal.timeout(30000), // 30 second timeout
        })

        console.log('🤖 [SendMessage] LLM API Response status:', llmApiResponse.status, llmApiResponse.statusText)

        if (llmApiResponse.ok) {
          const llmData = await llmApiResponse.json()
          console.log('🤖 [SendMessage] LLM API Response data:', llmData)
          llmResponse = llmData.answer ?? 'Unable to generate response'
        } else {
          const errorText = await llmApiResponse.text().catch(() => 'Unknown error')
          console.error('❌ [SendMessage] LLM API Error Response:', errorText)
          llmResponse = `Error generating LLM response: ${llmApiResponse.status}`
        }
      } catch (error) {
        console.error('❌ [SendMessage] Error generating LLM response:', error)
        llmResponse = `Error generating LLM response: ${error instanceof Error ? error.message : 'Unknown error'}`
      }

      // Save LLM response as "pending admin approval" - NOT sent to user yet
      await db.insert(messages).values({
        conversationId,
        messageContent: llmResponse,
        messageType: 'llm_recommendation', // Special type for pending approval
        inputMethod: 'llm_generated',
        adminId: null, // Will be filled when admin approves
      })

      // Update conversation last message time
      await db
        .update(conversations)
        .set({
          lastMessageAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversations.conversationId, conversationId))

      return NextResponse.json({
        success: true,
        conversationId,
        status: 'waiting', // Waiting for admin approval
        message: 'Message received, LLM response generated and waiting for admin approval',
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
