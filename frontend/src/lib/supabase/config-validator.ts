/**
 * Supabase Configuration Validator
 * Validates Supabase environment variables and provides helpful error messages
 */

export interface SupabaseConfigValidation {
  isValid: boolean
  errors: string[]
  warnings: string[]
  config?: {
    url: string
    anonKey: string
    serviceRoleKey?: string
  }
}

export function validateSupabaseConfig(): SupabaseConfigValidation {
  const errors: string[] = []
  const warnings: string[] = []

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  // Check if variables exist
  if (!supabaseUrl) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL environment variable is missing')
  }

  if (!supabaseAnonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable is missing')
  }

  // Check for placeholder values
  const placeholderPatterns = [
    'your-project-ref',
    'your-supabase-anon-key-here',
    'your_supabase_project_url_here',
    'your_supabase_anon_key_here',
    'TO_BE_REPLACED',
    'REPLACE_WITH_YOUR',
  ]

  if (supabaseUrl) {
    const hasPlaceholder = placeholderPatterns.some((pattern) => supabaseUrl.includes(pattern))
    if (hasPlaceholder) {
      errors.push(
        'NEXT_PUBLIC_SUPABASE_URL contains placeholder text. Please replace with your actual Supabase project URL.',
      )
    } else if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('.supabase.co')) {
      errors.push(
        `Invalid NEXT_PUBLIC_SUPABASE_URL format. Expected: https://your-project-ref.supabase.co, got: ${supabaseUrl}`,
      )
    }
  }

  if (supabaseAnonKey) {
    const hasPlaceholder = placeholderPatterns.some((pattern) => supabaseAnonKey.includes(pattern))
    if (hasPlaceholder) {
      errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY contains placeholder text. Please replace with your actual anon key.')
    } else if (supabaseAnonKey.length < 100) {
      warnings.push('NEXT_PUBLIC_SUPABASE_ANON_KEY seems too short. Supabase anon keys are typically longer.')
    }
  }

  if (supabaseServiceKey) {
    const hasPlaceholder = placeholderPatterns.some((pattern) => supabaseServiceKey.includes(pattern))
    if (hasPlaceholder) {
      warnings.push('SUPABASE_SERVICE_ROLE_KEY contains placeholder text. This may cause admin operations to fail.')
    }
  } else {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY is missing. Admin operations may not work properly.')
  }

  const isValid = errors.length === 0

  return {
    isValid,
    errors,
    warnings,
    config: isValid
      ? {
          url: supabaseUrl!,
          anonKey: supabaseAnonKey!,
          serviceRoleKey: supabaseServiceKey,
        }
      : undefined,
  }
}

export function logConfigValidation(): boolean {
  const validation = validateSupabaseConfig()

  console.log('🔧 [Supabase Config] Validation Results:')
  console.log(`- Valid: ${validation.isValid ? '✅' : '❌'}`)

  if (validation.errors.length > 0) {
    console.error('❌ Configuration Errors:')
    validation.errors.forEach((error) => console.error(`  - ${error}`))
  }

  if (validation.warnings.length > 0) {
    console.warn('⚠️ Configuration Warnings:')
    validation.warnings.forEach((warning) => console.warn(`  - ${warning}`))
  }

  if (!validation.isValid) {
    console.error('')
    console.error('🚨 SUPABASE CONFIGURATION REQUIRED:')
    console.error('Please update your .env.local file with actual Supabase credentials.')
    console.error('See SUPABASE_SETUP_INSTRUCTIONS.md for detailed setup steps.')
    console.error('')
  }

  return validation.isValid
}

export function getSupabaseConfigHelp(): string {
  return `
🚨 Supabase Configuration Required

Your Supabase environment variables need to be configured with actual project credentials.

Quick Fix:
1. Go to https://supabase.com/dashboard
2. Select your project (or create one)
3. Navigate to Settings → API
4. Copy your Project URL and API keys
5. Update .env.local with actual values

Current placeholders detected in:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY  
- SUPABASE_SERVICE_ROLE_KEY

See SUPABASE_SETUP_INSTRUCTIONS.md for detailed steps.
`
}
