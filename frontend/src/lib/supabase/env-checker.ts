'use client'

/**
 * Environment variable checker for Supabase configuration
 * This helps diagnose configuration issues
 */

interface EnvCheckResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  details: {
    supabaseUrl: {
      exists: boolean
      value?: string
      isValidUrl: boolean
    }
    anonKey: {
      exists: boolean
      length?: number
      isPlaceholder: boolean
      preview?: string
    }
  }
}

export function checkSupabaseEnvironment(): EnvCheckResult {
  const errors: string[] = []
  const warnings: string[] = []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Check Supabase URL
  const urlCheck = {
    exists: !!supabaseUrl,
    value: supabaseUrl,
    isValidUrl: false,
  }

  if (!supabaseUrl) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL is not set')
  } else {
    urlCheck.isValidUrl = supabaseUrl.startsWith('https://') && supabaseUrl.includes('.supabase.co')
    if (!urlCheck.isValidUrl) {
      errors.push('NEXT_PUBLIC_SUPABASE_URL does not appear to be a valid Supabase URL')
    }
  }

  // Check Anonymous Key
  const keyCheck = {
    exists: !!anonKey,
    length: anonKey?.length,
    isPlaceholder: anonKey?.includes('TO_BE_REPLACED') ?? false,
    preview: anonKey?.substring(0, 20) + '...',
  }

  if (!anonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  } else if (keyCheck.isPlaceholder) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY contains placeholder text - please replace with actual key')
  } else if (anonKey.length < 100) {
    warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY seems too short - verify it is correct')
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    details: {
      supabaseUrl: urlCheck,
      anonKey: keyCheck,
    },
  }
}

/**
 * Display environment check results in console
 */
export function logEnvironmentCheck(): EnvCheckResult {
  const result = checkSupabaseEnvironment()

  console.log('🔧 Supabase Environment Check')
  console.log('==============================')

  if (result.isValid) {
    console.log('✅ Environment configuration is valid')
  } else {
    console.log('❌ Environment configuration has issues')
  }

  if (result.errors.length > 0) {
    console.log('\\n🚨 Errors:')
    result.errors.forEach((error) => console.log(`  - ${error}`))
  }

  if (result.warnings.length > 0) {
    console.log('\\n⚠️ Warnings:')
    result.warnings.forEach((warning) => console.log(`  - ${warning}`))
  }

  console.log('\\n📊 Details:')
  console.log('  Supabase URL:', result.details.supabaseUrl.exists ? '✅' : '❌')
  if (result.details.supabaseUrl.exists) {
    console.log('    Valid format:', result.details.supabaseUrl.isValidUrl ? '✅' : '❌')
    console.log('    Value:', result.details.supabaseUrl.value?.substring(0, 50) + '...')
  }

  console.log('  Anonymous Key:', result.details.anonKey.exists ? '✅' : '❌')
  if (result.details.anonKey.exists) {
    console.log('    Not placeholder:', !result.details.anonKey.isPlaceholder ? '✅' : '❌')
    console.log('    Length:', result.details.anonKey.length)
    console.log('    Preview:', result.details.anonKey.preview)
  }

  console.log('==============================')

  return result
}
