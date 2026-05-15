import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'
import { checkFileSize, checkExtension, checkMimeType, validateFile, mergeConfig } from '../../src/core/validator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '../../fixtures')

// ── mergeConfig ──────────────────────────────────────────────────────────────

describe('mergeConfig', () => {
  it('returns defaults when no config provided', () => {
    const cfg = mergeConfig()
    expect(cfg.maxFileSize).toBe(10 * 1024 * 1024)
    expect(cfg.scan.magicBytes).toBe(true)
  })

  it('overrides top-level values', () => {
    const cfg = mergeConfig({ maxFileSize: 1024 })
    expect(cfg.maxFileSize).toBe(1024)
  })

  it('deep-merges scan config', () => {
    const cfg = mergeConfig({ scan: { clamav: true } })
    expect(cfg.scan.clamav).toBe(true)
    expect(cfg.scan.magicBytes).toBe(true)
  })
})

// ── checkFileSize ─────────────────────────────────────────────────────────────

describe('checkFileSize', () => {
  it('passes when file is under limit', () => {
    expect(checkFileSize(1000, 10000).success).toBe(true)
  })

  it('passes when file equals limit', () => {
    expect(checkFileSize(10000, 10000).success).toBe(true)
  })

  it('fails when file exceeds limit', () => {
    const result = checkFileSize(20000, 10000)
    expect(result.success).toBe(false)
    expect(result.error).toBe('FILE_TOO_LARGE')
  })
})

// ── checkExtension ────────────────────────────────────────────────────────────

describe('checkExtension', () => {
  it('passes for allowed extension', () => {
    expect(checkExtension('photo.png', ['png', 'jpg']).success).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(checkExtension('photo.PNG', ['png']).success).toBe(true)
  })

  it('fails for disallowed extension', () => {
    const result = checkExtension('evil.exe', ['png', 'jpg'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_EXTENSION')
  })

  it('fails when file has no extension', () => {
    const result = checkExtension('noextension', ['png'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_EXTENSION')
  })
})

// ── checkMimeType ─────────────────────────────────────────────────────────────

describe('checkMimeType', () => {
  it('passes for allowed MIME type', () => {
    expect(checkMimeType('image/png', ['image/png', 'image/jpeg']).success).toBe(true)
  })

  it('fails for disallowed MIME type', () => {
    const result = checkMimeType('application/x-msdownload', ['image/png'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_MIME_TYPE')
  })
})

// ── mergeConfig — deep merge of rateLimit and audit ──────────────────────────

describe('mergeConfig — nested objects', () => {
  it('deep-merges rateLimit config', () => {
    const cfg = mergeConfig({ rateLimit: { enabled: true, maxUploads: 50 } })
    expect(cfg.rateLimit.enabled).toBe(true)
    expect(cfg.rateLimit.maxUploads).toBe(50)
    expect(cfg.rateLimit.windowMs).toBe(60_000) // default preserved
  })

  it('deep-merges audit config', () => {
    const cfg = mergeConfig({ audit: { enabled: true } })
    expect(cfg.audit.enabled).toBe(true)
    expect(cfg.audit.logPath).toBe('./logs/uploads.log') // default preserved
  })
})

// ── validateFile (integration) ────────────────────────────────────────────────

describe('validateFile', () => {
  it('passes a valid PNG file', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const result = await validateFile({
      buffer,
      filename: 'safe.png',
      mimeType: 'image/png',
      size: buffer.length,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a PNG renamed to .exe (INVALID_EXTENSION)', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const result = await validateFile({
      buffer,
      filename: 'evil.exe',
      mimeType: 'image/png',
      size: buffer.length,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_EXTENSION')
  })

  it('rejects a file exceeding size limit', async () => {
    const buffer = Buffer.alloc(100)
    const result = await validateFile(
      { buffer, filename: 'small.png', mimeType: 'image/png', size: buffer.length },
      { maxFileSize: 10 }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('FILE_TOO_LARGE')
  })

  it('rejects a disallowed MIME type', async () => {
    const buffer = Buffer.alloc(100)
    const result = await validateFile({
      buffer,
      filename: 'file.png',
      mimeType: 'application/x-msdownload',
      size: buffer.length,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_MIME_TYPE')
  })

  // ── Input guard ────────────────────────────────────────────────────────────

  it('returns STORAGE_ERROR for null file', async () => {
    const result = await validateFile(null)
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
  })

  it('returns STORAGE_ERROR when buffer is missing', async () => {
    const result = await validateFile({ filename: 'a.png', mimeType: 'image/png', size: 0 })
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
  })

  it('returns STORAGE_ERROR when buffer is not a Buffer', async () => {
    const result = await validateFile({ buffer: 'not-a-buffer', filename: 'a.png', mimeType: 'image/png', size: 10 })
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
  })

  it('returns STORAGE_ERROR when filename is missing', async () => {
    const result = await validateFile({ buffer: Buffer.alloc(10), mimeType: 'image/png', size: 10 })
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
  })

  it('returns STORAGE_ERROR when size is not a number', async () => {
    const result = await validateFile({ buffer: Buffer.alloc(10), filename: 'a.png', mimeType: 'image/png', size: '100' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
  })

  // ── Empty allowlists ───────────────────────────────────────────────────────

  it('rejects every extension when allowedExtensions is empty', async () => {
    const buffer = Buffer.alloc(10)
    const result = await validateFile(
      { buffer, filename: 'file.png', mimeType: 'image/png', size: 10 },
      { allowedExtensions: [] }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_EXTENSION')
  })

  it('rejects every MIME when allowedMimeTypes is empty', async () => {
    const buffer = Buffer.alloc(10)
    const result = await validateFile(
      { buffer, filename: 'file.png', mimeType: 'image/png', size: 10 },
      { allowedMimeTypes: [] }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_MIME_TYPE')
  })
})
