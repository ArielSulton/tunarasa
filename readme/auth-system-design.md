# Authentication & Authorization System Design

## Overview
Multi-tier authentication system using Clerk for admin authentication and session-based access for end users, with role-based access control and email invitation system.

## Architecture Components

### 1. Authentication Layers

#### Public Layer (End Users)
```typescript
interface PublicUserSession {
  sessionId: string
  ipAddress: string
  userAgent: string
  startedAt: Date
  isActive: boolean
  gestureCount: number
  questionCount: number
}
```

**Features:**
- No authentication required for basic gesture recognition
- Session tracking for analytics and rate limiting
- Anonymous usage with optional feedback collection
- IP-based rate limiting and abuse prevention

#### Admin Layer (Clerk Integration)
```typescript
interface AdminUser {
  id: string
  clerkUserId: string
  email: string
  firstName: string
  lastName: string
  role: 'super_admin' | 'admin'
  isActive: boolean
  invitedBy?: string
  lastLoginAt?: Date
  permissions: Permission[]
}
```

**Features:**
- Clerk-based authentication with JWT tokens
- Role-based access control (RBAC)
- Multi-factor authentication (MFA) support
- Single sign-on (SSO) capability

### 2. Role Definitions

#### Super Admin
```typescript
const SUPER_ADMIN_PERMISSIONS = [
  // User Management
  'users:invite',
  'users:deactivate',
  'users:view_all',
  'users:edit_roles',

  // System Management
  'system:config_edit',
  'system:backup_access',
  'system:logs_view',
  'system:metrics_full',

  // Content Management
  'content:documents_manage',
  'content:rag_manage',
  'content:prompts_edit',

  // Validation Management
  'validation:approve_all',
  'validation:reject_all',
  'validation:bulk_actions',

  // Email System
  'email:send_invitations',
  'email:manage_templates',
] as const
```

#### Admin
```typescript
const ADMIN_PERMISSIONS = [
  // Validation & Monitoring
  'validation:approve',
  'validation:reject',
  'validation:view_queue',

  // Analytics & Reporting
  'analytics:view_dashboard',
  'analytics:export_data',
  'analytics:performance_metrics',

  // Content Review
  'content:documents_review',
  'content:feedback_view',

  // Limited System Access
  'system:logs_view_limited',
  'system:metrics_basic',
] as const
```

### 3. Clerk Integration

#### Configuration
```typescript
// src/lib/auth/clerk-config.ts
export const clerkConfig = {
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  secretKey: process.env.CLERK_SECRET_KEY,

  // Custom claims for role-based access
  customClaims: {
    role: 'super_admin' | 'admin',
    permissions: string[],
    organizationId: string,
    isActive: boolean
  },

  // Webhook endpoints for user lifecycle
  webhookEndpoints: {
    userCreated: '/api/webhooks/clerk/user-created',
    userUpdated: '/api/webhooks/clerk/user-updated',
    userDeleted: '/api/webhooks/clerk/user-deleted',
    sessionCreated: '/api/webhooks/clerk/session-created'
  }
}
```

#### Middleware Setup
```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextRequest, NextResponse } from 'next/server'

const isAdminRoute = createRouteMatcher(['/admin(.*)'])
const isApiRoute = createRouteMatcher(['/api/admin(.*)'])

export default clerkMiddleware(async (auth, req: NextRequest) => {
  const { userId, sessionClaims } = auth()

  // Protect admin routes
  if (isAdminRoute(req) || isApiRoute(req)) {
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }

    // Check role-based access
    const userRole = sessionClaims?.role as string
    if (!['super_admin', 'admin'].includes(userRole)) {
      return NextResponse.redirect(new URL('/unauthorized', req.url))
    }

    // Check if user is active
    const isActive = sessionClaims?.isActive as boolean
    if (!isActive) {
      return NextResponse.redirect(new URL('/account-suspended', req.url))
    }
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
```

### 4. Session Management

#### Public User Sessions
```typescript
// src/lib/auth/session-manager.ts
export class SessionManager {
  static async createSession(
    userAgent: string,
    ipAddress: string
  ): Promise<PublicUserSession> {
    const session = await db.insert(userSessions).values({
      sessionId: generateSecureId(),
      userAgent,
      ipAddress,
      startedAt: new Date(),
      isActive: true,
      gestureCount: 0,
      questionCount: 0
    }).returning()

    return session[0]
  }

  static async updateSessionActivity(
    sessionId: string,
    activityType: 'gesture' | 'question'
  ): Promise<void> {
    const updateField = activityType === 'gesture'
      ? { gestureCount: sql`gesture_count + 1` }
      : { questionCount: sql`question_count + 1` }

    await db.update(userSessions)
      .set(updateField)
      .where(eq(userSessions.sessionId, sessionId))
  }

  static async endSession(sessionId: string): Promise<void> {
    await db.update(userSessions)
      .set({
        isActive: false,
        endedAt: new Date()
      })
      .where(eq(userSessions.sessionId, sessionId))
  }

  static async cleanupExpiredSessions(): Promise<void> {
    const expiryTime = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours

    await db.update(userSessions)
      .set({ isActive: false, endedAt: new Date() })
      .where(
        and(
          eq(userSessions.isActive, true),
          lt(userSessions.startedAt, expiryTime)
        )
      )
  }
}
```

