import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { institutions } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

// GET /api/public/institutions - List active institutions (public endpoint)
export async function GET() {
  try {
    // Fetch active institutions with counts (no auth required for public view)
    const activeInstitutions = await db
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
      .where(eq(institutions.isActive, true))
      .orderBy(desc(institutions.createdAt))

    // Format response with _count structure
    const formattedInstitutions = activeInstitutions.map((inst) => ({
      ...inst,
      _count: {
        ragFiles: inst.ragFilesCount,
        conversations: inst.conversationsCount,
      },
    }))

    return NextResponse.json({
      success: true,
      data: {
        institutions: formattedInstitutions,
        total: formattedInstitutions.length,
      },
    })
  } catch (error) {
    console.error('Error fetching public institutions:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch institutions',
      },
      { status: 500 },
    )
  }
}
