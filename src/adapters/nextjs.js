import { validateFile } from '../core/validator.js'
import { getStorageAdapter } from '../storage/index.js'
import { failResult } from '../errors/UploadError.js'

/**
 * Create a Next.js App Router route handler for file uploads.
 *
 * Usage in app/api/upload/route.js:
 *   import { createNextHandler } from 'uploadshield/nextjs'
 *   export const POST = createNextHandler({ storage: 'local', localPath: './uploads' })
 *
 * @param {object} [config] - uploadshield config
 * @returns {Function} async (request: Request) => Response
 */
export function createNextHandler(config = {}) {
  const fieldName = config.fieldName ?? 'file'

  return async function handler(request) {
    try {
      let formData
      try {
        formData = await request.formData()
      } catch {
        return jsonResponse(failResult('STORAGE_ERROR', 'Failed to parse form data'), 400)
      }

      const fileEntry = formData.get(fieldName)
      if (!fileEntry || typeof fileEntry === 'string') {
        return jsonResponse(failResult('STORAGE_ERROR', `No file found in field "${fieldName}"`), 400)
      }

      const buffer = Buffer.from(await fileEntry.arrayBuffer())
      const filename = fileEntry.name ?? 'upload'
      const mimeType = fileEntry.type ?? 'application/octet-stream'

      const validation = await validateFile(
        { buffer, filename, mimeType, size: buffer.length },
        config
      )

      if (!validation.success) {
        return jsonResponse(validation, 422)
      }

      const store = await getStorageAdapter(config.storage ?? 'local')
      const result = await store(
        {
          buffer,
          filename,
          sanitizedFilename: validation.sanitizedFilename,
          size: buffer.length,
          mimeType,
        },
        config
      )

      return jsonResponse(result, result.success ? 200 : 500)
    } catch (err) {
      return jsonResponse(failResult('STORAGE_ERROR', err.message ?? 'Internal error'), 500)
    }
  }
}

/**
 * @param {object} body
 * @param {number} status
 * @returns {Response}
 */
function jsonResponse(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
