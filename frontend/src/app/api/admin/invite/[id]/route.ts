import { NextRequest, NextResponse } from 'next/server'
import { requireSuperAdmin } from '@/lib/auth/supabase-auth'
import { db } from '@/lib/db'
import { adminInvitations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

/**
 * Handle invitation management - resend, cancel, etc.
 */
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization - require super admin
    await requireSuperAdmin()

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

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
