import { appendFile, mkdir } from 'fs/promises'
import path from 'path'

/**
 * Create an audit logger that appends JSON-newline entries to a log file.
 * If logging fails, the error is printed but the upload is NOT blocked.
 *
 * @param {{ logPath?: string, enabled?: boolean }} [config]
 * @returns {{ log: (event: object) => Promise<void> }}
 */
export function createLogger(config = {}) {
  const { logPath = './logs/uploads.log', enabled = true } = config

  return {
    /**
     * Append an audit event to the log file.
     * @param {object} event - Arbitrary key/value data to record
     */
    async log(event) {
      if (!enabled) return

      const entry = JSON.stringify({ timestamp: new Date().toISOString(), ...event }) + '\n'

      try {
        await mkdir(path.dirname(path.resolve(logPath)), { recursive: true })
        await appendFile(logPath, entry, 'utf8')
      } catch (err) {
        console.error('[fileguard audit] Failed to write log entry:', err.message)
      }
    },
  }
}
