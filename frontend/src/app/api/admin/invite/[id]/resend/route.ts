import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireSuperAdmin } from '@/lib/auth/supabase-auth'
import { AdminInvitationEmail } from '@/components/emails/AdminInvitationEmail'
import { db } from '@/lib/db'
import { adminInvitations, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Resend admin invitation email
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization - require super admin
    const authUser = await requireSuperAdmin()

    const invitationId = params.id

    // Get invitation details from database with inviter information
    const invitationResult = await db
      .select({
        invitationId: adminInvitations.invitationId,
        email: adminInvitations.email,
        role: adminInvitations.role,
        customMessage: adminInvitations.customMessage,
        status: adminInvitations.status,
        token: adminInvitations.token,
        expiresAt: adminInvitations.expiresAt,
        invitedBy: adminInvitations.invitedBy,
        inviterName: users.fullName,
        inviterEmail: users.email,
      })
      .from(adminInvitations)
      .leftJoin(users, eq(adminInvitations.invitedBy, users.userId))
      .where(eq(adminInvitations.invitationId, invitationId))
      .limit(1)

    if (!invitationResult.length) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    const invitation = invitationResult[0]

    // Check if invitation is still valid
    if (invitation.status !== 'pending') {
      return NextResponse.json({ error: 'Invitation is no longer pending' }, { status: 400 })
    }

    if (new Date() > new Date(invitation.expiresAt)) {
      return NextResponse.json({ error: 'Invitation has expired' }, { status: 400 })
    }

    // Create new invitation link (same token can be reused or generate new one)
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/accept-invitation?token=${invitationId}`

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Tunarasa Admin <admin@tunarasa.com>',
      to: [invitation.email],
      subject: 'Reminder: Invitation to Join Tunarasa Admin Team',
      react: AdminInvitationEmail({
        invitedByName: invitation.inviterName ?? authUser.fullName ?? 'Admin',
        invitedByEmail: invitation.inviterEmail ?? authUser.email ?? '',
        inviteeEmail: invitation.email,
        role: invitation.role as 'admin' | 'superadmin',
        invitationUrl,
        customMessage: 'This is a reminder for your pending admin invitation.',
        expiresAt: invitation.expiresAt,
      }),
    })

    if (error) {
      console.error('Resend email error:', error)
      return NextResponse.json({ error: 'Failed to resend invitation email' }, { status: 500 })
    }

    // Update invitation in database to track resend
    await db
      .update(adminInvitations)
      .set({
        updatedAt: new Date(),
        // Note: Could add resentAt and resentBy fields to schema in future
      })
      .where(eq(adminInvitations.invitationId, invitationId))

    return NextResponse.json({
      message: 'Invitation resent successfully',
      invitationId,
      emailId: data?.id,
    })
  } catch (error) {
    console.error('Resend invitation error:', error)

    if (error instanceof Error && error.message.includes('Admin access required')) {
      return NextResponse.json({ error: 'Forbidden - Super admin access required' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Authentication required')) {
      return NextResponse.json({ error: 'Unauthorized - Authentication required' }, { status: 401 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
