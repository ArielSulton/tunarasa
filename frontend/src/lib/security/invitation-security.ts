/**
 * Security Utilities for Admin Invitation System
 * Comprehensive security measures and validation
 */

import { db } from '@/lib/db'
import { users, adminInvitations } from '@/lib/db/schema'
import { eq, and, count, gte } from 'drizzle-orm'

export interface SecurityAuditLog {
  userId: number | null
  ipAddress: string
  userAgent: string
  action: string
  resource: string
  success: boolean
  details: Record<string, unknown>
  timestamp: Date
}

/**
 * Security validation for invitation creation
 */
export class InvitationSecurityValidator {
  /**
   * Validate superadmin permissions for invitation creation
   */
  static async validateSuperAdminPermissions(
    authUserId: number,
    targetRole: string,
    inviteeEmail: string,
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      // Get current user details
      const authUser = await db
        .select({
          userId: users.userId,
          email: users.email,
          roleId: users.roleId,
          isActive: users.isActive,
        })
        .from(users)
        .where(eq(users.userId, authUserId))
        .limit(1)

      if (!authUser.length) {
        return { valid: false, reason: 'Authentication user not found' }
      }

      const user = authUser[0]

      // Check if user is active
      if (!user.isActive) {
        return { valid: false, reason: 'User account is inactive' }
      }

      // Check if user is superadmin (role_id = 1)
      if (user.roleId !== 1) {
        return { valid: false, reason: 'Only superadmins can send invitations' }
      }

      // Additional security rule: Only superadmins can invite other superadmins
      if (targetRole === 'superadmin' && user.roleId !== 1) {
        return { valid: false, reason: 'Only superadmins can invite other superadmins' }
      }

      // Security rule: Prevent self-invitation
      if (user.email.toLowerCase() === inviteeEmail.toLowerCase()) {
        return { valid: false, reason: 'Cannot send invitation to your own email address' }
      }

      return { valid: true }
    } catch (error) {
      console.error('Error validating superadmin permissions:', error)
      return { valid: false, reason: 'Permission validation error' }
    }
  }

  /**
   * Check for suspicious invitation patterns
   */
  static async detectSuspiciousActivity(
    authUserId: number,
    inviteeEmail: string,
  ): Promise<{ suspicious: boolean; reasons: string[] }> {
    const reasons: string[] = []
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    try {
      // Check invitation frequency - max 5 per hour, 20 per day
      const [hourlyCount, dailyCount] = await Promise.all([
        db
          .select({ count: count() })
          .from(adminInvitations)
          .where(and(eq(adminInvitations.invitedBy, authUserId), gte(adminInvitations.createdAt, oneHourAgo))),
        db
          .select({ count: count() })
          .from(adminInvitations)
          .where(and(eq(adminInvitations.invitedBy, authUserId), gte(adminInvitations.createdAt, oneDayAgo))),
      ])

      if (hourlyCount[0].count >= 5) {
        reasons.push('Excessive invitations per hour')
      }

      if (dailyCount[0].count >= 20) {
        reasons.push('Excessive invitations per day')
      }

      // Check for repeated invitations to the same email
      const emailInvitationCount = await db
        .select({ count: count() })
        .from(adminInvitations)
        .where(and(eq(adminInvitations.email, inviteeEmail.toLowerCase()), gte(adminInvitations.createdAt, oneDayAgo)))

      if (emailInvitationCount[0].count >= 3) {
        reasons.push('Multiple invitations to same email address')
      }

      // Check for patterns suggesting account takeover
      const recentSuperAdminInvites = await db
        .select({ count: count() })
        .from(adminInvitations)
        .where(
          and(
            eq(adminInvitations.invitedBy, authUserId),
            eq(adminInvitations.role, 'superadmin'),
            gte(adminInvitations.createdAt, oneHourAgo),
          ),
        )

      if (recentSuperAdminInvites[0].count >= 2) {
        reasons.push('Multiple superadmin invitations in short timeframe')
      }

      return { suspicious: reasons.length > 0, reasons }
    } catch (error) {
      console.error('Error detecting suspicious activity:', error)
      return { suspicious: true, reasons: ['Security check failed'] }
    }
  }

  /**
   * Validate invitation token security
   */
  static validateInvitationToken(token: string): { valid: boolean; reason?: string } {
    if (!token) {
      return { valid: false, reason: 'Token is required' }
    }

    // Token format: UUID-timestamp
    const tokenParts = token.split('-')
    if (tokenParts.length < 2) {
      return { valid: false, reason: 'Invalid token format' }
    }

    // Validate UUID format (first part)
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (!uuidPattern.test(tokenParts[0])) {
      return { valid: false, reason: 'Invalid token UUID format' }
    }

    // Validate timestamp (last part)
    const timestamp = parseInt(tokenParts[tokenParts.length - 1], 36)
    if (isNaN(timestamp) || timestamp <= 0) {
      return { valid: false, reason: 'Invalid token timestamp' }
    }

    // Check if token is too old (basic replay attack protection)
    const tokenAge = Date.now() - timestamp
    const maxTokenAge = 7 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000 // 7 days + 1 hour buffer
    if (tokenAge > maxTokenAge) {
      return { valid: false, reason: 'Token is too old' }
    }

    return { valid: true }
  }

  /**
   * Validate email security
   */
  static validateEmailSecurity(email: string): { valid: boolean; reason?: string } {
    // Basic email format validation
    const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
    if (!emailRegex.test(email)) {
      return { valid: false, reason: 'Invalid email format' }
    }

    // Check for potentially dangerous email patterns
    const dangerousPatterns = [
      /\\+.*@/, // Plus addressing that might bypass filters
      /@.*(test|temp|disposable|10minute|guerrilla)/, // Temporary email services
      /^admin@/, // Potential admin impersonation
      /^root@/, // System account
      /^noreply@/, // Service account
    ]

    for (const pattern of dangerousPatterns) {
      if (pattern.test(email.toLowerCase())) {
        return { valid: false, reason: 'Email address pattern not allowed' }
      }
    }

    // Check length limits
    if (email.length > 254) {
      return { valid: false, reason: 'Email address too long' }
    }

    return { valid: true }
  }

  /**
   * Create security audit log entry
   */
  static createAuditLog(
    userId: number | null,
    ipAddress: string,
    userAgent: string,
    action: string,
    resource: string,
    success: boolean,
    details: Record<string, unknown> = {},
  ): SecurityAuditLog {
    return {
      userId,
      ipAddress,
      userAgent,
      action,
      resource,
      success,
      details,
      timestamp: new Date(),
    }
  }

  /**
   * Log security audit entry (implement with your preferred logging solution)
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  static async logSecurityEvent(auditLog: SecurityAuditLog): Promise<void> {
    try {
      // In production, you would send this to your security logging system
      console.log('SECURITY_AUDIT:', JSON.stringify(auditLog, null, 2))

      // TODO: Implement proper security logging:
      // - Send to security SIEM
      // - Store in secure audit database
      // - Alert on suspicious patterns
      // - Integrate with monitoring systems
    } catch (error) {
      console.error('Failed to log security event:', error)
    }
  }

  /**
   * Complete security validation for invitation creation
   */
  static async validateInvitationCreation(
    authUserId: number,
    targetRole: string,
    inviteeEmail: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<{ valid: boolean; reason?: string; auditLog: SecurityAuditLog }> {
    const auditLog = this.createAuditLog(
      authUserId,
      ipAddress,
      userAgent,
      'INVITATION_CREATE_ATTEMPT',
      `invitation:${inviteeEmail}:${targetRole}`,
      false,
      { targetRole, inviteeEmail },
    )

    // Email validation
    const emailValidation = this.validateEmailSecurity(inviteeEmail)
    if (!emailValidation.valid) {
      auditLog.details.validationError = emailValidation.reason
      await this.logSecurityEvent(auditLog)
      return { valid: false, reason: emailValidation.reason, auditLog }
    }

    // Permission validation
    const permissionValidation = await this.validateSuperAdminPermissions(authUserId, targetRole, inviteeEmail)
    if (!permissionValidation.valid) {
      auditLog.details.permissionError = permissionValidation.reason
      await this.logSecurityEvent(auditLog)
      return { valid: false, reason: permissionValidation.reason, auditLog }
    }

    // Suspicious activity detection
    const activityCheck = await this.detectSuspiciousActivity(authUserId, inviteeEmail)
    if (activityCheck.suspicious) {
      auditLog.details.suspiciousActivity = activityCheck.reasons
      auditLog.details.blocked = true
      await this.logSecurityEvent(auditLog)
      return {
        valid: false,
        reason: `Suspicious activity detected: ${activityCheck.reasons.join(', ')}`,
        auditLog,
      }
    }

    // All validations passed
    auditLog.success = true
    await this.logSecurityEvent(auditLog)
    return { valid: true, auditLog }
  }
}

