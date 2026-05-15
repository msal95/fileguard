import busboy from 'busboy'
import { validateFile } from '../core/validator.js'
import { getStorageAdapter } from '../storage/index.js'
import { failResult } from '../errors/UploadError.js'

/**
 * Create an Express middleware that handles multipart file uploads.
 *
 * Attaches the result to `req.uploadResult` and always calls `next()`.
 * On an unexpected internal error, calls `next(err)`.
 *
 * Usage:
 *   app.post('/upload', createExpressMiddleware(config), (req, res) => {
 *     if (!req.uploadResult.success) return res.status(422).json(req.uploadResult)
 *     res.json(req.uploadResult)
 *   })
 *
 * @param {object} [config] - fileguard config (storage, allowedExtensions, etc.)
 * @returns {Function} Express middleware (req, res, next) => void
 */
export function createExpressMiddleware(config = {}) {
  return function uploadMiddleware(req, res, next) {
    let bb
    try {
      bb = busboy({ headers: req.headers, limits: { files: 1 } })
    } catch (err) {
      // Malformed Content-Type header (e.g. not a multipart request)
      req.uploadResult = failResult('STORAGE_ERROR', `Could not parse request: ${err.message}`)
      return next()
    }

    let fileData = null
    let done = false
    const finish = (result) => {
      if (done) return
      done = true
      req.uploadResult = result
      next()
    }

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename, mimeType } = info
      const chunks = []
      fileStream.on('data', (chunk) => chunks.push(chunk))
      fileStream.on('end', () => {
        fileData = { buffer: Buffer.concat(chunks), filename, mimeType }
      })
      fileStream.on('error', (err) => next(err))
    })

    bb.on('finish', async () => {
      try {
        if (!fileData) {
          return finish(failResult('STORAGE_ERROR', 'No file found in request'))
        }

        const { buffer, filename, mimeType } = fileData
        const validation = await validateFile(
          { buffer, filename, mimeType, size: buffer.length },
          config
        )

        if (!validation.success) return finish(validation)

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

        finish(result)
      } catch (err) {
        if (!done) { done = true; next(err) }
      }
    })

    bb.on('error', (err) => { if (!done) { done = true; next(err) } })
    req.pipe(bb)
  }
}
