import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { institutions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { isAdminOrSuperAdmin } from '@/lib/auth/supabase-auth'

// GET /api/admin/institutions/[id] - Get specific institution
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
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

    const institutionId = parseInt(resolvedParams.id)
    if (isNaN(institutionId)) {
      return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })
    }

    const institution = await db
      .select()
      .from(institutions)
      .where(eq(institutions.institutionId, institutionId))
      .limit(1)

    if (institution.length === 0) {
      return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        institution: institution[0],
      },
    })
  } catch (error) {
    console.error('Error fetching institution:', error)
    return NextResponse.json({ error: 'Failed to fetch institution' }, { status: 500 })
  }
}

// PUT /api/admin/institutions/[id] - Update institution
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
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

    const institutionId = parseInt(resolvedParams.id)
    if (isNaN(institutionId)) {
      return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })
    }

    const body = await request.json()
    const { name, slug, description, contactInfo, isActive } = body

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 })
    }

    // Check if institution exists
    const existingInstitution = await db
      .select()
      .from(institutions)
      .where(eq(institutions.institutionId, institutionId))
      .limit(1)

    if (existingInstitution.length === 0) {
      return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
    }

    // Check if slug is taken by another institution
    if (slug !== existingInstitution[0].slug) {
      const slugCheck = await db
        .select({ institutionId: institutions.institutionId })
        .from(institutions)
        .where(eq(institutions.slug, slug))
        .limit(1)

      if (slugCheck.length > 0) {
        return NextResponse.json({ error: 'Institution with this slug already exists' }, { status: 400 })
      }
    }

    // Update the institution
    const [updatedInstitution] = await db
      .update(institutions)
      .set({
        name,
        slug,
        description,
        contactInfo: contactInfo ?? {},
        isActive: isActive !== undefined ? isActive : existingInstitution[0].isActive,
        updatedAt: new Date(),
      })
      .where(eq(institutions.institutionId, institutionId))
      .returning()

    return NextResponse.json({
      success: true,
      data: {
        institution: updatedInstitution,
      },
    })
  } catch (error) {
    console.error('Error updating institution:', error)
    return NextResponse.json({ error: 'Failed to update institution' }, { status: 500 })
  }
}

// DELETE /api/admin/institutions/[id] - Soft delete institution
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
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

    const institutionId = parseInt(resolvedParams.id)
    if (isNaN(institutionId)) {
      return NextResponse.json({ error: 'Invalid institution ID' }, { status: 400 })
    }

    // Soft delete by setting isActive to false
    const [deactivatedInstitution] = await db
      .update(institutions)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(institutions.institutionId, institutionId))
      .returning()

    if (!deactivatedInstitution) {
      return NextResponse.json({ error: 'Institution not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: {
        institution: deactivatedInstitution,
      },
    })
  } catch (error) {
    console.error('Error deleting institution:', error)
    return NextResponse.json({ error: 'Failed to delete institution' }, { status: 500 })
  }
}
