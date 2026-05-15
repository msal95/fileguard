import { failResult } from '../errors/UploadError.js'

/**
 * Create a per-key in-memory rate limiter.
 * Expired windows are cleaned up automatically on each check.
 *
 * @param {{ maxUploads?: number, windowMs?: number }} [config]
 * @returns {{ check: (key: string) => object, reset: (key: string) => void }}
 */
export function createRateLimiter(config = {}) {
  const { maxUploads = 10, windowMs = 60_000 } = config
  const store = new Map()

  function cleanup(now) {
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) store.delete(key)
    }
  }

  return {
    /**
     * Check and increment the counter for a given key.
     * @param {string} key - User ID or IP address
     * @returns {{ success: true } | { success: false, error: string, message: string }}
     */
    check(key) {
      const now = Date.now()
      cleanup(now)

      const entry = store.get(key)
      if (!entry || now >= entry.resetAt) {
        if (maxUploads <= 0) {
          return failResult('RATE_LIMIT_EXCEEDED', 'Upload rate limit exceeded. Try again later.')
        }
        store.set(key, { count: 1, resetAt: now + windowMs })
        return { success: true }
      }

      if (entry.count >= maxUploads) {
        return failResult('RATE_LIMIT_EXCEEDED', `Upload rate limit exceeded. Try again later.`)
      }

      entry.count++
      return { success: true }
    },

    /**
     * Remove the counter for a key (useful in tests).
     * @param {string} key
     */
    reset(key) {
      store.delete(key)
    },
  }
}
