import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Database connection configuration
const connectionString = process.env.DATABASE_URL || ''

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined')
}

// Create PostgreSQL client
const client = postgres(connectionString, {
  max: 1,
  idle_timeout: 20,
  connect_timeout: 60,
})

// Create Drizzle instance with schema
export const db = drizzle(client, { schema })

// Export schema tables for direct access
export { users, conversations, messages, notes, roles, genders } from './schema'

// Connection health check
export const checkConnection = async () => {
  try {
    await client`SELECT 1`
    return { healthy: true, message: 'Database connection successful' }
  } catch (error) {
    return { healthy: false, message: `Database connection failed: ${error}` }
  }
}

// Graceful shutdown
export const closeConnection = async () => {
  await client.end()
}
