import busboy from 'busboy'
import { validateFile } from '../core/validator.js'
import { getStorageAdapter } from '../storage/index.js'
import { failResult } from '../errors/UploadError.js'

/**
 * Parse a raw Node.js http.IncomingMessage as a multipart upload using busboy.
 * @param {import('http').IncomingMessage} rawRequest
 * @param {object} config
 * @returns {Promise<object>} fileguard result object
 */
async function processMultipart(rawRequest, config) {
  return new Promise((resolve, reject) => {
    let bb
    try {
      bb = busboy({ headers: rawRequest.headers, limits: { files: 1 } })
    } catch (err) {
      return resolve(failResult('STORAGE_ERROR', `Could not parse request: ${err.message}`))
    }

    let fileData = null

    bb.on('file', (fieldname, fileStream, info) => {
      const { filename, mimeType } = info
      const chunks = []
      fileStream.on('data', (chunk) => chunks.push(chunk))
      fileStream.on('end', () => {
        fileData = { buffer: Buffer.concat(chunks), filename, mimeType }
      })
      fileStream.on('error', reject)
    })

    bb.on('finish', async () => {
      try {
        if (!fileData) {
          return resolve(failResult('STORAGE_ERROR', 'No file found in request'))
        }

        const { buffer, filename, mimeType } = fileData
        const validation = await validateFile(
          { buffer, filename, mimeType, size: buffer.length },
          config
        )

        if (!validation.success) return resolve(validation)

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
        resolve(result)
      } catch (err) {
        reject(err)
      }
    })

    bb.on('error', reject)
    rawRequest.pipe(bb)
  })
}

/**
 * Create a Fastify plugin for file uploads.
 *
 * Registers a content-type parser for multipart/form-data and adds an
 * `uploadGuard()` decorator that returns a preHandler function.
 *
 * Usage:
 *   await fastify.register(createFastifyPlugin({ storage: 'local' }))
 *   fastify.post('/upload', { preHandler: fastify.uploadGuard() }, async (req, reply) => {
 *     reply.send(req.uploadResult)
 *   })
 *
 * @param {object} [config] - fileguard config
 * @returns {Function} Fastify plugin async (fastify, opts) => void
 */
export function createFastifyPlugin(config = {}) {
  return async function fastifyUploadPlugin(fastify) {
    // Prevent Fastify from trying to JSON-parse multipart bodies.
    fastify.addContentTypeParser('multipart/form-data', (_req, payload, done) => {
      done(null, payload)
    })

    /**
     * Returns a preHandler that validates + stores the upload and attaches
     * the result to `request.uploadResult`.
     * @param {object} [overrides] - per-route config overrides
     * @returns {Function} async (request, reply) => void
     */
    fastify.decorate('uploadGuard', function uploadGuard(overrides = {}) {
      const mergedConfig = { ...config, ...overrides }

      return async function preHandler(request) {
        request.uploadResult = await processMultipart(request.raw, mergedConfig)
      }
    })
  }
}
