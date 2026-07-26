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

/**
 * Hard ceiling on stored entries. Callers control `from`/`to` freely, so without a
 * bound a single client can mint unlimited unique keys and grow this Map without
 * limit between cleanup passes. On overflow we evict oldest-first.
 */
const MAX_ENTRIES = 500;

class AnalyticsCache {
  private store = new Map<string, CacheEntry<unknown>>();
  /**
   * Keys with a fetch already in flight. Without this, N concurrent requests on a
   * cold key each run the full query fan-out; SSR prefetch + client hydration alone
   * produces two. Holding the promise means later callers await the first fetch.
   */
  private inFlight = new Map<string, Promise<unknown>>();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    // Periodic cleanup every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 300_000);
    // Never let this timer hold the process open during shutdown.
    this.cleanupInterval.unref?.();
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
    this.write(this.key(tenantId, queryName, params), data, ttlMs);
  }

  /** Insert/replace an entry, evicting the oldest if we are at the ceiling. */
  private write<T>(key: string, data: T, ttlMs: number): void {
    if (!this.store.has(key) && this.store.size >= MAX_ENTRIES) {
      // Map preserves insertion order, so the first key is the oldest write.
      const oldest = this.store.keys().next();
      if (!oldest.done) this.store.delete(oldest.value);
    }
    this.store.set(key, { data, createdAt: Date.now(), ttlMs });
  }

  /**
   * Get cached value or fetch fresh data.
   * If staleWhileRevalidate is true and cache is expired but within 2x TTL,
   * returns stale data immediately and triggers background refresh.
   *
   * Concurrent callers for the same key share one fetch. Fetch failures are
   * swallowed for background revalidation (the stale value is still good) and
   * rethrown for callers that have nothing to return.
   */
  async getOrFetch<T>(
    tenantId: string,
    queryName: string,
    params: Record<string, string>,
    fetcher: () => Promise<T>,
    options: {
      ttlMs: number;
      staleWhileRevalidate?: boolean;
      onError?: (error: unknown) => void;
    },
  ): Promise<T> {
    const k = this.key(tenantId, queryName, params);
    const entry = this.store.get(k);

    if (entry) {
      const age = Date.now() - entry.createdAt;

      // Fresh — return cached
      if (age <= entry.ttlMs) {
        return entry.data as T;
      }

      // Stale but within 2x TTL — return stale, revalidate in background.
      // The catch is load-bearing: an unhandled rejection here terminates the
      // Node process, and this runs detached from any request that could report it.
      if (options.staleWhileRevalidate && age <= entry.ttlMs * 2) {
        void this.dedupedFetch(k, fetcher, options.ttlMs).catch((error) => {
          options.onError?.(error);
        });
        return entry.data as T;
      }
    }

    // No cache or fully expired — must fetch. Errors propagate to the caller.
    return this.dedupedFetch(k, fetcher, options.ttlMs);
  }

  /** Run `fetcher` for `key`, or join the fetch already running for it. */
  private dedupedFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number,
  ): Promise<T> {
    const pending = this.inFlight.get(key);
    if (pending) return pending as Promise<T>;

    const promise = fetcher()
      .then((data) => {
        this.write(key, data, ttlMs);
        return data;
      })
      .finally(() => {
        this.inFlight.delete(key);
      });

    this.inFlight.set(key, promise);
    return promise;
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
    this.inFlight.clear();
  }
}

/** Singleton cache instance. */
export const analyticsCache = new AnalyticsCache();