/**
 * Password strength validation for invitation acceptance
 */
export class PasswordSecurityValidator {
  static validatePasswordStrength(password: string): { valid: boolean; reasons: string[] } {
    const reasons: string[] = []

    if (password.length < 8) {
      reasons.push('Password must be at least 8 characters long')
    }

    if (password.length > 128) {
      reasons.push('Password must be less than 128 characters')
    }

    if (!/[A-Z]/.test(password)) {
      reasons.push('Password must contain at least one uppercase letter')
    }

    if (!/[a-z]/.test(password)) {
      reasons.push('Password must contain at least one lowercase letter')
    }

    if (!password.includes('\\d')) {
      reasons.push('Password must contain at least one number')
    }

    if (!/[^\\w\\s]/.test(password)) {
      reasons.push('Password must contain at least one special character')
    }

    // Check for common weak passwords
    const commonWeakPasswords = [
      'password',
      'password123',
      '12345678',
      'admin',
      'admin123',
      'qwerty',
      'qwerty123',
      'welcome',
      'welcome123',
    ]

    if (commonWeakPasswords.includes(password.toLowerCase())) {
      reasons.push('Password is too common and easily guessable')
    }

    // Check for repeated characters
    if (/(.)\\1{2,}/.test(password)) {
      reasons.push('Password should not contain repeated characters')
    }

    return { valid: reasons.length === 0, reasons }
  }
}
