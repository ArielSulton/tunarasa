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

// Create a postgres connection
export const client = postgres(connectionString)

// Create drizzle instance
export const db = drizzle(client, { schema })

// Export types for use in the application
export type Database = typeof db
export * from './schema'
