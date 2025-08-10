import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { messages, conversations, adminQueue } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function POST(request: NextRequest) {
  try {
    console.log('🔍 [Admin Respond] Starting admin response request')

    // Use consistent auth system with other endpoints
    const adminUser = await requireAdmin()

    console.log('✅ [Admin Respond] Admin authenticated:', adminUser.email)

    const body = await request.json()
    const { conversationId, response, responseType } = body

    console.log('🔍 [Admin Respond] Request data:', { conversationId, responseType, responseLength: response?.length })

    if (!conversationId || !response || !responseType) {
      console.error('❌ [Admin Respond] Missing required fields:', {
        conversationId,
        response: !!response,
        responseType,
      })
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Parse conversation ID
    const convId = parseInt(conversationId)
    if (isNaN(convId)) {
      console.error('❌ [Admin Respond] Invalid conversation ID:', conversationId)
      return NextResponse.json({ success: false, error: 'Invalid conversation ID' }, { status: 400 })
    }

    // Create admin response message
    console.log('📝 [Admin Respond] Creating admin message for conversation:', convId)
    const newMessage = await db
      .insert(messages)
      .values({
        conversationId: convId,
        messageContent: response,
        messageType: 'admin',
        adminId: adminUser.user_id,
        confidence: responseType === 'approved_recommendation' ? 100 : 95,
        createdAt: new Date(),
      })
      .returning()

    console.log('✅ [Admin Respond] Created message:', newMessage[0].messageId)

    // Update conversation status
    await db
      .update(conversations)
      .set({
        status: 'resolved',
        updatedAt: new Date(),
        resolvedAt: new Date(),
      })
      .where(eq(conversations.conversationId, convId))

    // Update admin queue status if exists
    try {
      await db
        .update(adminQueue)
        .set({
          status: 'resolved',
          resolvedAt: new Date(),
        })
        .where(eq(adminQueue.conversationId, convId))
      console.log('✅ [Admin Respond] Updated admin queue status')
    } catch (queueError) {
      console.warn('⚠️ [Admin Respond] Admin queue update failed (may not exist):', queueError)
    }

    console.log('🎉 [Admin Respond] Response successfully sent')

    return NextResponse.json({
      success: true,
      data: {
        messageId: newMessage[0].messageId,
        conversationId: convId,
        status: 'resolved',
        responseType,
      },
    })
  } catch (error) {
    console.error('❌ [Admin Respond] Error processing admin response:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ success: false, error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ success: false, error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
