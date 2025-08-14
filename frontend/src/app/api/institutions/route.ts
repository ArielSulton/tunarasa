import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { institutions } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'

// GET /api/institutions - Public endpoint to list active institutions
export async function GET() {
  try {
    // Fetch active institutions with basic info and counts
    const activeInstitutions = await db
      .select({
        institutionId: institutions.institutionId,
        name: institutions.name,
        slug: institutions.slug,
        description: institutions.description,
        logoUrl: institutions.logoUrl,
        contactInfo: institutions.contactInfo,
        ragFilesCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM rag_files rf 
          WHERE rf.institution_id = ${institutions.institutionId} 
          AND rf.is_active = true 
          AND rf.processing_status = 'completed'
        )`.as('ragFilesCount'),
      })
      .from(institutions)
      .where(eq(institutions.isActive, true))
      .orderBy(desc(institutions.createdAt))

    // Only return institutions that have at least one completed RAG file
    const institutionsWithData = activeInstitutions.filter((inst) => inst.ragFilesCount > 0)

    return NextResponse.json({
      success: true,
      data: {
        institutions: institutionsWithData.map((inst) => ({
          institutionId: inst.institutionId,
          name: inst.name,
          slug: inst.slug,
          description: inst.description,
          logoUrl: inst.logoUrl,
          contactInfo: inst.contactInfo,
          ragFilesCount: inst.ragFilesCount,
        })),
        total: institutionsWithData.length,
      },
    })
  } catch (error) {
    console.error('Error fetching public institutions:', error)
    return NextResponse.json({ error: 'Failed to fetch institutions' }, { status: 500 })
  }
}
