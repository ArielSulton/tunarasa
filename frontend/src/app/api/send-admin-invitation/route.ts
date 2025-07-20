import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { AdminInvitationEmailTemplate } from '@/components/email/admin-invitation-template'
import { auth } from '@clerk/nextjs/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { inviteeEmail, inviterName, organizationName = 'Tunarasa', invitationUrl } = body

    // Validate required fields
    if (!inviteeEmail || !inviterName || !invitationUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: inviteeEmail, inviterName, invitationUrl' },
        { status: 400 },
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteeEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Validate invitation URL
    try {
      new URL(invitationUrl)
    } catch {
      return NextResponse.json({ error: 'Invalid invitation URL' }, { status: 400 })
    }

    // Send email using Resend
    const { data, error } = await resend.emails.send({
      from: `${organizationName} Admin <admin@tunarasa.com>`,
      to: [inviteeEmail],
      subject: `Admin Invitation - ${organizationName} Dashboard`,
      react: AdminInvitationEmailTemplate({
        inviteeEmail,
        inviterName,
        organizationName,
        invitationUrl,
      }),
      // Add reply-to for better user experience
      replyTo: 'noreply@tunarasa.com',
      // Add headers for tracking
      headers: {
        'X-Entity-Ref-ID': `admin-invitation-${Date.now()}`,
      },
    })

    if (error) {
      console.error('Resend API error:', error)
      return NextResponse.json({ error: 'Failed to send invitation email', details: error }, { status: 500 })
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Admin invitation sent successfully',
      data: {
        emailId: data?.id,
        recipient: inviteeEmail,
        sentAt: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('Send invitation error:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}

// Optional: Add rate limiting
export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
