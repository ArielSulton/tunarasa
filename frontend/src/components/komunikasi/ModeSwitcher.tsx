'use client'

import { useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Bot, Users } from 'lucide-react'
import { useServiceMode } from '@/hooks/use-service-config'
import { useUserRole } from '@/components/auth/SuperAdminOnly'
import { serviceConfigCache } from '@/lib/cache/service-config-cache'

interface ModeSwitcherProps {
  onModeChange?: () => void
}

export function ModeSwitcher({ onModeChange }: ModeSwitcherProps) {
  const { serviceMode, loading: serviceModeLoading } = useServiceMode()
  const { isAdmin, isSuperAdmin } = useUserRole()
  const [isUpdating, setIsUpdating] = useState(false)

  // Only show for admin users
  if (!isAdmin && !isSuperAdmin) {
    return (
      <Badge variant="outline" className="text-xs">
        {serviceMode === 'full_llm_bot' ? (
          <>
            <Bot className="mr-1 h-3 w-3" />
            AI Bot
          </>
        ) : (
          <>
            <Users className="mr-1 h-3 w-3" />
            Dukungan Manusia
          </>
        )}
      </Badge>
    )
  }

  const handleModeChange = async (newMode: string) => {
    console.log('🔄 [ModeSwitcher] Mode change requested:', { from: serviceMode, to: newMode })

    if (newMode === serviceMode) {
      console.log('⚠️ [ModeSwitcher] Mode already set, no change needed')
      return
    }

    if (isUpdating) {
      console.log('⚠️ [ModeSwitcher] Already updating, skipping')
      return
    }

    console.log('📡 [ModeSwitcher] Starting mode update request...')
    setIsUpdating(true)

    try {
      const requestBody = { serviceMode: newMode }
      console.log('📤 [ModeSwitcher] API Request:', requestBody)

      const response = await fetch('/api/service-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      console.log('📥 [ModeSwitcher] API Response status:', response.status, response.statusText)

      if (!response.ok) {
        const errorData = await response.text().catch(() => 'No error data')
        console.error('❌ [ModeSwitcher] API Error:', { status: response.status, error: errorData })
        throw new Error(`Failed to update service mode: ${response.status} - ${errorData}`)
      }

      const responseData = await response.json()
      console.log('📥 [ModeSwitcher] API Response data:', responseData)

      // Clear cache to force refresh
      serviceConfigCache.clear()
      console.log('✅ [ModeSwitcher] Service config cache cleared')

      // Dispatch custom event to notify other components
      window.dispatchEvent(
        new CustomEvent('service-config-updated', {
          detail: { serviceMode: newMode },
        }),
      )
      console.log('✅ [ModeSwitcher] Service config updated event dispatched with mode:', newMode)

      // Callback to parent component
      onModeChange?.()
    } catch (error) {
      console.error('❌ [ModeSwitcher] Failed to update service mode:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  if (serviceModeLoading) {
    return (
      <Badge variant="outline" className="text-xs">
        <div className="mr-1 h-3 w-3 animate-spin rounded-full border border-current border-t-transparent"></div>
        Memuat...
      </Badge>
    )
  }

  return (
    <Select value={serviceMode} onValueChange={(value) => void handleModeChange(value)} disabled={isUpdating}>
      <SelectTrigger className="h-8 w-auto border-0 bg-transparent p-2 text-xs">
        <SelectValue>
          {serviceMode === 'full_llm_bot' ? (
            <div className="flex items-center gap-1">
              <Bot className="h-3 w-3" />
              <span>AI Bot</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <Users className="h-3 w-3" />
              <span>Human Support</span>
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="full_llm_bot">
          <div className="flex items-center gap-2">
            <Bot className="h-3 w-3" />
            <span>AI Bot</span>
          </div>
        </SelectItem>
        <SelectItem value="bot_with_admin_validation">
          <div className="flex items-center gap-2">
            <Users className="h-3 w-3" />
            <span>Human Support</span>
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  )
}
