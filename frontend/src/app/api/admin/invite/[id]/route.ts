import { NextRequest, NextResponse } from 'next/server'
import { currentUser } from '@clerk/nextjs/server'
import { db } from '@/lib/db'
import { adminInvitations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Handle invitation management - resend, cancel, etc.
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
      return NextResponse.json({ error: 'Forbidden - Only superadmins can cancel invitations' }, { status: 403 })
    }

    const invitationId = params.id

    // Delete invitation from database (soft delete by updating status to 'cancelled')
    const deletedInvitation = await db
      .update(adminInvitations)
      .set({
        status: 'cancelled',
        cancelledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(adminInvitations.invitationId, invitationId))
      .returning({
        invitationId: adminInvitations.invitationId,
        email: adminInvitations.email,
      })

    if (!deletedInvitation.length) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    return NextResponse.json({
      message: 'Invitation cancelled successfully',
      invitationId,
    })
  } catch (error) {
    console.error('Cancel invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
