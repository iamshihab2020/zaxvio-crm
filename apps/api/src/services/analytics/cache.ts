interface CacheEntry<T> {
  data: T;
  createdAt: number;
  ttlMs: number;
}

/** TTL presets for analytics caching. */
export const CACHE_TTL = {
  /** 30 seconds — KPIs, today's jobs, upcoming bookings */
  REALTIME: 30_000,
  /** 5 minutes — monthly trends, charts, aging */
  TRENDS: 300_000,
  /** 10 minutes — full report sections */
  REPORTS: 600_000,
} as const;

class AnalyticsCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300_000);
  }

  /** Build a tenant-scoped cache key. */
  private key(
    tenantId: string,
    queryName: string,
    params: Record<string, string>,
  ): string {
    const paramStr = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    return `analytics:${tenantId}:${queryName}:${paramStr}`;
  }

  /** Get cached value if still fresh, or null. */
  get<T>(
    tenantId: string,
    queryName: string,
    params: Record<string, string>,
  ): T | null {
    const k = this.key(tenantId, queryName, params);
    const entry = this.store.get(k);
    if (!entry) return null;

    if (Date.now() - entry.createdAt > entry.ttlMs) {
      this.store.delete(k);
      return null;
    }

    return entry.data as T;
  }

  /** Store a value with TTL. */
  set<T>(
    tenantId: string,
    queryName: string,
    params: Record<string, string>,
    data: T,
    ttlMs: number,
  ): void {
    const k = this.key(tenantId, queryName, params);
    this.store.set(k, { data, createdAt: Date.now(), ttlMs });
  }

  /**
   * Get cached value or fetch fresh data.
   * If staleWhileRevalidate is true and cache is expired but within 2x TTL,
   * returns stale data immediately and triggers background refresh.
   */
  async getOrFetch<T>(
    tenantId: string,
    queryName: string,
    params: Record<string, string>,
    fetcher: () => Promise<T>,
    options: { ttlMs: number; staleWhileRevalidate?: boolean },
  ): Promise<T> {
    const k = this.key(tenantId, queryName, params);
    const entry = this.store.get(k);

    if (entry) {
      const age = Date.now() - entry.createdAt;

      // Fresh — return cached
      if (age <= entry.ttlMs) {
        return entry.data as T;
      }

      // Stale but within 2x TTL — return stale, revalidate in background
      if (options.staleWhileRevalidate && age <= entry.ttlMs * 2) {
        void fetcher().then((data) => {
          this.store.set(k, {
            data,
            createdAt: Date.now(),
            ttlMs: options.ttlMs,
          });
        });
        return entry.data as T;
      }
    }

    // No cache or fully expired — must fetch
    const data = await fetcher();
    this.store.set(k, { data, createdAt: Date.now(), ttlMs: options.ttlMs });
    return data;
  }

  /** Invalidate all entries for a tenant. */
  invalidateTenant(tenantId: string): void {
    const prefix = `analytics:${tenantId}:`;
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /** Remove all expired entries. */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.createdAt > entry.ttlMs * 2) {
        this.store.delete(key);
      }
    }
  }

  /** Destroy the cleanup interval (for tests/shutdown). */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.store.clear();
  }
}

/** Singleton cache instance. */
export const analyticsCache = new AnalyticsCache();
