'use client'

import { useEffect, useState } from 'react'
import { AuthStatus } from './auth-components'

export function AuthStatusWrapper() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return (
      <div className="flex items-center space-x-2">
        <div className="bg-muted h-8 w-8 animate-pulse rounded-full" />
      </div>
    )
  }

  return <AuthStatus />
}
