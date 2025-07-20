import { migrate } from 'drizzle-orm/postgres-js/migrator'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { config } from 'dotenv'

// Load environment variables
config({ path: '../.env' })

const connectionString = process.env.DATABASE_URL || ''

if (!connectionString) {
  throw new Error('DATABASE_URL is not defined')
}

const client = postgres(connectionString, { max: 1 })
const db = drizzle(client)

const main = async () => {
  console.log('🚀 Starting database migration...')

  try {
    await migrate(db, { migrationsFolder: './drizzle' })
    console.log('✅ Database migration completed successfully!')
  } catch (error) {
    console.error('❌ Database migration failed:', error)
    process.exit(1)
  }

  await client.end()
}

main().catch((error) => {
  console.error('❌ Migration script failed:', error)
  process.exit(1)
})
