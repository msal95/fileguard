import path from 'path'
import { v4 as uuidv4 } from 'uuid'

const MAX_LENGTH = 255

// Windows reserved device names — treated as unsafe regardless of extension.
const RESERVED = new Set([
  'CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9',
])

/**
 * Return true when the filename contains characters or patterns that indicate
 * path traversal, null bytes, or otherwise unsafe input.
 * @param {string} filename
 * @returns {boolean}
 */
function isUnsafe(filename) {
  return (
    filename.includes('..') ||
    filename.includes('/') ||
    filename.includes('\\') ||
    filename.includes('\0') ||
    /[\x00-\x1f\x7f]/.test(filename)
  )
}

/**
 * Sanitize a filename for safe storage.
 *
 * - Path traversal, null bytes, and control characters → replaced with UUID-based name.
 * - Windows reserved names → replaced with UUID-based name.
 * - Remaining special characters stripped from the stem.
 * - Result truncated to 255 characters.
 * - Original extension is always preserved (lowercased).
 *
 * Never rejects — always returns a safe filename.
 *
 * @param {string} filename - Original filename from the upload
 * @returns {{ sanitizedFilename: string, wasUnsafe: boolean }}
 */
export function sanitizeFilename(filename) {
  const ext = path.extname(filename).toLowerCase()
  const stem = path.basename(filename, ext)

  const unsafe = isUnsafe(filename) || RESERVED.has(stem.toUpperCase())
  if (unsafe) {
    return { sanitizedFilename: `${uuidv4()}${ext}`, wasUnsafe: true }
  }

  // Strip remaining problematic characters from the stem only.
  const cleanStem = stem
    .replace(/[^\w\-. ]/g, '') // keep word chars, hyphens, dots, spaces
    .replace(/\s+/g, '_')       // spaces → underscores
    .replace(/^\.+/, '')        // no leading dots

  const safeName = cleanStem ? `${cleanStem}${ext}` : `${uuidv4()}${ext}`
  const truncated = safeName.slice(0, MAX_LENGTH)

  return { sanitizedFilename: truncated, wasUnsafe: false }
}
