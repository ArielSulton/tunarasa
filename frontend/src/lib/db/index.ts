import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Lazy database connection - only initialize when needed
let clientInstance: postgres.Sql | null = null
let dbInstance: ReturnType<typeof drizzle> | null = null

function getConnectionString(): string {
  // Database connection string - prioritize Docker environment
  const connectionString =
    process.env.DATABASE_URL ?? // Docker environment
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? // Fallback to Supabase
    ''

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  return connectionString
}

function initializeDatabase() {
  if (clientInstance && dbInstance) {
    return { client: clientInstance, db: dbInstance }
  }

  const connectionString = getConnectionString()

  // Debug logging for Docker environment
  if (process.env.NODE_ENV === 'development') {
    console.log('🔧 [Database] Connection string source:', {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      connectionPreview: connectionString.substring(0, 20) + '...',
    })
  }

  // Create a postgres connection with enhanced resilience
  clientInstance = postgres(connectionString, {
    max: 10, // Maximum connections in pool
    idle_timeout: 20, // Close idle connections after 20 seconds
    connect_timeout: 60, // Wait up to 60 seconds for initial connection
    prepare: false, // Disable prepared statements for better compatibility
    onnotice: process.env.NODE_ENV === 'development' ? console.log : undefined, // Log notices in dev
    // retry_delay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000), // Exponential backoff max 10s - disabled as not supported in this postgres version
  })

  // Create drizzle instance
  dbInstance = drizzle(clientInstance, { schema })

  return { client: clientInstance, db: dbInstance }
}

// Export lazy getters
export function getClient() {
  return initializeDatabase().client
}

export function getDb() {
  return initializeDatabase().db
}

// Legacy support - export db as a lazy getter with proper typing
export const db: ReturnType<typeof drizzle<typeof schema>> = new Proxy(
  {} as ReturnType<typeof drizzle<typeof schema>>,
  {
    get(_target, prop) {
      const database = getDb()
      return database[prop as keyof typeof database]
    },
  },
)

// Also export client for legacy support
export const client: postgres.Sql = new Proxy({} as postgres.Sql, {
  get(_target, prop) {
    const c = getClient()
    return c[prop as keyof typeof c]
  },
})

// Export types for use in the application
export type Database = ReturnType<typeof getDb>
export * from './schema'
