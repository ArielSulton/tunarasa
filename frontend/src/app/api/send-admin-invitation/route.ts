import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { AdminInvitationEmailTemplate } from '@/components/email/admin-invitation-template'
import { auth } from '@clerk/nextjs/server'

// Initialize Resend only when needed to avoid build-time errors
let resend: Resend | null = null

function getResendClient(): Resend {
  if (!resend) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY environment variable is not set')
    }
    resend = new Resend(apiKey)
  }
  return resend
}

export async function POST(request: NextRequest) {
  try {
    // Check if email service is configured
    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        {
          error: 'Email service not configured',
          message: 'RESEND_API_KEY environment variable is not set',
        },
        { status: 503 },
      )
    }

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

    // Get email configuration from environment
    const fromEmail = process.env.FROM_EMAIL || 'admin@mail.tunarasa.my.id'
    const fromName = process.env.FROM_NAME || 'Tunarasa Admin'
    const replyToEmail = process.env.ADMIN_EMAIL || 'noreply@mail.tunarasa.my.id'

    // Send email using Resend
    const resendClient = getResendClient()
    const { data, error } = await resendClient.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [inviteeEmail],
      subject: `Admin Invitation - ${organizationName} Dashboard`,
      react: AdminInvitationEmailTemplate({
        inviteeEmail,
        inviterName,
        organizationName,
        invitationUrl,
      }),
      // Add reply-to for better user experience
      replyTo: replyToEmail,
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

// Dynamic configuration - prevents build-time evaluation
export const dynamic = 'force-dynamic'
