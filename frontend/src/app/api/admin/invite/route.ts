import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { currentUser } from '@clerk/nextjs/server'
import { AdminInvitationEmail } from '@/components/emails/AdminInvitationEmail'
import { db } from '@/lib/db'
import { adminInvitations, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

// Initialize Resend with API key
const resend = new Resend(process.env.RESEND_API_KEY)

/**
 * Send admin invitation email via Resend API
 * Only superadmins can send invitations
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const user = await currentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized - User not authenticated' }, { status: 401 })
    }

    // Check if user has superadmin role
    const userRole = user.publicMetadata?.role as string
    if (userRole !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden - Only superadmins can send invitations' }, { status: 403 })
    }

    // Get the user's database ID
    const dbUser = await db.select().from(users).where(eq(users.clerkUserId, user.id)).limit(1)
    if (!dbUser.length) {
      return NextResponse.json({ error: 'User not found in database' }, { status: 404 })
    }

    // Parse request body
    const body = (await request.json()) as { email: string; role: string; customMessage?: string }
    const { email, role, customMessage } = body

    // Validate input
    if (!email || !role) {
      return NextResponse.json({ error: 'Missing required fields: email and role' }, { status: 400 })
    }

    if (!['admin', 'superadmin'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be admin or superadmin' }, { status: 400 })
    }

    // Generate invitation token and expiry
    const invitationToken = generateInvitationToken()
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create invitation link
    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/accept-invitation?token=${invitationToken}`

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'Tunarasa Admin <admin@mail.tunarasa.my.id>',
      to: [email],
      subject: 'Invitation to Join Tunarasa Admin Team',
      react: AdminInvitationEmail({
        invitedByName: user.firstName ?? user.emailAddresses[0]?.emailAddress ?? 'Admin',
        invitedByEmail: user.emailAddresses[0]?.emailAddress || '',
        inviteeEmail: email,
        role: role as 'admin' | 'superadmin',
        invitationUrl,
        customMessage,
        expiresAt,
      }),
      // Fallback HTML for email clients that don't support React
      html: generateFallbackHTML({
        invitedByName: user.firstName ?? 'Admin',
        role,
        invitationUrl,
        customMessage,
        expiresAt,
      }),
    })

    if (error) {
      console.error('Resend email error:', error)
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 })
    }

    // Store invitation in database
    const newInvitation = await db
      .insert(adminInvitations)
      .values({
        email,
        role,
        invitedBy: dbUser[0].userId,
        customMessage,
        token: invitationToken,
        expiresAt,
        status: 'pending',
      })
      .returning({
        invitationId: adminInvitations.invitationId,
      })

    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitationId: newInvitation[0].invitationId,
      token: invitationToken,
      emailId: data?.id,
      expiresAt: expiresAt.toISOString(),
    })
  } catch (error) {
    console.error('Admin invitation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * Generate secure invitation token
 */
function generateInvitationToken(): string {
  return crypto.randomUUID() + '-' + Date.now().toString(36)
}

/**
 * Generate fallback HTML email template
 */
function generateFallbackHTML({
  invitedByName,
  role,
  invitationUrl,
  customMessage,
  expiresAt,
}: {
  invitedByName: string
  role: string
  invitationUrl: string
  customMessage?: string
  expiresAt: Date
}) {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Tunarasa Admin Invitation</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; }
          .footer { background: #f9fafb; padding: 20px; border-radius: 0 0 12px 12px; text-align: center; font-size: 14px; color: #6b7280; }
          .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; }
          .custom-message { background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 4px; }
          .role-badge { background: #fbbf24; color: #92400e; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🤝 Welcome to Tunarasa</h1>
          <p>You've been invited to join our admin team</p>
        </div>

        <div class="content">
          <p>Hello,</p>

          <p><strong>${invitedByName}</strong> has invited you to join the Tunarasa administration team as an <span class="role-badge">${role.toUpperCase()}</span>.</p>

          ${customMessage ? `<div class="custom-message"><strong>Personal Message:</strong><br>"${customMessage}"</div>` : ''}

          <p>Tunarasa is a sign language recognition system that helps bridge communication gaps for the hearing-impaired community. As an admin, you'll help monitor and improve our system to serve users better.</p>

          <p>Click the button below to accept your invitation and set up your account:</p>

          <div style="text-align: center;">
            <a href="${invitationUrl}" class="button">Accept Invitation</a>
          </div>

          <p><strong>What you'll have access to:</strong></p>
          <ul>
            <li>📊 System dashboard and analytics</li>
            <li>👥 User session monitoring</li>
            <li>🤖 AI model performance metrics</li>
            <li>📈 System health and monitoring</li>
            ${role === 'superadmin' ? '<li>👑 User management and admin invitations</li>' : ''}
          </ul>

          <p><small><strong>Important:</strong> This invitation will expire on ${expiresAt.toLocaleDateString()} at ${expiresAt.toLocaleTimeString()}. If you didn't expect this invitation, please ignore this email.</small></p>
        </div>

        <div class="footer">
          <p>© 2025 Tunarasa Team. Made with ❤️ for accessible communication.</p>
          <p>If you have any questions, please contact our support team.</p>
        </div>
      </body>
    </html>
  `
}
