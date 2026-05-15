import { validateFile, mergeConfig } from './core/validator.js'
import { failResult } from './errors/UploadError.js'
import { getStorageAdapter } from './storage/index.js'
import { createRateLimiter } from './core/rateLimiter.js'
import { createLogger } from './audit/logger.js'

/**
 * Create a configured fileguard instance.
 * @param {object} [config] - Optional configuration overrides
 * @returns {{ process: Function }}
 */
export function createGuard(config = {}) {
  const cfg = mergeConfig(config)
  const rateLimiter = cfg.rateLimit.enabled ? createRateLimiter(cfg.rateLimit) : null
  const logger = cfg.audit.enabled ? createLogger(cfg.audit) : null

  return {
    /**
     * Validate and store a file upload end-to-end.
     * @param {{ buffer: Buffer, filename: string, mimeType: string, size: number }} file
     * @param {{ key?: string }} [meta] - Optional meta (e.g. user IP for rate limiting)
     * @returns {Promise<{ success: boolean, data?: object, error?: string, message?: string }>}
     */
    async process(file, meta = {}) {
      try {
        if (rateLimiter) {
          const rl = rateLimiter.check(meta.key ?? 'anonymous')
          if (!rl.success) return rl
        }

        const validation = await validateFile(file, cfg)
        if (!validation.success) {
          await logger?.log({ event: 'upload.rejected', error: validation.error, filename: file.filename })
          return validation
        }

        const store = await getStorageAdapter(cfg.storage)
        const result = await store(
          {
            buffer: file.buffer,
            filename: file.filename,
            sanitizedFilename: validation.sanitizedFilename,
            size: file.size,
            mimeType: file.mimeType,
          },
          cfg
        )

        await logger?.log({
          event: result.success ? 'upload.success' : 'upload.error',
          filename: file.filename,
          size: file.size,
          storage: cfg.storage,
          ...(result.success ? { url: result.data.url } : { error: result.error }),
        })

        return result
      } catch (err) {
        return failResult('STORAGE_ERROR', err.message ?? 'An unexpected error occurred')
      }
    },
  }
}

export { createGuard as fileguard }
