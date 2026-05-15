import { fileTypeFromBuffer } from 'file-type'
import { failResult } from '../errors/UploadError.js'

const READ_BYTES = 8192

/**
 * Maps allowed MIME types to their expected file-type detected MIME.
 * Used to cross-check the detected type against what was declared.
 */
const MIME_ALIAS = {
  'image/jpg': 'image/jpeg',
}

/**
 * Detect the real file type from the buffer's magic bytes.
 * Returns the detected { ext, mime } or null if unknown.
 * @param {Buffer} buffer
 * @returns {Promise<{ ext: string, mime: string } | null>}
 */
export async function detectFileType(buffer) {
  try {
    if (!buffer || buffer.length === 0) return null
    const slice = buffer.subarray(0, READ_BYTES)
    return (await fileTypeFromBuffer(slice)) ?? null
  } catch {
    return null
  }
}

/**
 * Validate that the file's magic bytes match an expected MIME type.
 * @param {Buffer} buffer - Full file buffer
 * @param {string} declaredMime - MIME type declared by the uploader
 * @param {string[]} allowedMimeTypes - List of allowed MIME types from config
 * @returns {Promise<{ success: true, detectedMime: string, detectedExt: string } | { success: false, error: string, message: string }>}
 */
export async function validateMagicBytes(buffer, declaredMime, allowedMimeTypes) {
  const detected = await detectFileType(buffer)

  if (!detected) {
    return failResult('INVALID_MAGIC_BYTES', 'File type could not be determined from its contents')
  }

  const normalizedAllowed = allowedMimeTypes.map((m) => MIME_ALIAS[m] ?? m)

  if (!normalizedAllowed.includes(detected.mime)) {
    return failResult(
      'INVALID_MAGIC_BYTES',
      `File content does not match any allowed type (detected: ${detected.mime})`
    )
  }

  const normalizedDeclared = MIME_ALIAS[declaredMime] ?? declaredMime
  if (normalizedDeclared !== detected.mime) {
    return failResult(
      'INVALID_MAGIC_BYTES',
      `Declared MIME type "${declaredMime}" does not match file content (detected: ${detected.mime})`
    )
  }

  return { success: true, detectedMime: detected.mime, detectedExt: detected.ext }
}
