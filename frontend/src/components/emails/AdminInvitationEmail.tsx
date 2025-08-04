import * as React from 'react'

interface AdminInvitationEmailProps {
  invitedByName: string
  invitedByEmail: string
  inviteeEmail: string
  role: 'admin' | 'superadmin'
  invitationUrl: string
  customMessage?: string
  expiresAt: Date
}

export function AdminInvitationEmail({
  invitedByName,
  invitedByEmail,
  inviteeEmail: _inviteeEmail, // Prefix with underscore to indicate intentionally unused
  role,
  invitationUrl,
  customMessage,
  expiresAt,
}: AdminInvitationEmailProps) {
  const roleDisplayName = role === 'superadmin' ? 'Super Admin' : 'Admin'
  const roleColor = role === 'superadmin' ? '#f59e0b' : '#3b82f6'

  return (
    <div
      style={{
        fontFamily: 'Arial, sans-serif',
        lineHeight: '1.6',
        color: '#333333',
        maxWidth: '600px',
        margin: '0 auto',
        padding: '0',
        backgroundColor: '#f3f4f6',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
          color: 'white',
          padding: '40px 30px',
          textAlign: 'center',
          borderRadius: '12px 12px 0 0',
        }}
      >
        <div style={{ fontSize: '48px', marginBottom: '10px' }}>🤝</div>
        <h1 style={{ margin: '0 0 10px 0', fontSize: '28px', fontWeight: 'bold' }}>Welcome to Tunarasa</h1>
        <p style={{ margin: '0', fontSize: '18px', opacity: '0.9' }}>You&apos;ve been invited to join our admin team</p>
      </div>

      {/* Main Content */}
      <div
        style={{
          backgroundColor: '#ffffff',
          padding: '40px 30px',
          border: '1px solid #e5e7eb',
          borderTop: 'none',
        }}
      >
        <p style={{ fontSize: '16px', marginBottom: '20px' }}>Hello,</p>

        <p style={{ fontSize: '16px', marginBottom: '25px' }}>
          <strong>{invitedByName}</strong> ({invitedByEmail}) has invited you to join the Tunarasa administration team
          as a{' '}
          <span
            style={{
              backgroundColor: roleColor,
              color: 'white',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold',
              display: 'inline-block',
            }}
          >
            {roleDisplayName}
          </span>
          .
        </p>

        {/* Custom Message */}
        {customMessage && (
          <div
            style={{
              backgroundColor: '#dbeafe',
              borderLeft: '4px solid #3b82f6',
              padding: '20px',
              margin: '25px 0',
              borderRadius: '0 8px 8px 0',
            }}
          >
            <p
              style={{
                margin: '0',
                fontStyle: 'italic',
                color: '#1e40af',
                fontSize: '16px',
              }}
            >
              <strong>Personal Message from {invitedByName}:</strong>
              <br />
              &quot;{customMessage}&quot;
            </p>
          </div>
        )}

        <p style={{ fontSize: '16px', marginBottom: '25px' }}>
          Tunarasa is an innovative sign language recognition system that helps bridge communication gaps for the
          hearing-impaired community. As an admin, you&apos;ll help monitor and improve our system to serve users
          better.
        </p>

        <p style={{ fontSize: '16px', marginBottom: '30px' }}>
          Click the button below to accept your invitation and set up your account:
        </p>

        {/* CTA Button */}
        <div style={{ textAlign: 'center', margin: '30px 0' }}>
          <a
            href={invitationUrl}
            style={{
              display: 'inline-block',
              backgroundColor: '#3b82f6',
              color: 'white',
              padding: '16px 32px',
              textDecoration: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '16px',
              boxShadow: '0 4px 6px rgba(59, 130, 246, 0.3)',
            }}
          >
            🎯 Accept Invitation
          </a>
        </div>

        {/* Access List */}
        <div
          style={{
            backgroundColor: '#f9fafb',
            padding: '20px',
            borderRadius: '8px',
            margin: '25px 0',
          }}
        >
          <p
            style={{
              margin: '0 0 15px 0',
              fontWeight: 'bold',
              fontSize: '16px',
              color: '#374151',
            }}
          >
            🔑 What you&apos;ll have access to:
          </p>
          <ul
            style={{
              margin: '0',
              paddingLeft: '20px',
              color: '#4b5563',
            }}
          >
            <li style={{ marginBottom: '8px' }}>📊 System dashboard and analytics</li>
            <li style={{ marginBottom: '8px' }}>👥 User session monitoring</li>
            <li style={{ marginBottom: '8px' }}>🤖 AI model performance metrics</li>
            <li style={{ marginBottom: '8px' }}>📈 System health and monitoring</li>
            <li style={{ marginBottom: '8px' }}>💬 Q&A logs and conversation analysis</li>
            {role === 'superadmin' && (
              <>
                <li style={{ marginBottom: '8px' }}>👑 User management and admin invitations</li>
                <li style={{ marginBottom: '8px' }}>⚙️ System configuration and settings</li>
              </>
            )}
          </ul>
        </div>

        {/* Security Notice */}
        <div
          style={{
            backgroundColor: '#fef3c7',
            border: '1px solid #f59e0b',
            padding: '15px',
            borderRadius: '8px',
            margin: '25px 0',
          }}
        >
          <p
            style={{
              margin: '0',
              fontSize: '14px',
              color: '#92400e',
            }}
          >
            <strong>⚠️ Important Security Notice:</strong>
            <br />
            This invitation will expire on <strong>{expiresAt.toLocaleDateString()}</strong> at{' '}
            <strong>{expiresAt.toLocaleTimeString()}</strong>. If you didn&apos;t expect this invitation or don&apos;t
            recognize the sender, please ignore this email and report it to our security team.
          </p>
        </div>

        <p style={{ fontSize: '14px', color: '#6b7280', textAlign: 'center' }}>
          Having trouble with the button? Copy and paste this link into your browser:
          <br />
          <a href={invitationUrl} style={{ color: '#3b82f6', wordBreak: 'break-all' }}>
            {invitationUrl}
          </a>
        </p>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: '#f9fafb',
          padding: '30px',
          borderRadius: '0 0 12px 12px',
          textAlign: 'center',
          borderTop: '1px solid #e5e7eb',
        }}
      >
        <p
          style={{
            margin: '0 0 10px 0',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#374151',
          }}
        >
          © 2025 Tunarasa Team
        </p>
        <p
          style={{
            margin: '0 0 15px 0',
            fontSize: '14px',
            color: '#6b7280',
          }}
        >
          Made with ❤️ for accessible communication
        </p>
        <p
          style={{
            margin: '0',
            fontSize: '12px',
            color: '#9ca3af',
          }}
        >
          If you have any questions about this invitation, please contact our support team.
        </p>
      </div>
    </div>
  )
}
