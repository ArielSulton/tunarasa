/**
 * Apply RLS Policies Script
 *
 * This script applies Row Level Security policies to fix the user sign-up issue.
 * Run this after database migrations to ensure proper RLS configuration.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { readFileSync } from 'fs'
import { join } from 'path'
import { config } from 'dotenv'

// Load environment variables
config({ path: '../../../.env' })

async function applyRLSPolicies() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables')
    process.exit(1)
  }

  console.log('🔗 Connecting to database...')

  // Create connection
  const sql = postgres(databaseUrl, { max: 1 })
  const _db = drizzle(sql)

  try {
    console.log('📋 Reading RLS policies migration file...')

    // Read the comprehensive RLS policies file
    const migrationPath = join(__dirname, '../../../drizzle/20250806120000_comprehensive_rls_policies.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    console.log('🔒 Applying RLS policies...')

    // Split the SQL into individual statements and execute them
    const statements = migrationSQL
      .split('-->')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'))
      .join('')
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'))

    for (const statement of statements) {
      if (statement.includes('SELECT ') || statement.includes('DROP POLICY') || statement.includes('CREATE POLICY')) {
        try {
          await sql.unsafe(statement)
          if (statement.includes('CREATE POLICY')) {
            const policyName = statement.match(/\"([^\"]+)\"/)?.[1] ?? 'unknown'
            console.log(`  ✅ Applied policy: ${policyName}`)
          }
        } catch (error) {
          // Some DROP POLICY statements may fail if policies don't exist, which is okay
          if (!statement.includes('DROP POLICY')) {
            console.error(`❌ Failed to execute statement: ${statement.substring(0, 50)}...`)
            console.error(error)
          }
        }
      }
    }

    console.log('🔍 Verifying RLS policies...')

    // Verify critical policies exist
    const policyCheck = await sql`
      SELECT 
        schemaname,
        tablename,
        policyname,
        cmd
      FROM pg_policies 
      WHERE schemaname = 'public' 
      AND tablename IN ('users', 'user_sync_log', 'roles')
      ORDER BY tablename, policyname;
    `

    console.log('📊 Current RLS policies:')
    for (const policy of policyCheck) {
      console.log(`  🔐 ${policy.tablename}.${policy.policyname} (${policy.cmd})`)
    }

    // Check for the critical sign-up policy
    const signUpPolicy = policyCheck.find(
      (p) => p.tablename === 'users' && p.policyname === 'Users can insert own data',
    )

    if (signUpPolicy) {
      console.log('✅ Critical sign-up policy found! User sign-up should work now.')
    } else {
      console.log('⚠️  Critical sign-up policy not found. There may be an issue.')
    }

    console.log('🎉 RLS policies applied successfully!')
  } catch (error) {
    console.error('❌ Failed to apply RLS policies:', error)
    process.exit(1)
  } finally {
    await sql.end()
  }
}

// Run the script
if (require.main === module) {
  void applyRLSPolicies()
}

export { applyRLSPolicies }
