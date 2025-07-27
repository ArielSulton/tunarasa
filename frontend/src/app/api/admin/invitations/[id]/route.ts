import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { adminInvitations, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Get single invitation details
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can view invitation details' }, { status: 403 })
    }

    const invitationId = params.id

    // Get invitation details with inviter information
    const invitationResult = await db
      .select({
        invitationId: adminInvitations.invitationId,
        email: adminInvitations.email,
        role: adminInvitations.role,
        status: adminInvitations.status,
        customMessage: adminInvitations.customMessage,
        token: adminInvitations.token,
        createdAt: adminInvitations.createdAt,
        updatedAt: adminInvitations.updatedAt,
        expiresAt: adminInvitations.expiresAt,
        acceptedAt: adminInvitations.acceptedAt,
        cancelledAt: adminInvitations.cancelledAt,
        invitedBy: adminInvitations.invitedBy,
        inviterName: users.fullName,
        inviterEmail: users.clerkUserId, // We'll use this to get email from Clerk if needed
      })
      .from(adminInvitations)
      .leftJoin(users, eq(adminInvitations.invitedBy, users.userId))
      .where(eq(adminInvitations.invitationId, invitationId))
      .limit(1)

    if (!invitationResult.length) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    const invitation = invitationResult[0]
    const now = new Date()

    // Calculate additional metadata
    const isExpired = invitation.status === 'pending' && new Date(invitation.expiresAt) < now
    const timeRemaining =
      invitation.status === 'pending' ? Math.max(0, new Date(invitation.expiresAt).getTime() - now.getTime()) : null

    // Generate invitation URL for resending
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/accept-invitation?token=${invitation.token}`

    return NextResponse.json({
      success: true,
      data: {
        ...invitation,
        isExpired,
        timeRemaining,
        timeRemainingFormatted: timeRemaining ? formatTimeRemaining(timeRemaining) : null,
        invitationUrl: invitation.status === 'pending' ? invitationUrl : null,
        canResend: invitation.status === 'pending' && !isExpired,
        canCancel: invitation.status === 'pending',
        metadata: {
          createdDaysAgo: Math.floor(
            (now.getTime() - new Date(invitation.createdAt).getTime()) / (1000 * 60 * 60 * 24),
          ),
          lastUpdatedHoursAgo: Math.floor(
            (now.getTime() - new Date(invitation.updatedAt).getTime()) / (1000 * 60 * 60),
          ),
          expiryDaysFromNow:
            invitation.status === 'pending'
              ? Math.ceil((new Date(invitation.expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null,
        },
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Get invitation details error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Update invitation details (status, custom message, etc.)
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can update invitations' }, { status: 403 })
    }

    const invitationId = params.id
    const body = await request.json()
    const { customMessage, status } = body

    // Validate input
    const allowedStatuses = ['pending', 'cancelled', 'expired']
    if (status && !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    // Build update object
    const updateData: {
      updatedAt: Date
      customMessage?: string | null
      status?: string
      cancelledAt?: Date
    } = {
      updatedAt: new Date(),
    }

    if (customMessage !== undefined) {
      updateData.customMessage = customMessage
    }

    if (status) {
      updateData.status = status
      if (status === 'cancelled') {
        updateData.cancelledAt = new Date()
      }
    }

    // Update invitation
    const updatedInvitation = await db
      .update(adminInvitations)
      .set(updateData)
      .where(eq(adminInvitations.invitationId, invitationId))
      .returning({
        invitationId: adminInvitations.invitationId,
        email: adminInvitations.email,
        status: adminInvitations.status,
        customMessage: adminInvitations.customMessage,
        updatedAt: adminInvitations.updatedAt,
      })

    if (!updatedInvitation.length) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: updatedInvitation[0],
      message: 'Invitation updated successfully',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Update invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Delete invitation permanently
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can delete invitations' }, { status: 403 })
    }

    const invitationId = params.id

    // Hard delete invitation
    const deletedInvitation = await db
      .delete(adminInvitations)
      .where(eq(adminInvitations.invitationId, invitationId))
      .returning({
        invitationId: adminInvitations.invitationId,
        email: adminInvitations.email,
      })

    if (!deletedInvitation.length) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: deletedInvitation[0],
      message: 'Invitation deleted permanently',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Delete invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
