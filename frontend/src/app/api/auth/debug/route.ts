import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Debug endpoint to inspect the current user session and object structure
 * ⚠️ TEMPORARY: Remove this endpoint after fixing the Supabase configuration
 * This endpoint helps diagnose authentication issues during development
 */
export async function GET(request: NextRequest) {
  try {
    // Create server-side Supabase client
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll() ?? [],
          setAll: () => {}, // No-op for read-only requests
        },
      },
    )

    // Get current session
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

    if (sessionError) {
      console.error('❌ [Debug API] Session error:', sessionError)
    }

    // Get current user
    const { data: userData, error: userError } = await supabase.auth.getUser()

    if (userError) {
      console.error('❌ [Debug API] User error:', userError)
    }

    // Check if Supabase is properly configured
    const hasValidConfig =
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-project-ref') &&
      !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.includes('your-supabase-anon-key-here')

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      configuration: {
        is_valid: hasValidConfig,
        has_supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        has_anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        url_is_placeholder: process.env.NEXT_PUBLIC_SUPABASE_URL?.includes('your-project-ref') ?? true,
        key_is_placeholder: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.includes('your-supabase-anon-key-here') ?? true,
      },
      session: {
        exists: !!sessionData?.session,
        user_id: sessionData?.session?.user?.id ?? null,
        email: sessionData?.session?.user?.email ?? null,
        email_confirmed: sessionData?.session?.user?.email_confirmed_at ?? null,
        error: sessionError?.message ?? null,
      },
      user: {
        exists: !!userData?.user,
        user_id: userData?.user?.id ?? null,
        email: userData?.user?.email ?? null,
        email_confirmed: userData?.user?.email_confirmed_at ?? null,
        user_metadata: userData?.user?.user_metadata ?? null,
        error: userError?.message ?? null,
      },
      environment: {
        node_env: process.env.NODE_ENV,
      },
      headers: {
        authorization: request.headers.get('authorization') ? '[PRESENT]' : '[MISSING]',
        cookie: request.headers.get('cookie') ? '[PRESENT]' : '[MISSING]',
        user_agent: request.headers.get('user-agent') ?? '[MISSING]',
      },
      fix_instructions: hasValidConfig
        ? null
        : {
            message: 'Supabase configuration contains placeholder values',
            action: 'Update .env.local with actual Supabase project credentials',
            documentation: 'See SUPABASE_SETUP_INSTRUCTIONS.md for detailed steps',
          },
    })
  } catch (error) {
    console.error('❌ [Debug API] Exception:', error)

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}
