import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { qaLogs, conversations, users } from '@/lib/db/schema'
import { desc, eq, and, count, sql, ilike, gte, lte } from 'drizzle-orm'

/**
 * QA Logs API Endpoint
 *
 * GET: Fetch QA logs with filtering and pagination
 * Accessible by admin and superadmin users only
 */

export async function GET(request: Request) {
  try {
    console.log('QA Logs API: Starting request')

    // Check authentication and authorization - require admin access
    const startAuth = Date.now()
    await requireAdmin()
    console.log('QA Logs API: Auth check took', Date.now() - startAuth, 'ms')

    // Parse URL parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100) // Max 100 per page
    const offset = (page - 1) * limit

    // Filters
    const serviceMode = searchParams.get('serviceMode')
    const respondedBy = searchParams.get('respondedBy')
    const searchQuery = searchParams.get('search')
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    const minConfidence = searchParams.get('minConfidence')
    const maxConfidence = searchParams.get('maxConfidence')

    // Build where conditions
    const whereConditions = []

    if (serviceMode && (serviceMode === 'full_llm_bot' || serviceMode === 'bot_with_admin_validation')) {
      whereConditions.push(eq(qaLogs.serviceMode, serviceMode))
    }

    if (respondedBy && (respondedBy === 'llm' || respondedBy === 'admin')) {
      whereConditions.push(eq(qaLogs.respondedBy, respondedBy))
    }

    if (searchQuery) {
      whereConditions.push(
        sql`(${ilike(qaLogs.question, `%${searchQuery}%`)} OR ${ilike(qaLogs.answer, `%${searchQuery}%`)})`,
      )
    }

    if (dateFrom) {
      whereConditions.push(gte(qaLogs.createdAt, new Date(dateFrom)))
    }

    if (dateTo) {
      whereConditions.push(lte(qaLogs.createdAt, new Date(dateTo)))
    }

    if (minConfidence) {
      const minConf = parseInt(minConfidence, 10)
      if (!isNaN(minConf) && minConf >= 0 && minConf <= 100) {
        whereConditions.push(sql`${qaLogs.confidence} >= ${minConf}`)
      }
    }

    if (maxConfidence) {
      const maxConf = parseInt(maxConfidence, 10)
      if (!isNaN(maxConf) && maxConf >= 0 && maxConf <= 100) {
        whereConditions.push(sql`${qaLogs.confidence} <= ${maxConf}`)
      }
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined

    // Get total count for pagination
    const startCountQuery = Date.now()
    const totalCountResult = await db.select({ count: count() }).from(qaLogs).where(whereClause)

    const totalCount = totalCountResult[0]?.count || 0
    console.log('QA Logs API: Count query took', Date.now() - startCountQuery, 'ms')

    // Get QA logs with conversation and admin information
    const startMainQuery = Date.now()
    const qaLogsWithDetails = await db
      .select({
        qaId: qaLogs.qaId,
        conversationId: qaLogs.conversationId,
        question: qaLogs.question,
        answer: qaLogs.answer,
        confidence: qaLogs.confidence,
        responseTime: qaLogs.responseTime,
        gestureInput: qaLogs.gestureInput,
        contextUsed: qaLogs.contextUsed,
        evaluationScore: qaLogs.evaluationScore,
        serviceMode: qaLogs.serviceMode,
        respondedBy: qaLogs.respondedBy,
        adminId: qaLogs.adminId,
        llmRecommendationUsed: qaLogs.llmRecommendationUsed,
        createdAt: qaLogs.createdAt,
        // Conversation details
        conversationSessionId: conversations.sessionId,
        conversationStatus: conversations.status,
        conversationServiceMode: conversations.serviceMode,
        // Admin details (if responded by admin)
        adminEmail: users.email,
        adminFullName: users.fullName,
        adminFirstName: users.firstName,
        adminLastName: users.lastName,
      })
      .from(qaLogs)
      .leftJoin(conversations, eq(qaLogs.conversationId, conversations.conversationId))
      .leftJoin(users, eq(qaLogs.adminId, users.userId))
      .where(whereClause)
      .orderBy(desc(qaLogs.createdAt))
      .limit(limit)
      .offset(offset)

    console.log('QA Logs API: Main query took', Date.now() - startMainQuery, 'ms')
    console.log('QA Logs API: Found', qaLogsWithDetails.length, 'QA logs')

    // Format the response
    const formattedQaLogs = qaLogsWithDetails.map((qaLog) => ({
      id: qaLog.qaId.toString(),
      conversationId: qaLog.conversationId,
      question: qaLog.question,
      answer: qaLog.answer,
      confidence: qaLog.confidence,
      responseTime: qaLog.responseTime,
      gestureInput: qaLog.gestureInput,
      contextUsed: qaLog.contextUsed,
      evaluationScore: qaLog.evaluationScore,
      serviceMode: qaLog.serviceMode,
      respondedBy: qaLog.respondedBy,
      llmRecommendationUsed: qaLog.llmRecommendationUsed,
      createdAt: qaLog.createdAt,
      conversation: {
        sessionId: qaLog.conversationSessionId,
        status: qaLog.conversationStatus,
        serviceMode: qaLog.conversationServiceMode,
      },
      admin: qaLog.adminId
        ? {
            id: qaLog.adminId,
            email: qaLog.adminEmail,
            fullName:
              qaLog.adminFullName ??
              `${qaLog.adminFirstName ?? ''} ${qaLog.adminLastName ?? ''}`.trim() ??
              'Unknown Admin',
          }
        : null,
    }))

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limit)
    const hasNextPage = page < totalPages
    const hasPrevPage = page > 1

    // Generate summary statistics
    const statistics = {
      totalLogs: totalCount,
      averageConfidence: qaLogsWithDetails.length
        ? Math.round(
            qaLogsWithDetails
              .filter((log) => log.confidence !== null)
              .reduce((sum, log) => sum + (log.confidence ?? 0), 0) /
              qaLogsWithDetails.filter((log) => log.confidence !== null).length,
          )
        : 0,
      averageResponseTime: qaLogsWithDetails.length
        ? Math.round(
            qaLogsWithDetails
              .filter((log) => log.responseTime !== null)
              .reduce((sum, log) => sum + (log.responseTime ?? 0), 0) /
              qaLogsWithDetails.filter((log) => log.responseTime !== null).length,
          )
        : 0,
      llmResponses: qaLogsWithDetails.filter((log) => log.respondedBy === 'llm').length,
      adminResponses: qaLogsWithDetails.filter((log) => log.respondedBy === 'admin').length,
    }

    console.log('QA Logs API: Total request time', Date.now() - startAuth, 'ms')

    return NextResponse.json({
      success: true,
      data: {
        qaLogs: formattedQaLogs,
        pagination: {
          page,
          limit,
          total: totalCount,
          totalPages,
          hasNextPage,
          hasPrevPage,
        },
        statistics,
        filters: {
          serviceMode,
          respondedBy,
          searchQuery,
          dateFrom,
          dateTo,
          minConfidence,
          maxConfidence,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching QA logs:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
