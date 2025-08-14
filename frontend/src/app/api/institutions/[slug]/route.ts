import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { institutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params

    if (!slug) {
      return NextResponse.json({ success: false, error: 'Slug parameter is required' }, { status: 400 })
    }

    // Get institution by slug
    const institution = await db.select().from(institutions).where(eq(institutions.slug, slug)).limit(1)

    if (institution.length === 0) {
      return NextResponse.json({ success: false, error: 'Institution not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      institution: institution[0],
    })
  } catch (error) {
    console.error('Error fetching institution by slug:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch institution' }, { status: 500 })
  }
}
