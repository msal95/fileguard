import { describe, it, expect, afterEach } from 'vitest'
import { Readable } from 'stream'
import { readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { createExpressMiddleware } from '../../src/adapters/express.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '../../fixtures')
const tmpDir = path.join(os.tmpdir(), 'fileguard-test-express')

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function buildMultipartBody(boundary, { fieldname, filename, mimeType, data }) {
  return Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fieldname}"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
    ),
    data,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ])
}

function makeMockReq(body, boundary) {
  const req = Readable.from(body)
  req.headers = {
    'content-type': `multipart/form-data; boundary=${boundary}`,
    'transfer-encoding': 'identity',
  }
  return req
}

function makeRes() {
  return {}
}

function callMiddleware(middleware, req, res = makeRes()) {
  return new Promise((resolve, reject) => {
    middleware(req, res, (err) => {
      if (err) reject(err)
      else resolve(req)
    })
  })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createExpressMiddleware', () => {
  it('populates req.uploadResult on a valid PNG upload', async () => {
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const boundary = 'TestBoundary1234'
    const body = buildMultipartBody(boundary, {
      fieldname: 'file',
      filename: 'safe.png',
      mimeType: 'image/png',
      data: pngBuffer,
    })

    const middleware = createExpressMiddleware({ localPath: tmpDir })
    const req = makeMockReq(body, boundary)
    await callMiddleware(middleware, req)

    expect(req.uploadResult).toBeDefined()
    expect(req.uploadResult.success).toBe(true)
    expect(req.uploadResult.data.filename).toMatch(/\.png$/)
    expect(req.uploadResult.data.storage).toBe('local')
    expect(req.uploadResult.data.size).toBe(pngBuffer.length)
  })

  it('returns INVALID_EXTENSION (not thrown) for a PNG renamed to .exe', async () => {
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const boundary = 'TestBoundary5678'
    const body = buildMultipartBody(boundary, {
      fieldname: 'file',
      filename: 'evil.exe',
      mimeType: 'image/png',
      data: pngBuffer,
    })

    const middleware = createExpressMiddleware({ localPath: tmpDir })
    const req = makeMockReq(body, boundary)
    await callMiddleware(middleware, req)

    expect(req.uploadResult.success).toBe(false)
    expect(req.uploadResult.error).toBe('INVALID_EXTENSION')
  })

  it('returns INVALID_MAGIC_BYTES (not thrown) for an EXE renamed to .png', async () => {
    // Windows PE header (MZ)
    const exeBuffer = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(256)])
    const boundary = 'TestBoundaryABCD'
    const body = buildMultipartBody(boundary, {
      fieldname: 'file',
      filename: 'evil.png',
      mimeType: 'image/png',
      data: exeBuffer,
    })

    const middleware = createExpressMiddleware({ localPath: tmpDir })
    const req = makeMockReq(body, boundary)
    await callMiddleware(middleware, req)

    expect(req.uploadResult.success).toBe(false)
    expect(req.uploadResult.error).toBe('INVALID_MAGIC_BYTES')
  })

  it('returns an error result when no file field is present', async () => {
    const boundary = 'TestBoundaryEFGH'
    // Form with only a text field, no file
    const body = Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="text"\r\n\r\nhello\r\n--${boundary}--\r\n`
    )
    const middleware = createExpressMiddleware({ localPath: tmpDir })
    const req = makeMockReq(body, boundary)
    await callMiddleware(middleware, req)

    expect(req.uploadResult.success).toBe(false)
    expect(req.uploadResult.error).toBe('STORAGE_ERROR')
  })

  it('returns an error result for a non-multipart request without throwing', async () => {
    const req = Readable.from(Buffer.from('not multipart data'))
    req.headers = { 'content-type': 'application/json' }

    const middleware = createExpressMiddleware({ localPath: tmpDir })
    await callMiddleware(middleware, req)

    expect(req.uploadResult.success).toBe(false)
    expect(req.uploadResult.error).toBe('STORAGE_ERROR')
  })

  it('respects custom allowedExtensions from config', async () => {
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const boundary = 'TestBoundaryIJKL'
    const body = buildMultipartBody(boundary, {
      fieldname: 'file',
      filename: 'safe.png',
      mimeType: 'image/png',
      data: pngBuffer,
    })

    // Restrict to PDF only — PNG should be rejected
    const middleware = createExpressMiddleware({
      localPath: tmpDir,
      allowedExtensions: ['pdf'],
      allowedMimeTypes: ['application/pdf'],
    })
    const req = makeMockReq(body, boundary)
    await callMiddleware(middleware, req)

    expect(req.uploadResult.success).toBe(false)
    expect(req.uploadResult.error).toBe('INVALID_EXTENSION')
  })
})
