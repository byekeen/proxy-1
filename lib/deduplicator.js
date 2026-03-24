/**
 * Request Deduplicator
 * If the same request comes in while one is pending, reuse the result.
 * Critical for preventing duplicate fills or balance queries.
 */

class Deduplicator {
  constructor() {
    // Map of request signature → pending promise
    this.pending = new Map();
  }

  /**
   * Generate a cache key for this request
   * Includes method, path, and deterministic param stringification
   */
  _getKey(method, path, params) {
    const paramStr = Object.entries(params || {})
      .sort(([k1], [k2]) => k1.localeCompare(k2))
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join('&');
    
    return `${method}:${path}:${paramStr}`;
  }

  /**
   * Execute request with deduplication
   * If an identical request is in-flight, return its promise.
   * Otherwise, execute fn and cache the promise.
   */
  async execute(method, path, params, fn) {
    const key = this._getKey(method, path, params);

    // If request is already in-flight, reuse it
    if (this.pending.has(key)) {
      return this.pending.get(key);
    }

    // Execute and cache the promise
    const promise = fn()
      .then((result) => result)
      .catch((err) => {
        // On error, remove from cache so next attempt can retry
        this.pending.delete(key);
        throw err;
      })
      .finally(() => {
        // Clean up after success
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  getStats() {
    return {
      pendingRequests: this.pending.size,
    };
  }
}

export const deduplicator = new Deduplicator();
