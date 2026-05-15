import { describe, it, expect, afterEach } from 'vitest'
import { readFile, rm } from 'fs/promises'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'
import { createNextHandler } from '../../src/adapters/nextjs.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '../../fixtures')
const tmpDir = path.join(os.tmpdir(), 'fileguard-test-nextjs')

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(fileBuffer, filename, mimeType, fieldName = 'file') {
  const formData = new FormData()
  const blob = new Blob([fileBuffer], { type: mimeType })
  formData.append(fieldName, blob, filename)
  return new Request('http://localhost/api/upload', { method: 'POST', body: formData })
}

function makeEmptyRequest() {
  const formData = new FormData()
  formData.append('text', 'no file here')
  return new Request('http://localhost/api/upload', { method: 'POST', body: formData })
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('createNextHandler', () => {
  it('returns a 200 JSON response with success data for a valid PNG', async () => {
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const handler = createNextHandler({ localPath: tmpDir })
    const request = makeRequest(pngBuffer, 'safe.png', 'image/png')

    const response = await handler(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.storage).toBe('local')
    expect(json.data.filename).toMatch(/\.png$/)
    expect(json.data.mimeType).toBe('image/png')
  })

  it('returns a 422 response for an invalid extension (not thrown)', async () => {
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const handler = createNextHandler({ localPath: tmpDir })
    const request = makeRequest(pngBuffer, 'evil.exe', 'image/png')

    const response = await handler(request)
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json.success).toBe(false)
    expect(json.error).toBe('INVALID_EXTENSION')
  })

  it('returns a 422 response for an EXE renamed to .png (magic bytes fail)', async () => {
    const exeBuffer = Buffer.concat([Buffer.from([0x4d, 0x5a, 0x90, 0x00]), Buffer.alloc(256)])
    const handler = createNextHandler({ localPath: tmpDir })
    const request = makeRequest(exeBuffer, 'evil.png', 'image/png')

    const response = await handler(request)
    const json = await response.json()

    expect(response.status).toBe(422)
    expect(json.success).toBe(false)
    expect(json.error).toBe('INVALID_MAGIC_BYTES')
  })

  it('returns a 400 response when no file field is present', async () => {
    const handler = createNextHandler({ localPath: tmpDir })
    const response = await handler(makeEmptyRequest())
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('reads from a custom field name when fieldName is configured', async () => {
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const handler = createNextHandler({ localPath: tmpDir, fieldName: 'attachment' })
    const request = makeRequest(pngBuffer, 'safe.png', 'image/png', 'attachment')

    const response = await handler(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('returns Content-Type: application/json on all responses', async () => {
    const handler = createNextHandler({ localPath: tmpDir })
    const response = await handler(makeEmptyRequest())

    expect(response.headers.get('Content-Type')).toBe('application/json')
  })

  it('returns a valid PDF successfully', async () => {
    const pdfBuffer = await readFile(path.join(fixturesDir, 'safe.pdf'))
    const handler = createNextHandler({ localPath: tmpDir })
    const request = makeRequest(pdfBuffer, 'safe.pdf', 'application/pdf')

    const response = await handler(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.mimeType).toBe('application/pdf')
  })
})
