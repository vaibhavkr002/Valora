/**
 * VELORA - High-Performance Client Cache & Request Deduplicator Engine
 * 
 * Provides:
 * 1. In-flight request deduplication (multiple simultaneous requests share 1 promise)
 * 2. Stale-While-Revalidate (SWR) & TTL caching (in-memory + sessionStorage)
 * 3. Exponential backoff retry with timeout protection
 * 4. Safe event-driven cache invalidation across tabs & admin actions
 */

(function () {
  'use strict';

  const CACHE_PREFIX = 'velora_cache_';
  const VERSION_KEY = 'velora_cache_version';
  const CURRENT_VERSION = 'v1.1';

  // Default TTL settings in milliseconds
  const DEFAULT_TTL = {
    products: 180 * 1000,      // 3 minutes
    categories: 300 * 1000,    // 5 minutes
    banners: 300 * 1000,       // 5 minutes
    delivery_partners: 300 * 1000, // 5 minutes
    store_settings: 300 * 1000,    // 5 minutes
    gift_offers: 300 * 1000,   // 5 minutes
    coupons: 180 * 1000        // 3 minutes
  };

  // In-memory cache store
  const memoryCache = new Map();
  // In-flight active network promises map
  const inFlightRequests = new Map();

  // Initialize version check
  try {
    const savedVer = sessionStorage.getItem(VERSION_KEY);
    if (savedVer !== CURRENT_VERSION) {
      clearAllSessionCache();
      sessionStorage.setItem(VERSION_KEY, CURRENT_VERSION);
    }
  } catch (e) {}

  function clearAllSessionCache() {
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => sessionStorage.removeItem(k));
    } catch (e) {}
    memoryCache.clear();
  }

  /**
   * Get cached entry if valid
   */
  function getCached(key) {
    const now = Date.now();

    // 1. Check memory cache first (instant)
    if (memoryCache.has(key)) {
      const entry = memoryCache.get(key);
      if (entry && entry.expiresAt > now) {
        return entry.data;
      } else {
        memoryCache.delete(key);
      }
    }

    // 2. Check sessionStorage
    try {
      const raw = sessionStorage.getItem(CACHE_PREFIX + key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.expiresAt > now) {
          // Promote to memory cache
          memoryCache.set(key, parsed);
          return parsed.data;
        } else {
          sessionStorage.removeItem(CACHE_PREFIX + key);
        }
      }
    } catch (e) {}

    return null;
  }

  /**
   * Save data into memory and sessionStorage cache
   */
  function setCached(key, data, customTtl) {
    const ttl = customTtl || DEFAULT_TTL[key] || 180 * 1000;
    const expiresAt = Date.now() + ttl;
    const entry = { data, expiresAt, cachedAt: Date.now() };

    memoryCache.set(key, entry);

    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch (e) {
      // Storage full or quota exceeded: prune oldest items
      try {
        memoryCache.clear();
      } catch (_) {}
    }
  }

  /**
   * Invalidate specific cache key or all cache
   */
  function invalidate(key) {
    if (!key) {
      clearAllSessionCache();
    } else {
      memoryCache.delete(key);
      try {
        sessionStorage.removeItem(CACHE_PREFIX + key);
      } catch (e) {}
    }
    window.dispatchEvent(new CustomEvent('velora:cache-invalidated', { detail: { key } }));
  }

  /**
   * Resilient fetch with exponential backoff & timeout
   */
  async function fetchWithRetry(url, options = {}, retries = 2, delayMs = 300, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const mergedOptions = {
      ...options,
      signal: options.signal || controller.signal
    };

    try {
      const res = await fetch(url, mergedOptions);
      clearTimeout(timer);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      return await res.json();
    } catch (err) {
      clearTimeout(timer);
      if (retries > 0 && !controller.signal.aborted) {
        await new Promise(r => setTimeout(r, delayMs));
        return fetchWithRetry(url, options, retries - 1, delayMs * 2, timeoutMs);
      }
      throw err;
    }
  }

  /**
   * Deduplicated Fetch or Cache Loader
   * If cached, returns immediately.
   * If in-flight, awaits the existing promise instead of making a duplicate call.
   */
  async function getOrFetch(key, fetchFn, options = {}) {
    const { ttl, forceRefresh = false, swr = true } = options;

    // 1. If not forcing refresh, return cached data immediately
    if (!forceRefresh) {
      const cached = getCached(key);
      if (cached !== null) {
        // Stale-While-Revalidate: trigger background refresh if half TTL elapsed
        if (swr && !inFlightRequests.has(key)) {
          const entry = memoryCache.get(key);
          const age = entry ? Date.now() - entry.cachedAt : 0;
          const nominalTtl = ttl || DEFAULT_TTL[key] || 180 * 1000;
          if (age > nominalTtl * 0.7) {
            // Background revalidate without blocking caller
            (async () => {
              try {
                const fresh = await fetchFn();
                if (fresh) setCached(key, fresh, ttl);
              } catch (_) {}
            })();
          }
        }
        return cached;
      }
    }

    // 2. If identical request is already in-flight, share its promise
    if (inFlightRequests.has(key)) {
      return inFlightRequests.get(key);
    }

    // 3. Dispatch fresh request and track in-flight
    const requestPromise = (async () => {
      try {
        const data = await fetchFn();
        if (data !== undefined && data !== null) {
          setCached(key, data, ttl);
        }
        return data;
      } finally {
        inFlightRequests.delete(key);
      }
    })();

    inFlightRequests.set(key, requestPromise);
    return requestPromise;
  }

  // Cross-tab invalidation listener
  window.addEventListener('storage', (e) => {
    if (e.key === 'velora_global_cache_invalidated') {
      clearAllSessionCache();
      window.dispatchEvent(new CustomEvent('velora:cache-invalidated', { detail: { broadcast: true } }));
    }
  });

  // Global Export
  window.VeloraCache = {
    get: getCached,
    set: setCached,
    invalidate: invalidate,
    getOrFetch: getOrFetch,
    fetchWithRetry: fetchWithRetry,
    clearAll: clearAllSessionCache
  };
})();

