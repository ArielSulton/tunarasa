import { NextRequest, NextResponse } from 'next/server'

interface ChatMessage {
  id: string
  type: 'user' | 'assistant' | 'admin' | 'system'
  content: string
  timestamp: string
  confidence?: number
  adminName?: string
}

interface SaveConversationRequest {
  sessionId: string
  messages: ChatMessage[]
}

export async function POST(req: NextRequest) {
  try {
    const body: SaveConversationRequest = await req.json()
    const { sessionId, messages } = body

    console.log('Saving conversation to database:', { sessionId, messageCount: messages.length })

    // Save conversation to database via backend API
    const requestPayload = {
      session_id: sessionId,
      service_mode: 'full_llm_bot',
      messages: messages.map((msg) => ({
        message_content: msg.content,
        message_type: msg.type,
        input_method: 'text',
        confidence: msg.confidence ?? null,
        admin_id: msg.adminName ? 1 : null, // TODO: Map admin name to actual admin ID
        created_at: msg.timestamp,
      })),
    }

    console.log('Sending to backend:', requestPayload)

    // Call backend API to save conversation and messages
    // Use environment variable for backend URL or fallback to service name
    const backendUrl = process.env.BACKEND_URL
      ? `${process.env.BACKEND_URL}/api/v1/conversation/save`
      : 'http://backend:8000/api/v1/conversation/save'

    const backendResponse = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    })

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text()
      console.error('Backend save failed:', backendResponse.status, errorText)
      throw new Error(`Failed to save to database: ${backendResponse.status} ${errorText}`)
    }

    const backendResult = await backendResponse.json()
    const conversationId = backendResult.data?.conversation_id ?? backendResult.conversation_id
    const savedCount = backendResult.data?.messages_saved ?? messages.length

    console.log('Successfully saved to database:', { conversationId, savedCount })

    return NextResponse.json({
      success: true,
      conversationId,
      savedMessages: savedCount,
      failedMessages: 0,
      backendResult,
    })
  } catch (error) {
    console.error('Error in save conversation API:', error)
    return NextResponse.json(
      {
        error: 'Failed to save conversation',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
