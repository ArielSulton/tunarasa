import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { institutions, users } from '@/lib/db/schema'
import { eq, desc, sql } from 'drizzle-orm'
import { isAdminOrSuperAdmin } from '@/lib/auth/supabase-auth'

// GET /api/admin/institutions - List all institutions
export async function GET() {
  try {
    // Create Supabase client for server-side auth
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      },
    )

    // Get current user from Supabase auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isAdminOrSuperAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 })
    }

    // Fetch institutions with counts
    const institutionsWithCounts = await db
      .select({
        institutionId: institutions.institutionId,
        name: institutions.name,
        slug: institutions.slug,
        description: institutions.description,
        logoUrl: institutions.logoUrl,
        contactInfo: institutions.contactInfo,
        isActive: institutions.isActive,
        createdBy: institutions.createdBy,
        createdAt: institutions.createdAt,
        updatedAt: institutions.updatedAt,
        ragFilesCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM rag_files rf 
          WHERE rf.institution_id = ${institutions.institutionId} 
          AND rf.is_active = true
        )`.as('ragFilesCount'),
        conversationsCount: sql<number>`(
          SELECT COUNT(*)::int 
          FROM conversations c 
          WHERE c.institution_id = ${institutions.institutionId}
        )`.as('conversationsCount'),
      })
      .from(institutions)
      .orderBy(desc(institutions.createdAt))

    // Format response with _count structure expected by frontend
    const formattedInstitutions = institutionsWithCounts.map((inst) => ({
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
    console.error('Error fetching institutions:', error)
    return NextResponse.json({ error: 'Failed to fetch institutions' }, { status: 500 })
  }
}

// POST /api/admin/institutions - Create new institution
export async function POST(request: NextRequest) {
  try {
    // Create Supabase client for server-side auth
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          },
        },
      },
    )

    // Get current user from Supabase auth
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const isAdmin = await isAdminOrSuperAdmin(user.id)
    if (!isAdmin) {
      return NextResponse.json({ error: 'Access denied. Admin role required.' }, { status: 403 })
    }

    // Get the current user's database ID
    const currentUser = await db
      .select({ userId: users.userId })
      .from(users)
      .where(eq(users.supabaseUserId, user.id))
      .limit(1)

    if (currentUser.length === 0) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    const body = await request.json()
    const { name, slug, description, contactInfo } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Check if slug already exists
    const existingInstitution = await db
      .select({ institutionId: institutions.institutionId })
      .from(institutions)
      .where(eq(institutions.slug, slug))
      .limit(1)

    if (existingInstitution.length > 0) {
      return NextResponse.json({ error: 'Institution with this slug already exists' }, { status: 400 })
    }

    // Create the institution
    const [newInstitution] = await db
      .insert(institutions)
      .values({
        name,
        slug,
        description,
        contactInfo: contactInfo ?? {},
        createdBy: currentUser[0].userId,
      })
      .returning()

    return NextResponse.json(
      {
        success: true,
        data: {
          institution: newInstitution,
        },
      },
      { status: 201 },
    )
  } catch (error) {
    console.error('Error creating institution:', error)
    return NextResponse.json({ error: 'Failed to create institution' }, { status: 500 })
  }
}
