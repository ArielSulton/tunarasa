import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Database connection string - prioritize Docker environment
const connectionString =
  process.env.DATABASE_URL ?? // Docker environment
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? // Fallback to Supabase
  ''

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Debug logging for Docker environment
if (process.env.NODE_ENV === 'development') {
  console.log('🔧 [Database] Connection string source:', {
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    connectionPreview: connectionString.substring(0, 20) + '...',
  })
}

// Create a postgres connection with enhanced resilience
export const client = postgres(connectionString, {
  max: 10, // Maximum connections in pool
  idle_timeout: 20, // Close idle connections after 20 seconds
  connect_timeout: 60, // Wait up to 60 seconds for initial connection
  prepare: false, // Disable prepared statements for better compatibility
  onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined, // Log notices in dev
  // retry_delay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000), // Exponential backoff max 10s - disabled as not supported in this postgres version
})

// Create drizzle instance
export const db = drizzle(client, { schema })

// Export types for use in the application
export type Database = typeof db
export * from './schema'
