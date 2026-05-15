import path from 'path'
import { failResult } from '../errors/UploadError.js'
import { validateMagicBytes } from '../scanners/magicBytes.js'
import { checkZipBomb } from '../scanners/zipBomb.js'
import { checkPolyglot } from '../scanners/polyglot.js'
import { sanitizeFilename } from './sanitizer.js'
import { scanWithClamAV } from '../scanners/clamav.js'
import { scanWithVirusTotal } from '../scanners/virustotal.js'

// MIME types that should trigger ZIP bomb detection.
const ARCHIVE_MIME_TYPES = new Set([
  'application/zip',
  'application/x-zip-compressed',
  'application/x-zip',
  'application/java-archive',
])

/**
 * Default configuration values.
 */
export const defaultConfig = {
  maxFileSize: 10 * 1024 * 1024,
  allowedExtensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'doc', 'docx', 'xls', 'xlsx'],
  allowedMimeTypes: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
  ],
  storage: 'local',
  localPath: './uploads',
  scan: {
    magicBytes: true,
    zipBomb: true,
    polyglot: true,
    clamav: false,
    virustotal: false,
  },
  rateLimit: {
    enabled: false,
    maxUploads: 10,
    windowMs: 60 * 1000,
  },
  audit: {
    enabled: false,
    logPath: './logs/uploads.log',
  },
  sanitizeFilename: true,
}

/**
 * Merge user config over defaults (shallow for top-level, deep for nested objects).
 * @param {object} userConfig
 * @returns {object}
 */
export function mergeConfig(userConfig = {}) {
  return {
    ...defaultConfig,
    ...userConfig,
    scan: { ...defaultConfig.scan, ...(userConfig.scan ?? {}) },
    rateLimit: { ...defaultConfig.rateLimit, ...(userConfig.rateLimit ?? {}) },
    audit: { ...defaultConfig.audit, ...(userConfig.audit ?? {}) },
  }
}

/**
 * Step 1: Validate file size.
 * @param {number} size - File size in bytes
 * @param {number} maxFileSize - Max allowed size in bytes
 */
export function checkFileSize(size, maxFileSize) {
  if (size > maxFileSize) {
    return failResult(
      'FILE_TOO_LARGE',
      `File size ${size} bytes exceeds the limit of ${maxFileSize} bytes`
    )
  }
  return { success: true }
}

/**
 * Step 2: Validate file extension against the allowlist.
 * @param {string} filename
 * @param {string[]} allowedExtensions
 */
export function checkExtension(filename, allowedExtensions) {
  const ext = path.extname(filename).toLowerCase().replace(/^\./, '')
  if (!ext) {
    return failResult('INVALID_EXTENSION', 'File has no extension')
  }
  if (!allowedExtensions.map((e) => e.toLowerCase()).includes(ext)) {
    return failResult('INVALID_EXTENSION', `Extension ".${ext}" is not allowed`)
  }
  return { success: true }
}

/**
 * Step 3: Validate declared MIME type against the allowlist.
 * @param {string} mimeType
 * @param {string[]} allowedMimeTypes
 */
export function checkMimeType(mimeType, allowedMimeTypes) {
  if (!allowedMimeTypes.includes(mimeType)) {
    return failResult('INVALID_MIME_TYPE', `MIME type "${mimeType}" is not allowed`)
  }
  return { success: true }
}

/**
 * Run the full validation pipeline on a file.
 * Order: size → extension → MIME → magic bytes → ZIP bomb → polyglot → sanitize filename
 *
 * @param {{ buffer: Buffer, filename: string, mimeType: string, size: number }} file
 * @param {object} [config]
 * @returns {Promise<{ success: true, sanitizedFilename: string } | { success: false, error: string, message: string }>}
 */
export async function validateFile(file, config = {}) {
  if (!file || !Buffer.isBuffer(file.buffer) || !file.filename || !file.mimeType || typeof file.size !== 'number') {
    return failResult('STORAGE_ERROR', 'Invalid file input: buffer, filename, mimeType, and size are required')
  }

  const cfg = mergeConfig(config)
  const { buffer, filename, mimeType, size } = file

  const sizeCheck = checkFileSize(size, cfg.maxFileSize)
  if (!sizeCheck.success) return sizeCheck

  const extCheck = checkExtension(filename, cfg.allowedExtensions)
  if (!extCheck.success) return extCheck

  const mimeCheck = checkMimeType(mimeType, cfg.allowedMimeTypes)
  if (!mimeCheck.success) return mimeCheck

  const magicCheck = await validateMagicBytes(buffer, mimeType, cfg.allowedMimeTypes)
  if (!magicCheck.success) return magicCheck

  if (cfg.scan.zipBomb && ARCHIVE_MIME_TYPES.has(magicCheck.detectedMime)) {
    const bombCheck = checkZipBomb(buffer)
    if (!bombCheck.success) return bombCheck
  }

  if (cfg.scan.polyglot) {
    const polyglotCheck = checkPolyglot(buffer)
    if (!polyglotCheck.success) return polyglotCheck
  }

  const { sanitizedFilename } = cfg.sanitizeFilename
    ? sanitizeFilename(filename)
    : { sanitizedFilename: filename }

  if (cfg.scan.clamav) {
    const clamResult = await scanWithClamAV(buffer, cfg.clamavOptions)
    if (!clamResult.success) return clamResult
  }

  if (cfg.scan.virustotal) {
    const vtResult = await scanWithVirusTotal(buffer, cfg.virustotalOptions)
    if (!vtResult.success) return vtResult
  }

  return { success: true, sanitizedFilename }
}
