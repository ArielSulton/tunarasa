/**
 * Performance optimization utilities for React components
 * Provides memoization, debouncing, throttling, and monitoring utilities
 */

/* eslint-disable @typescript-eslint/prefer-nullish-coalescing */
/* eslint-disable react-hooks/exhaustive-deps */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

// Performance monitoring interface
interface PerformanceMetrics {
  renderTime: number
  renderCount: number
  lastRenderAt: number
  averageRenderTime: number
  slowRenders: number
}

// Generic debounce function with TypeScript support
/* eslint-disable @typescript-eslint/no-explicit-any */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate?: boolean,
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | undefined

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = undefined
      if (!immediate) func(...args)
    }

    const callNow = immediate && !timeout
    clearTimeout(timeout)
    timeout = setTimeout(later, wait)

    if (callNow) func(...args)
  }
}

// Generic throttle function with TypeScript support
export function throttle<T extends (...args: any[]) => any>(func: T, limit: number): (...args: Parameters<T>) => void {
  let inThrottle: boolean

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

// Hook for debounced values
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Hook for throttled values
export function useThrottle<T>(value: T, limit: number): T {
  const [throttledValue, setThrottledValue] = useState<T>(value)
  const lastRan = useRef<number>(Date.now())

  useEffect(() => {
    const handler = setTimeout(
      () => {
        if (Date.now() - lastRan.current >= limit) {
          setThrottledValue(value)
          lastRan.current = Date.now()
        }
      },
      limit - (Date.now() - lastRan.current),
    )

    return () => {
      clearTimeout(handler)
    }
  }, [value, limit])

  return throttledValue
}

// Hook for performance monitoring
export function usePerformanceMonitor(componentName: string): PerformanceMetrics {
  const metricsRef = useRef<PerformanceMetrics>({
    renderTime: 0,
    renderCount: 0,
    lastRenderAt: Date.now(),
    averageRenderTime: 0,
    slowRenders: 0,
  })

  const startTimeRef = useRef<number>(performance.now())

  useEffect(() => {
    const endTime = performance.now()
    const renderTime = endTime - startTimeRef.current
    const metrics = metricsRef.current

    metrics.renderTime = renderTime
    metrics.renderCount += 1
    metrics.lastRenderAt = Date.now()
    metrics.averageRenderTime =
      (metrics.averageRenderTime * (metrics.renderCount - 1) + renderTime) / metrics.renderCount

    // Track slow renders (>16ms for 60fps)
    if (renderTime > 16) {
      metrics.slowRenders += 1
    }

    // Log performance warnings in development
    if (process.env.NODE_ENV === 'development') {
      if (renderTime > 50) {
        console.warn(`🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`)
      }

      if (metrics.renderCount % 100 === 0) {
        console.log(`📊 ${componentName} Performance:`, {
          totalRenders: metrics.renderCount,
          avgRenderTime: metrics.averageRenderTime.toFixed(2) + 'ms',
          slowRenders: metrics.slowRenders,
          slowRenderPercentage: ((metrics.slowRenders / metrics.renderCount) * 100).toFixed(1) + '%',
        })
      }
    }

    startTimeRef.current = performance.now()
  })

  return metricsRef.current
}

// Hook for memoized expensive calculations
export function useMemoizedValue<T>(factory: () => T, deps: React.DependencyList, debugName?: string): T {
  return useMemo(() => {
    const start = performance.now()
    const result = factory()
    const duration = performance.now() - start

    if (process.env.NODE_ENV === 'development' && duration > 10) {
      console.warn(`🔄 Expensive calculation in ${debugName || 'unknown'}: ${duration.toFixed(2)}ms`)
    }

    return result
  }, deps)
}

// Hook for stable callback references
export function useStableCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList,
): T {
  return useCallback(callback, deps)
}

// Hook for component mounting/unmounting tracking
export function useComponentLifecycle(componentName: string) {
  const mountTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    const mountTime = Date.now()
    mountTimeRef.current = mountTime

    if (process.env.NODE_ENV === 'development') {
      console.log(`🚀 ${componentName} mounted at ${new Date(mountTime).toISOString()}`)
    }

    return () => {
      const unmountTime = Date.now()
      const lifetime = unmountTime - mountTimeRef.current

      if (process.env.NODE_ENV === 'development') {
        console.log(`💀 ${componentName} unmounted after ${lifetime}ms (${(lifetime / 1000).toFixed(1)}s)`)
      }
    }
  }, [componentName])
}

