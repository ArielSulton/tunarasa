'use client'

import { createClient } from '@/lib/supabase/client'
import { useMemo } from 'react'

/**
 * Hook to get Supabase client
 * Following official Supabase patterns
 */
export function useSupabaseClient() {
  return useMemo(() => createClient(), [])
}