#### Rate Limiting
```typescript
// src/lib/auth/rate-limiter.ts
export class RateLimiter {
  private static readonly LIMITS = {
    anonymous: { requests: 20, window: 60 }, // 20 requests per minute
    session: { requests: 100, window: 60 }, // 100 requests per minute
    admin: { requests: 1000, window: 60 }, // 1000 requests per minute
  }

  static async checkRateLimit(
    identifier: string,
    type: 'anonymous' | 'session' | 'admin'
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const limit = this.LIMITS[type]
    const key = `rate_limit:${type}:${identifier}`

    // Implementation using Redis or in-memory store
    const current = await redis.get(key)
    const count = current ? parseInt(current) : 0

    if (count >= limit.requests) {
      const ttl = await redis.ttl(key)
      return {
        allowed: false,
        remaining: 0,
        resetTime: Date.now() + (ttl * 1000)
      }
    }

    await redis.multi()
      .incr(key)
      .expire(key, limit.window)
      .exec()

    return {
      allowed: true,
      remaining: limit.requests - count - 1,
      resetTime: Date.now() + (limit.window * 1000)
    }
  }
}
```

### 5. Admin Invitation System

#### Invitation Flow
```typescript
// src/lib/auth/invitation-system.ts
export class InvitationSystem {
  static async inviteAdmin(
    inviterUserId: string,
    email: string,
    firstName: string,
    lastName: string,
    role: 'admin' | 'super_admin'
  ): Promise<{ success: boolean; invitationId?: string; error?: string }> {
    try {
      // Check if inviter has permission
      const inviter = await this.getAdminByClerkId(inviterUserId)
      if (!inviter || inviter.role !== 'super_admin') {
        return { success: false, error: 'Insufficient permissions' }
      }

      // Check if email already exists
      const existingAdmin = await db.query.admins.findFirst({
        where: eq(admins.email, email)
      })

      if (existingAdmin) {
        return { success: false, error: 'User already exists' }
      }

      // Generate invitation token
      const invitationToken = generateSecureToken()
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

      // Create pending admin record
      const pendingAdmin = await db.insert(admins).values({
        email,
        firstName,
        lastName,
        role,
        isActive: false,
        invitedBy: inviter.id,
        invitationToken,
        invitationExpiresAt: expiresAt,
      }).returning()

      // Send invitation email
      await this.sendInvitationEmail({
        email,
        firstName,
        lastName,
        invitationToken,
        inviterName: `${inviter.firstName} ${inviter.lastName}`,
        role
      })

      return { success: true, invitationId: pendingAdmin[0].id }
    } catch (error) {
      return { success: false, error: 'Failed to send invitation' }
    }
  }

  static async acceptInvitation(
    token: string,
    clerkUserId: string
  ): Promise<{ success: boolean; adminId?: string; error?: string }> {
    try {
      const pendingAdmin = await db.query.admins.findFirst({
        where: and(
          eq(admins.invitationToken, token),
          eq(admins.isActive, false),
          gt(admins.invitationExpiresAt, new Date())
        )
      })

      if (!pendingAdmin) {
        return { success: false, error: 'Invalid or expired invitation' }
      }

      // Activate admin account
      await db.update(admins)
        .set({
          clerkUserId,
          isActive: true,
          invitationToken: null,
          invitationExpiresAt: null,
          lastLoginAt: new Date()
        })
        .where(eq(admins.id, pendingAdmin.id))

      return { success: true, adminId: pendingAdmin.id }
    } catch (error) {
      return { success: false, error: 'Failed to accept invitation' }
    }
  }

  private static async sendInvitationEmail(params: {
    email: string
    firstName: string
    lastName: string
    invitationToken: string
    inviterName: string
    role: string
  }): Promise<void> {
    const resend = new Resend(process.env.RESEND_API_KEY)

    const invitationUrl = `${process.env.NEXT_PUBLIC_APP_URL}/admin/accept-invitation?token=${params.invitationToken}`

    await resend.emails.send({
      from: 'noreply@tunarasa.com',
      to: params.email,
      subject: 'Undangan Admin Tunarasa',
      html: `
        <h2>Undangan Admin Tunarasa</h2>
        <p>Halo ${params.firstName},</p>
        <p>${params.inviterName} mengundang Anda untuk menjadi ${params.role} di platform Tunarasa.</p>
        <p><a href="${invitationUrl}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Terima Undangan</a></p>
        <p>Link ini akan kedaluwarsa dalam 7 hari.</p>
        <p>Jika Anda tidak mengharapkan email ini, silakan abaikan.</p>
      `
    })

    // Log email sent
    await db.insert(emailLogs).values({
      recipientEmail: params.email,
      emailType: 'admin_invitation',
      subject: 'Undangan Admin Tunarasa',
      templateId: 'admin_invitation_v1',
      deliveryStatus: 'sent',
      relatedAdminId: null,
      additionalData: {
        invitationToken: params.invitationToken,
        role: params.role
      }
    })
  }
}
```

