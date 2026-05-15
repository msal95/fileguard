export const ERROR_CODES = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_EXTENSION: 'INVALID_EXTENSION',
  INVALID_MIME_TYPE: 'INVALID_MIME_TYPE',
  INVALID_MAGIC_BYTES: 'INVALID_MAGIC_BYTES',
  ZIP_BOMB_DETECTED: 'ZIP_BOMB_DETECTED',
  POLYGLOT_DETECTED: 'POLYGLOT_DETECTED',
  UNSAFE_FILENAME: 'UNSAFE_FILENAME',
  VIRUS_DETECTED: 'VIRUS_DETECTED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  STORAGE_ERROR: 'STORAGE_ERROR',
}

export class UploadError extends Error {
  /**
   * @param {string} code - One of ERROR_CODES
   * @param {string} message - Human-readable description
   */
  constructor(code, message) {
    super(message)
    this.name = 'UploadError'
    this.code = code
  }
}

/**
 * Build a standard failure result object.
 * @param {string} code
 * @param {string} message
 * @returns {{ success: false, error: string, message: string }}
 */
export function failResult(code, message) {
  return { success: false, error: code, message }
}

/**
 * Build a standard success result object.
 * @param {{ url: string, filename: string, size: number, mimeType: string, storage: string }} data
 * @returns {{ success: true, data: object }}
 */
export function successResult(data) {
  return { success: true, data }
}
