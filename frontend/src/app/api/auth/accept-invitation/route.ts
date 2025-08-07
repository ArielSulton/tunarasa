import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { db } from '@/lib/db'
import { adminInvitations, users } from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { acceptanceRateLimiter, validationRateLimiter, getClientIp, applyRateLimit } from '@/lib/security/rate-limiter'

/**
 * Accept admin invitation and create user account
 * This endpoint handles the invitation acceptance flow:
 * 1. Validates invitation token
 * 2. Creates Supabase auth user
 * 3. Creates database user record with proper role
 * 4. Marks invitation as accepted
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting per IP address
    const clientIp = getClientIp(request)
    const rateLimitResult = applyRateLimit(
      acceptanceRateLimiter,
      `accept:${clientIp}`,
      'Too many invitation acceptance attempts. Please wait before trying again.',
    )

    if (rateLimitResult.isLimited) {
      return rateLimitResult.response!
    }

    const body = await request.json()
    const { token, email, password, firstName, lastName } = body

    // Validate required fields
    if (!token || !email || !password || !firstName) {
      return NextResponse.json(
        {
          error: 'Missing required fields: token, email, password, firstName',
        },
        { status: 400 },
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        {
          error: 'Password must be at least 8 characters long',
        },
        { status: 400 },
      )
    }

    // Find and validate invitation
    const invitationResult = await db
      .select({
        invitationId: adminInvitations.invitationId,
        email: adminInvitations.email,
        role: adminInvitations.role,
        status: adminInvitations.status,
        expiresAt: adminInvitations.expiresAt,
        invitedBy: adminInvitations.invitedBy,
      })
      .from(adminInvitations)
      .where(and(eq(adminInvitations.token, token), eq(adminInvitations.status, 'pending')))
      .limit(1)

    if (!invitationResult.length) {
      return NextResponse.json(
        {
          error: 'Invalid or expired invitation token',
        },
        { status: 404 },
      )
    }

    const invitation = invitationResult[0]

    // Check if invitation has expired
    if (new Date() > new Date(invitation.expiresAt)) {
      // Mark invitation as expired
      await db
        .update(adminInvitations)
        .set({
          status: 'expired',
          updatedAt: new Date(),
        })
        .where(eq(adminInvitations.invitationId, invitation.invitationId))

      return NextResponse.json(
        {
          error: 'Invitation has expired',
        },
        { status: 410 },
      )
    }

    // Verify email matches invitation
    if (invitation.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        {
          error: 'Email does not match invitation',
        },
        { status: 400 },
      )
    }

    // Check if user with this email already exists
    const existingUser = await db
      .select({ userId: users.userId })
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1)

    if (existingUser.length > 0) {
      return NextResponse.json(
        {
          error: 'User with this email already exists',
        },
        { status: 409 },
      )
    }

    // Initialize Supabase client for admin operations
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use service role key for admin operations
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(_cookiesToSet) {
            // No-op for server-side operations
          },
        },
      },
    )

    // Create Supabase auth user
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email: email.toLowerCase(),
      password,
      email_confirm: true, // Auto-confirm email for invited admins
      user_metadata: {
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`.trim(),
        invitedBy: invitation.invitedBy,
        invitationAccepted: true,
      },
    })

    if (authError || !authUser.user) {
      console.error('Supabase auth user creation error:', authError)
      return NextResponse.json(
        {
          error: 'Failed to create user account',
        },
        { status: 500 },
      )
    }

    try {
      // Map role string to role_id
      const roleId = invitation.role === 'superadmin' ? 1 : 2

      // Create database user record
      const newUser = await db
        .insert(users)
        .values({
          supabaseUserId: authUser.user.id,
          email: email.toLowerCase(),
          firstName,
          lastName,
          fullName: `${firstName} ${lastName}`.trim(),
          roleId,
          isActive: true,
          emailVerified: true,
          invitedBy: invitation.invitedBy,
          invitedAt: new Date(new Date(invitation.expiresAt).getTime() - 7 * 24 * 60 * 60 * 1000), // Original invitation time
          invitationAcceptedAt: new Date(),
          userMetadata: {
            firstName,
            lastName,
            fullName: `${firstName} ${lastName}`.trim(),
            invitedBy: invitation.invitedBy,
            invitationAccepted: true,
          },
        })
        .returning({
          userId: users.userId,
          email: users.email,
          fullName: users.fullName,
          roleId: users.roleId,
        })

      // Mark invitation as accepted
      await db
        .update(adminInvitations)
        .set({
          status: 'accepted',
          acceptedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(adminInvitations.invitationId, invitation.invitationId))

      // Log successful invitation acceptance
      console.log(`Admin invitation accepted: ${email} (role: ${invitation.role}, userId: ${newUser[0].userId})`)

      return NextResponse.json({
        success: true,
        message: 'Invitation accepted successfully',
        data: {
          userId: newUser[0].userId,
          email: newUser[0].email,
          fullName: newUser[0].fullName,
          role: invitation.role,
          roleId: newUser[0].roleId,
        },
        timestamp: new Date().toISOString(),
      })
    } catch (dbError) {
      console.error('Database user creation error:', dbError)

      // Clean up Supabase auth user if database insertion fails
      try {
        await supabase.auth.admin.deleteUser(authUser.user.id)
      } catch (cleanupError) {
        console.error('Failed to cleanup auth user:', cleanupError)
      }

      return NextResponse.json(
        {
          error: 'Failed to complete user registration',
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error('Accept invitation error:', error)

    if (error instanceof Error) {
      // Handle specific error types
      if (error.message.includes('duplicate key value')) {
        return NextResponse.json(
          {
            error: 'User already exists with this email or Supabase ID',
          },
          { status: 409 },
        )
      }

      if (error.message.includes('foreign key constraint')) {
        return NextResponse.json(
          {
            error: 'Invalid invitation or user reference',
          },
          { status: 400 },
        )
      }
    }

    return NextResponse.json(
      {
        error: 'Internal server error',
      },
      { status: 500 },
    )
  }
}

/**
 * Validate invitation token without accepting it
 * Useful for pre-validation on the frontend
 */
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting for validation requests
    const clientIp = getClientIp(request)
    const rateLimitResult = applyRateLimit(
      validationRateLimiter,
      `validate:${clientIp}`,
      'Too many validation requests. Please wait before trying again.',
    )

    if (rateLimitResult.isLimited) {
      return rateLimitResult.response!
    }

    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        {
          error: 'Missing invitation token',
        },
        { status: 400 },
      )
    }

    // Find and validate invitation
    const invitationResult = await db
      .select({
        invitationId: adminInvitations.invitationId,
        email: adminInvitations.email,
        role: adminInvitations.role,
        status: adminInvitations.status,
        expiresAt: adminInvitations.expiresAt,
        customMessage: adminInvitations.customMessage,
        createdAt: adminInvitations.createdAt,
      })
      .from(adminInvitations)
      .where(eq(adminInvitations.token, token))
      .limit(1)

    if (!invitationResult.length) {
      return NextResponse.json(
        {
          error: 'Invalid invitation token',
          valid: false,
        },
        { status: 404 },
      )
    }

    const invitation = invitationResult[0]
    const now = new Date()
    const isExpired = new Date(invitation.expiresAt) < now
    const isAlreadyAccepted = invitation.status === 'accepted'
    const isCancelled = invitation.status === 'cancelled'

    // Auto-mark as expired if needed
    if (invitation.status === 'pending' && isExpired) {
      await db
        .update(adminInvitations)
        .set({
          status: 'expired',
          updatedAt: now,
        })
        .where(eq(adminInvitations.invitationId, invitation.invitationId))

      invitation.status = 'expired'
    }

    const timeRemaining = Math.max(0, new Date(invitation.expiresAt).getTime() - now.getTime())

    return NextResponse.json({
      success: true,
      valid: invitation.status === 'pending' && !isExpired,
      data: {
        email: invitation.email,
        role: invitation.role,
        customMessage: invitation.customMessage,
        expiresAt: invitation.expiresAt,
        createdAt: invitation.createdAt,
        status: invitation.status,
        isExpired,
        isAlreadyAccepted,
        isCancelled,
        timeRemaining,
        timeRemainingFormatted: timeRemaining > 0 ? formatTimeRemaining(timeRemaining) : null,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Validate invitation token error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        valid: false,
      },
      { status: 500 },
    )
  }
}

/**
 * Helper function to format time remaining
 */
function formatTimeRemaining(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days} day${days > 1 ? 's' : ''}`
  } else if (hours > 0) {
    return `${hours} hour${hours > 1 ? 's' : ''}`
  } else if (minutes > 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`
  } else {
    return `${seconds} second${seconds > 1 ? 's' : ''}`
  }
}
