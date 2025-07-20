import * as React from 'react'

interface AdminInvitationEmailProps {
  inviteeEmail: string
  inviterName: string
  organizationName?: string
  invitationUrl: string
}

export function AdminInvitationEmailTemplate({
  inviteeEmail,
  inviterName,
  organizationName = 'Tunarasa',
  invitationUrl,
}: AdminInvitationEmailProps) {
  return (
    <div
      style={{
        fontFamily: 'system-ui, -apple-system, sans-serif',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '40px 20px',
        backgroundColor: '#ffffff',
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: 'center',
          marginBottom: '40px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e5e7eb',
        }}
      >
        <h1
          style={{
            color: '#1f2937',
            fontSize: '28px',
            margin: '0 0 8px 0',
            fontWeight: '600',
          }}
        >
          {organizationName}
        </h1>
        <p
          style={{
            color: '#6b7280',
            fontSize: '16px',
            margin: '0',
          }}
        >
          Admin Dashboard Invitation
        </p>
      </div>

      {/* Content */}
      <div style={{ marginBottom: '40px' }}>
        <h2
          style={{
            color: '#1f2937',
            fontSize: '24px',
            margin: '0 0 16px 0',
            fontWeight: '600',
          }}
        >
          You&apos;re invited to join as an Admin
        </h2>

        <p
          style={{
            color: '#374151',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 20px 0',
          }}
        >
          Hello,
        </p>

        <p
          style={{
            color: '#374151',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 20px 0',
          }}
        >
          <strong>{inviterName}</strong> has invited you to join the {organizationName} admin dashboard. As an admin,
          you will have access to:
        </p>

        <ul
          style={{
            color: '#374151',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 24px 20px',
            padding: '0',
          }}
        >
          <li style={{ marginBottom: '8px' }}>Manage system users and permissions</li>
          <li style={{ marginBottom: '8px' }}>Monitor AI service performance and quality</li>
          <li style={{ marginBottom: '8px' }}>Access system analytics and insights</li>
          <li style={{ marginBottom: '8px' }}>Configure system settings and preferences</li>
        </ul>

        <p
          style={{
            color: '#374151',
            fontSize: '16px',
            lineHeight: '1.6',
            margin: '0 0 32px 0',
          }}
        >
          Click the button below to accept your invitation and set up your admin account:
        </p>
      </div>

      {/* CTA Button */}
      <div style={{ textAlign: 'center', marginBottom: '40px' }}>
        <a
          href={invitationUrl}
          style={{
            display: 'inline-block',
            backgroundColor: '#3b82f6',
            color: '#ffffff',
            padding: '16px 32px',
            borderRadius: '8px',
            textDecoration: 'none',
            fontSize: '16px',
            fontWeight: '600',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          Accept Invitation
        </a>
      </div>

      {/* Alternative Link */}
      <div
        style={{
          backgroundColor: '#f9fafb',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '32px',
        }}
      >
        <p
          style={{
            color: '#374151',
            fontSize: '14px',
            margin: '0 0 8px 0',
            fontWeight: '600',
          }}
        >
          Can&apos;t click the button?
        </p>
        <p
          style={{
            color: '#6b7280',
            fontSize: '14px',
            margin: '0 0 8px 0',
          }}
        >
          Copy and paste this link into your browser:
        </p>
        <p
          style={{
            color: '#3b82f6',
            fontSize: '14px',
            margin: '0',
            wordBreak: 'break-all',
          }}
        >
          {invitationUrl}
        </p>
      </div>

      {/* Security Notice */}
      <div
        style={{
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '32px',
        }}
      >
        <p
          style={{
            color: '#92400e',
            fontSize: '14px',
            margin: '0',
            fontWeight: '600',
          }}
        >
          ⚠️ Security Notice
        </p>
        <p
          style={{
            color: '#92400e',
            fontSize: '14px',
            margin: '8px 0 0 0',
            lineHeight: '1.4',
          }}
        >
          This invitation is intended for <strong>{inviteeEmail}</strong>. If you did not expect this invitation, please
          ignore this email and do not click the link.
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          paddingTop: '20px',
          borderTop: '1px solid #e5e7eb',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            color: '#6b7280',
            fontSize: '14px',
            margin: '0 0 8px 0',
          }}
        >
          This invitation was sent by {inviterName} from {organizationName}
        </p>
        <p
          style={{
            color: '#9ca3af',
            fontSize: '12px',
            margin: '0',
          }}
        >
          If you have questions, please contact your system administrator.
        </p>
      </div>
    </div>
  )
}
