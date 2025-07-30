import { defineConfig } from 'drizzle-kit'
import { config } from 'dotenv'

// Load environment variables from parent directory
config({ path: '../.env' })

export default defineConfig({
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL || '',
  },

  // Enable migrations with RLS support
  migrations: {
    prefix: 'supabase',
    schema: 'public',
    table: '__drizzle_migrations',
  },

  // Supabase specific configuration
  schemaFilter: ['public'],
  tablesFilter: ['!auth.*', '!storage.*', '!realtime.*'],

  // Additional options
  breakpoints: true,
  strict: true,
  verbose: true,
})