// Hook for detecting re-renders and their causes
export function useWhyDidYouUpdate(name: string, props: Record<string, unknown>) {
  const previousProps = useRef<Record<string, unknown>>({})

  useEffect(() => {
    if (previousProps.current) {
      const allKeys = Object.keys({ ...previousProps.current, ...props })
      const changedProps: Record<string, { from: unknown; to: unknown }> = {}

      allKeys.forEach((key) => {
        if (previousProps.current[key] !== props[key]) {
          changedProps[key] = {
            from: previousProps.current[key],
            to: props[key],
          }
        }
      })

      if (Object.keys(changedProps).length && process.env.NODE_ENV === 'development') {
        console.log('🔄 Props changed in', name, changedProps)
      }
    }

    previousProps.current = props
  })
}

// Memory usage monitoring hook
export function useMemoryMonitor(componentName: string, interval: number = 5000) {
  useEffect(() => {
    if (typeof window === 'undefined' || !('memory' in performance)) {
      return
    }

    const monitorMemory = () => {
      const memory = (performance as any).memory
      if (memory) {
        const used = Math.round((memory.usedJSHeapSize / 1048576) * 100) / 100
        const total = Math.round((memory.totalJSHeapSize / 1048576) * 100) / 100
        const limit = Math.round((memory.jsHeapSizeLimit / 1048576) * 100) / 100

        if (process.env.NODE_ENV === 'development') {
          console.log(`🧠 Memory usage in ${componentName}:`, {
            used: `${used} MB`,
            total: `${total} MB`,
            limit: `${limit} MB`,
            usage: `${Math.round((used / limit) * 100)}%`,
          })
        }

        // Warn if memory usage is high
        if (used / limit > 0.8) {
          console.warn(`⚠️ High memory usage detected in ${componentName}: ${Math.round((used / limit) * 100)}%`)
        }
      }
    }

    const intervalId = setInterval(monitorMemory, interval)
    return () => clearInterval(intervalId)
  }, [componentName, interval])
}

// Intersection observer hook for lazy loading
export function useIntersectionObserver(elementRef: React.RefObject<Element>, options?: IntersectionObserverInit) {
  const [isIntersecting, setIsIntersecting] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting)
    }, options)

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [elementRef, options])

  return isIntersecting
}

// Virtual list hook for large datasets
export function useVirtualList<T>(items: T[], itemHeight: number, containerHeight: number, overscan: number = 5) {
  const [scrollTop, setScrollTop] = useState(0)

  const visibleRange = useMemo(() => {
    const itemCount = items.length
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan)
    const endIndex = Math.min(itemCount - 1, Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan)

    return { startIndex, endIndex }
  }, [scrollTop, itemHeight, containerHeight, overscan, items.length])

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex + 1).map((item, index) => ({
      item,
      index: visibleRange.startIndex + index,
    }))
  }, [items, visibleRange])

  const totalHeight = items.length * itemHeight

  return {
    visibleItems,
    totalHeight,
    setScrollTop,
    visibleRange,
  }
}

// Image lazy loading hook
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '')
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    if (!src) return

    const img = new Image()

    img.onload = () => {
      setImageSrc(src)
      setIsLoaded(true)
    }

    img.onerror = () => {
      setHasError(true)
    }

    img.src = src

    return () => {
      img.onload = null
      img.onerror = null
    }
  }, [src])

  return { imageSrc, isLoaded, hasError }
}

// Performance measurement utilities
export const performanceUtils = {
  measure: <T extends (...args: unknown[]) => unknown>(name: string, fn: T): T => {
    return ((...args: Parameters<T>) => {
      const start = performance.now()
      const result = fn(...args)
      const duration = performance.now() - start

      if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`)
      }

      return result
    }) as T
  },

  measureAsync: <T extends (...args: unknown[]) => Promise<unknown>>(name: string, fn: T): T => {
    return (async (...args: Parameters<T>) => {
      const start = performance.now()
      const result = await fn(...args)
      const duration = performance.now() - start

      if (process.env.NODE_ENV === 'development') {
        console.log(`⏱️ ${name} (async): ${duration.toFixed(2)}ms`)
      }

      return result
    }) as T
  },
}

// Bundle analyzer helper for development
export function analyzeBundleSize() {
  if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
    // This would integrate with webpack-bundle-analyzer in a real setup
    console.log('📦 Bundle analysis would be available in development mode')
  }
}
