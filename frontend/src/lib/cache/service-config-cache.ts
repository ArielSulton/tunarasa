// Simple in-memory cache for service config
interface CacheEntry {
  data: unknown
  timestamp: number
  expiry: number
}

class ServiceConfigCache {
  private cache = new Map<string, CacheEntry>()
  private readonly TTL = 60000 // 1 minute cache

  set(key: string, data: unknown): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + this.TTL,
    })
  }

  get(key: string): unknown | null {
    const entry = this.cache.get(key)

    if (!entry) return null

    if (Date.now() > entry.expiry) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  clear(): void {
    this.cache.clear()
  }

  isValid(key: string): boolean {
    const entry = this.cache.get(key)
    return entry ? Date.now() <= entry.expiry : false
  }
}

export const serviceConfigCache = new ServiceConfigCache()
