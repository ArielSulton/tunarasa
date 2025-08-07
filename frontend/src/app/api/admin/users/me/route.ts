import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { users, roles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * GET /api/admin/users/me
 * Returns the current authenticated user's data with role information
 */
export async function GET() {
  try {
    console.log('🔍 [GET /api/admin/users/me] Processing request')

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
      console.log('❌ [GET /api/admin/users/me] Authentication failed:', authError?.message)
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          details: authError?.message,
        },
        { status: 401 },
      )
    }

    console.log('🔍 [GET /api/admin/users/me] User authenticated:', user.email)

    // Query user data from database using Drizzle (same as middleware)
    const userResults = await db
      .select({
        user_id: users.userId,
        supabase_user_id: users.supabaseUserId,
        email: users.email,
        first_name: users.firstName,
        last_name: users.lastName,
        full_name: users.fullName,
        image_url: users.imageUrl,
        role_id: users.roleId,
        is_active: users.isActive,
        created_at: users.createdAt,
        updated_at: users.updatedAt,
        // Join role information
        role_name: roles.roleName,
        permissions: roles.permissions,
      })
      .from(users)
      .leftJoin(roles, eq(users.roleId, roles.roleId))
      .where(eq(users.supabaseUserId, user.id))
      .limit(1)

    const userData = userResults[0]

    if (!userData) {
      console.log('❌ [GET /api/admin/users/me] User not found in database')
      return NextResponse.json(
        {
          success: false,
          error: 'User not found in database',
          details: 'User exists in Supabase Auth but not in the application database',
        },
        { status: 404 },
      )
    }

    console.log('✅ [GET /api/admin/users/me] User data retrieved:', {
      email: userData.email,
      role_id: userData.role_id,
      is_active: userData.is_active,
    })

    // Structure the response data
    const responseData = {
      user_id: userData.user_id,
      supabase_user_id: userData.supabase_user_id,
      email: userData.email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      full_name: userData.full_name,
      image_url: userData.image_url,
      role_id: userData.role_id,
      is_active: userData.is_active,
      created_at: userData.created_at,
      updated_at: userData.updated_at,
      role: userData.role_name
        ? {
            role_name: userData.role_name,
            permissions: userData.permissions ?? [],
          }
        : null,
    }

    return NextResponse.json({
      success: true,
      data: { user: responseData },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ [GET /api/admin/users/me] Unexpected error:', error)

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? String(error) : undefined,
      },
      { status: 500 },
    )
  }
}
