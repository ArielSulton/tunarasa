import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { institutions } from '@/lib/db/schema'
import { eq, sql } from 'drizzle-orm'
import { DUKCAPIL_INSTITUTION_CONFIG } from '@/lib/services/institutions-management'

// GET /api/public/institutions/default - Get default dukcapil institution
export async function GET() {
  try {
    // Fetch the default dukcapil institution with counts
    const [defaultInstitution] = await db
      .select({
        institutionId: institutions.institutionId,
        name: institutions.name,
        slug: institutions.slug,
        description: institutions.description,
        logoUrl: institutions.logoUrl,
        isActive: institutions.isActive,
        createdAt: institutions.createdAt,
        // Count active RAG files
        ragFilesCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM rag_files rf 
          WHERE rf.institution_id = ${institutions.institutionId} 
          AND rf.is_active = true
        )`.as('ragFilesCount'),
        // Count conversations
        conversationsCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM conversations c 
          WHERE c.institution_id = ${institutions.institutionId}
        )`.as('conversationsCount'),
      })
      .from(institutions)
      .where(eq(institutions.slug, DUKCAPIL_INSTITUTION_CONFIG.SLUG))
      .limit(1)

    if (!defaultInstitution) {
      return NextResponse.json(
        {
          success: false,
          error: 'Default dukcapil institution not found. Please run database seeding.',
        },
        { status: 404 },
      )
    }

    if (!defaultInstitution.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: 'Default dukcapil institution is not active.',
        },
        { status: 404 },
      )
    }

    // Format response with _count structure
    const formattedInstitution = {
      ...defaultInstitution,
      _count: {
        ragFiles: defaultInstitution.ragFilesCount,
        conversations: defaultInstitution.conversationsCount,
      },
    }

    return NextResponse.json({
      success: true,
      data: {
        institution: formattedInstitution,
      },
    })
  } catch (error) {
    console.error('Error fetching default dukcapil institution:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch default institution',
      },
      { status: 500 },
    )
  }
}
