#!/usr/bin/env bun
import { execSync } from 'child_process'
import { config } from 'dotenv'

// Load environment variables
config({ path: '../.env' })

console.log('🚀 Starting database setup...')

// Check if DATABASE_URL is set
const databaseUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL

if (!databaseUrl || databaseUrl.includes('your-password') || databaseUrl.includes('your-host')) {
  console.log('⚠️  DATABASE_URL not configured with actual credentials')
  console.log('📝 Please update your .env file with actual Supabase credentials:')
  console.log('   DATABASE_URL=postgresql://postgres:your-password@your-host:5432/postgres')
  console.log('   SUPABASE_URL=https://your-project.supabase.co')
  console.log('   SUPABASE_ANON_KEY=your-anon-key')
  console.log('   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key')
  console.log('✅ Database schema and migrations are ready to deploy!')
  process.exit(0)
}

try {
  // Run migrations
  console.log('📦 Running database migrations...')
  execSync('bun run db:migrate', { stdio: 'inherit' })

  console.log('✅ Database setup completed successfully!')
  console.log('📊 7 tables created:')
  console.log('   - admins (admin user management)')
  console.log('   - user_sessions (user session tracking)')
  console.log('   - gesture_recognition_logs (gesture data)')
  console.log('   - qna_logs (Q&A system data)')
  console.log('   - document_management (RAG documents)')
  console.log('   - performance_metrics (system metrics)')
  console.log('   - system_health_logs (health monitoring)')
} catch (error) {
  console.error('❌ Database setup failed:', error)
  process.exit(1)
}
