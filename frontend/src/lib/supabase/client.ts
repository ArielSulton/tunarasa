'use client'

import { createBrowserClient } from '@supabase/ssr'
import { validateSupabaseConfig, getSupabaseConfigHelp } from './config-validator'

// Singleton instance to avoid multiple GoTrueClient instances
let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null

/**
 * Client-side Supabase Client using SSR package
 * Following official Supabase Next.js patterns
 * Uses singleton pattern to avoid multiple GoTrueClient instances
 */
export function createClient() {
  // Return existing instance if already created
  if (supabaseInstance) {
    console.log('🔄 [Supabase Client] Returning existing instance')
    return supabaseInstance
  }
  console.log('🔗 [Supabase Client] Initializing...')

  // Validate configuration using the validator
  const validation = validateSupabaseConfig()

  if (!validation.isValid) {
    const errorMessage = `Supabase configuration is invalid:\n${validation.errors.join('\n')}\n\n${getSupabaseConfigHelp()}`
    console.error('❌ [Supabase Client] Configuration Error:', errorMessage)
    throw new Error(errorMessage)
  }

  if (validation.warnings.length > 0 && typeof window !== 'undefined') {
    console.warn('⚠️ [Supabase Client] Configuration Warnings:')
    validation.warnings.forEach((warning) => console.warn(`  - ${warning}`))
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = validation.config!

  // Configuration is already validated above

  console.log('✅ [Supabase Client] Configuration valid, creating client...')

  try {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey)
    console.log('✅ [Supabase Client] Successfully created singleton instance!')
    return supabaseInstance
  } catch (error) {
    console.error('❌ [Supabase Client] Failed to create client:', error)
    throw error
  }
}

/**
 * Clear the singleton instance (useful for testing or reinitialization)
 */
export function clearSupabaseInstance() {
  console.log('🔄 [Supabase Client] Clearing singleton instance')
  supabaseInstance = null
}
