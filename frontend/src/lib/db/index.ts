import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import { sql } from 'drizzle-orm'

// Database connection string
const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || ''

if (!connectionString) {
  throw new Error('DATABASE_URL or SUPABASE_DATABASE_URL environment variable is required')
}

// Create a postgres connection
const client = postgres(connectionString, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
})

// Create drizzle instance
export const db = drizzle(client, { schema })

// Export types for use in the application
export type Database = typeof db
export * from './schema'

// Helper function to close database connection
export const closeDatabase = async () => {
  await client.end()
}

// Database health check
export const healthCheck = async () => {
  try {
    await db.execute(sql`SELECT 1`)
    return { status: 'healthy', timestamp: new Date().toISOString() }
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    }
  }
}

// Export SQL template literal for raw queries
export { sql }
