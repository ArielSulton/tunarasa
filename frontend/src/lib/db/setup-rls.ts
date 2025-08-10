/**
 * Database RLS Policy Setup Utility
 *
 * This file provides utilities to set up Row Level Security policies
 * for the Tunarasa application database.
 */

import { sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from './schema'

/**
 * Apply all RLS policies to the database
 *
 * This function should be run after creating tables to ensure
 * proper Row Level Security is configured for user sign-up
 * and data access patterns.
 */
export async function setupRLSPolicies(db: PostgresJsDatabase<typeof schema>) {
  console.log('🔒 Setting up Row Level Security policies...')

  try {
    // Apply all policies using the master function from schema
    await db.execute(schema.applyAllRLSPolicies)

    console.log('✅ RLS policies applied successfully!')
    return { success: true }
  } catch (error) {
    console.error('❌ Failed to apply RLS policies:', error)
    return { success: false, error }
  }
}

/**
 * Apply individual policy sets (for debugging or selective application)
 */
export async function setupIndividualPolicies(db: PostgresJsDatabase<typeof schema>) {
  const policies = [
    { name: 'Roles Policies', sql: schema.rolesPolicies },
    { name: 'Genders Policies', sql: schema.gendersPolicies },
    { name: 'Users Policies', sql: schema.usersPolicies },
    { name: 'User Sync Log Policies', sql: schema.userSyncLogPolicies },
    { name: 'Admin Invitations Policies', sql: schema.adminInvitationsPolicies },
    { name: 'Conversations Policies', sql: schema.conversationsPolicies },
    { name: 'Messages Policies', sql: schema.messagesPolicies },
    // { name: 'Sessions Policies', sql: schema.sessionsPolicies }, // Removed as sessions table was removed
    { name: 'QA Logs Policies', sql: schema.qaLogsPolicies },
    { name: 'Notes Policies', sql: schema.notesPolicies },
    { name: 'App Settings Policies', sql: schema.appSettingsPolicies },
    { name: 'Admin Queue Policies', sql: schema.adminQueuePolicies },
  ]

  const results = []

  for (const policy of policies) {
    try {
      console.log(`🔒 Applying ${policy.name}...`)
      await db.execute(policy.sql)
      console.log(`✅ ${policy.name} applied successfully`)
      results.push({ name: policy.name, success: true })
    } catch (error) {
      console.error(`❌ Failed to apply ${policy.name}:`, error)
      results.push({ name: policy.name, success: false, error })
    }
  }

  return results
}

/**
 * Verify RLS policies are working correctly
 */
export async function verifyRLSPolicies(db: PostgresJsDatabase<typeof schema>) {
  console.log('🔍 Verifying RLS policies...')

  try {
    // Check if policies exist for critical tables
    const policyCheck = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        policyname,
        cmd,
        permissive
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'user_sync_log', 'roles', 'genders')
      ORDER BY tablename, policyname;
    `)

    console.log('📋 Current RLS policies:', policyCheck)

    // Verify RLS is enabled on critical tables
    const rlsCheck = await db.execute(sql`
      SELECT 
        schemaname,
        tablename,
        rowsecurity
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'user_sync_log', 'roles', 'genders', 'admin_invitations')
      ORDER BY tablename;
    `)

    console.log('🔒 RLS status:', rlsCheck)

    return {
      success: true,
      policies: policyCheck,
      rlsStatus: rlsCheck,
    }
  } catch (error) {
    console.error('❌ Failed to verify RLS policies:', error)
    return { success: false, error }
  }
}

/**
 * Test user sign-up flow with RLS policies
 */
export async function testUserSignUpFlow(db: PostgresJsDatabase<typeof schema>, testUserId: string, testEmail: string) {
  console.log('🧪 Testing user sign-up flow...')

  try {
    // Test inserting a user record (simulating what the trigger does)
    const result = await db
      .insert(schema.users)
      .values({
        supabaseUserId: testUserId,
        email: testEmail,
        emailVerified: true,
        roleId: 3, // Regular user
        isActive: true,
      })
      .returning()

    console.log('✅ User insertion successful:', result)

    // Test inserting sync log
    const syncResult = await db
      .insert(schema.userSyncLog)
      .values({
        supabaseUserId: testUserId,
        eventType: 'auth.user.created',
        syncStatus: 'success',
        supabasePayload: { test: true },
      })
      .returning()

    console.log('✅ Sync log insertion successful:', syncResult)

    return { success: true, user: result[0], syncLog: syncResult[0] }
  } catch (error) {
    console.error('❌ User sign-up test failed:', error)
    return { success: false, error }
  }
}
