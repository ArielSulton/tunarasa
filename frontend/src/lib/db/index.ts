import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import 'dotenv/config'

// Database connection string
const connectionString = process.env.DATABASE_URL || ''

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required')
}

// Create a postgres connection
export const client = postgres(connectionString)

// Create drizzle instance
export const db = drizzle(client, { schema })

// Export types for use in the application
export type Database = typeof db
export * from './schema'
