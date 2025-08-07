/**
 * Database Role Seeding Utility
 *
 * This utility seeds the roles table with default roles needed for the application.
 * It should be run before any user signs up to prevent foreign key constraint violations.
 */

import { db } from '@/lib/db'
import { roles } from '@/lib/db/schema'

export async function seedDefaultRoles(): Promise<void> {
  try {
    console.log('🚀 Starting role seeding process...')

    // Check if roles already exist
    const existingRoles = await db.select().from(roles)

    if (existingRoles.length > 0) {
      console.log(`✅ Roles already exist (${existingRoles.length} roles found):`)
      existingRoles.forEach((role) => {
        console.log(`   - ${role.roleId}: ${role.roleName}`)
      })
      return
    }

    console.log('📝 No roles found. Creating default roles...')

    // Insert default roles with explicit IDs
    const defaultRoles = [
      {
        roleId: 1,
        roleName: 'superadmin',
        description: 'Full system access with all administrative privileges',
        permissions: [
          'admin.full_access',
          'admin.user_management',
          'admin.role_management',
          'admin.system_config',
          'admin.analytics.view',
          'admin.conversations.manage',
          'admin.llm_evaluation.manage',
        ],
        isActive: true,
      },
      {
        roleId: 2,
        roleName: 'admin',
        description: 'Administrative access for content validation and monitoring',
        permissions: [
          'admin.analytics.view',
          'admin.conversations.view',
          'admin.conversations.validate',
          'admin.llm_evaluation.view',
        ],
        isActive: true,
      },
      {
        roleId: 3,
        roleName: 'user',
        description: 'Basic user access for gesture recognition and chat',
        permissions: ['user.chat', 'user.gestures'],
        isActive: true,
      },
    ]

    await db.insert(roles).values(defaultRoles)

    console.log('✅ Default roles created successfully:')
    defaultRoles.forEach((role) => {
      console.log(`   - ${role.roleId}: ${role.roleName} (${role.permissions.length} permissions)`)
    })

    // Verify roles were created
    const createdRoles = await db.select().from(roles)
    console.log(`🔍 Verification: ${createdRoles.length} roles now exist in database`)
  } catch (error) {
    console.error('❌ Error seeding default roles:', error)

    // Provide helpful error information
    if (error instanceof Error) {
      if (error.message.includes('duplicate key')) {
        console.log('ℹ️  Roles may have been created already. This is typically not an issue.')
      } else if (error.message.includes('relation') && error.message.includes('does not exist')) {
        console.log('⚠️  The roles table does not exist. Please run database migrations first.')
      } else {
        console.log(`⚠️  Database error: ${error.message}`)
      }
    }

    throw error
  }
}

// Standalone function that can be called directly
export async function runRoleSeeding(): Promise<boolean> {
  try {
    await seedDefaultRoles()
    return true
  } catch (error) {
    console.error('Failed to seed roles:', error)
    return false
  }
}

// Export individual role definitions for reference
export const ROLE_DEFINITIONS = {
  SUPERADMIN: { id: 1, name: 'superadmin' },
  ADMIN: { id: 2, name: 'admin' },
  USER: { id: 3, name: 'user' },
} as const
