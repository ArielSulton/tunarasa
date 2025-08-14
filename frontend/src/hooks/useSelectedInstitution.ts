'use client'

import { useState, useCallback, useEffect } from 'react'

export interface Institution {
  institutionId: number
  name: string
  slug: string
  description?: string
  logoUrl?: string
  isActive: boolean
  _count?: {
    ragFiles: number
    conversations: number
  }
}

export function useSelectedInstitution() {
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null)
  const [isLoadingDefault, setIsLoadingDefault] = useState(true)

  const selectInstitution = useCallback((institution: Institution) => {
    setSelectedInstitution(institution)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedInstitution(null)
  }, [])

  // Auto-load default dukcapil institution on mount
  useEffect(() => {
    async function loadDefaultInstitution() {
      try {
        const response = await fetch('/api/public/institutions/default', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (response.ok) {
          const data = await response.json()
          if (data.success && data.data.institution) {
            setSelectedInstitution(data.data.institution)
          }
        } else {
          console.warn('Default institution not available, user will need to select manually')
        }
      } catch (error) {
        console.error('Error loading default institution:', error)
        // Don't throw error, let user select manually
      } finally {
        setIsLoadingDefault(false)
      }
    }

    // Only load default if no institution is already selected
    if (!selectedInstitution) {
      void loadDefaultInstitution()
    } else {
      setIsLoadingDefault(false)
    }
  }, [selectedInstitution])

  return {
    selectedInstitution,
    selectInstitution,
    clearSelection,
    hasSelection: selectedInstitution !== null,
    isLoadingDefault,
  }
}