### 6. Permission System

#### Permission Checking
```typescript
// src/lib/auth/permissions.ts
export class PermissionChecker {
  static async hasPermission(
    clerkUserId: string,
    permission: string
  ): Promise<boolean> {
    const admin = await db.query.admins.findFirst({
      where: and(
        eq(admins.clerkUserId, clerkUserId),
        eq(admins.isActive, true)
      )
    })

    if (!admin) return false

    const rolePermissions = admin.role === 'super_admin'
      ? SUPER_ADMIN_PERMISSIONS
      : ADMIN_PERMISSIONS

    return rolePermissions.includes(permission as any)
  }

  static async requirePermission(
    clerkUserId: string,
    permission: string
  ): Promise<void> {
    const hasPermission = await this.hasPermission(clerkUserId, permission)
    if (!hasPermission) {
      throw new Error(`Insufficient permissions: ${permission}`)
    }
  }

  static createPermissionMiddleware(permission: string) {
    return async (req: NextRequest, userId: string) => {
      await this.requirePermission(userId, permission)
    }
  }
}
```

#### Route Protection
```typescript
// src/lib/auth/route-protection.ts
export function withPermission(permission: string) {
  return function (handler: NextApiHandler) {
    return async (req: NextRequest, res: NextResponse) => {
      try {
        const { userId } = auth()
        if (!userId) {
          return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        await PermissionChecker.requirePermission(userId, permission)
        return handler(req, res)
      } catch (error) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }
}

// Usage in API routes
export const POST = withPermission('users:invite')(async (req: NextRequest) => {
  // Handler implementation
})
```

### 7. Security Considerations

#### Token Security
```typescript
// src/lib/auth/security.ts
export class SecurityManager {
  static generateSecureToken(): string {
    return crypto.randomBytes(32).toString('hex')
  }

  static generateSecureId(): string {
    return crypto.randomUUID()
  }

  static hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 12)
  }

  static verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash)
  }

  static sanitizeInput(input: string): string {
    return input.trim().replace(/[<>\"']/g, '')
  }

  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}
```

#### Session Security
```typescript
// src/lib/auth/session-security.ts
export class SessionSecurity {
  static async validateSessionIntegrity(
    sessionId: string,
    userAgent: string,
    ipAddress: string
  ): Promise<{ valid: boolean; reason?: string }> {
    const session = await db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.sessionId, sessionId),
        eq(userSessions.isActive, true)
      )
    })

    if (!session) {
      return { valid: false, reason: 'Session not found' }
    }

    // Check for session hijacking indicators
    if (session.userAgent !== userAgent) {
      return { valid: false, reason: 'User agent mismatch' }
    }

    if (session.ipAddress !== ipAddress) {
      // Allow IP changes but log for monitoring
      await this.logSuspiciousActivity(sessionId, 'ip_change', {
        oldIp: session.ipAddress,
        newIp: ipAddress
      })
    }

    return { valid: true }
  }

  private static async logSuspiciousActivity(
    sessionId: string,
    activityType: string,
    data: any
  ): Promise<void> {
    // Log to monitoring system
    console.warn(`Suspicious activity for session ${sessionId}: ${activityType}`, data)
  }
}
```

### 8. API Integration

#### Authentication Headers
```typescript
// Frontend API client
export class ApiClient {
  private static async getAuthHeaders(
    includeSession: boolean = false
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    // Add Clerk token for admin routes
    const { getToken } = useAuth()
    const clerkToken = await getToken()
    if (clerkToken) {
      headers['Authorization'] = `Bearer ${clerkToken}`
    }

    // Add session ID for user routes
    if (includeSession) {
      const sessionId = localStorage.getItem('tunarasa_session_id')
      if (sessionId) {
        headers['X-Session-ID'] = sessionId
      }
    }

    return headers
  }

  static async adminRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = await this.getAuthHeaders()

    return fetch(`/api/admin${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    })
  }

  static async userRequest(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Response> {
    const headers = await this.getAuthHeaders(true)

    return fetch(`/api${endpoint}`, {
      ...options,
      headers: { ...headers, ...options.headers }
    })
  }
}
```

This authentication system provides:
- Secure admin access with role-based permissions
- Anonymous user access with session tracking
- Email-based invitation system with Resend integration
- Comprehensive rate limiting and security monitoring
- Integration with Clerk for modern authentication features
- Flexible permission system for future expansion
