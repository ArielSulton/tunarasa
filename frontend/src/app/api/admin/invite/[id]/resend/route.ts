import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { currentUser } from '@clerk/nextjs/server'
import { AdminInvitationEmail } from '@/components/emails/AdminInvitationEmail'
import { db } from '@/lib/db'
import { adminInvitations } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Resend admin invitation email
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can resend invitations' }, { status: 403 })
    }

    const invitationId = params.id

    // Get invitation details from database
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
      })
      .from(adminInvitations)
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
        invitedByName: user.firstName ?? user.emailAddresses[0]?.emailAddress ?? 'Admin',
        invitedByEmail: user.emailAddresses[0]?.emailAddress || '',
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
