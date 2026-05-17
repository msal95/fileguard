import { describe, it, expect, afterEach } from 'vitest'
import { readFile, rm, writeFile } from 'fs/promises'
import path from 'path'
import os from 'os'
import { createGuard } from '../../src/index.js'

const PNG = await readFile(new URL('../../fixtures/safe.png', import.meta.url))

describe('createGuard', () => {
  const tmpDir = path.join(os.tmpdir(), `fg-guard-test-${Date.now()}`)

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  it('validates and stores a valid file, returning a real url', async () => {
    const guard = createGuard({
      storage: 'local',
      localPath: tmpDir,
      allowedExtensions: ['png'],
      allowedMimeTypes: ['image/png'],
    })

    const result = await guard.process({
      buffer: PNG,
      filename: 'photo.png',
      mimeType: 'image/png',
      size: PNG.length,
    })

    expect(result.success).toBe(true)
    expect(result.data.url).toBeTruthy()
    expect(result.data.url).not.toBeNull()
    expect(result.data.storage).toBe('local')
  })

  it('returns failure for invalid extension without touching storage', async () => {
    const guard = createGuard({
      storage: 'local',
      localPath: tmpDir,
      allowedExtensions: ['jpg'],
      allowedMimeTypes: ['image/jpeg'],
    })

    const result = await guard.process({
      buffer: PNG,
      filename: 'photo.exe',
      mimeType: 'image/jpeg',
      size: PNG.length,
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_EXTENSION')
  })

  it('enforces rate limiting when enabled', async () => {
    const guard = createGuard({
      storage: 'local',
      localPath: tmpDir,
      allowedExtensions: ['png'],
      allowedMimeTypes: ['image/png'],
      rateLimit: { enabled: true, maxUploads: 2, windowMs: 60_000 },
    })

    const file = { buffer: PNG, filename: 'photo.png', mimeType: 'image/png', size: PNG.length }
    const meta = { key: 'test-user' }

    const r1 = await guard.process(file, meta)
    const r2 = await guard.process(file, meta)
    const r3 = await guard.process(file, meta)

    expect(r1.success).toBe(true)
    expect(r2.success).toBe(true)
    expect(r3.success).toBe(false)
    expect(r3.error).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('returns STORAGE_ERROR on missing/invalid file input', async () => {
    const guard = createGuard({ storage: 'local', localPath: tmpDir })
    const result = await guard.process(null)
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
  })

  it('uses "anonymous" key when meta is not provided', async () => {
    const guard = createGuard({
      storage: 'local',
      localPath: tmpDir,
      allowedExtensions: ['png'],
      allowedMimeTypes: ['image/png'],
      rateLimit: { enabled: true, maxUploads: 1, windowMs: 60_000 },
    })
    const file = { buffer: PNG, filename: 'photo.png', mimeType: 'image/png', size: PNG.length }

    const r1 = await guard.process(file)         // no meta — uses 'anonymous'
    const r2 = await guard.process(file)         // same anonymous slot exhausted
    expect(r1.success).toBe(true)
    expect(r2.success).toBe(false)
    expect(r2.error).toBe('RATE_LIMIT_EXCEEDED')
  })

  it('returns STORAGE_ERROR when the storage adapter throws unexpectedly', async () => {
    // Create a FILE at the target path — mkdir will fail instantly (cross-platform)
    const blockedPath = path.join(os.tmpdir(), 'fileguard-guard-blocked')
    await writeFile(blockedPath, 'block')
    try {
      const guard = createGuard({
        storage: 'local',
        localPath: blockedPath,
        allowedExtensions: ['png'],
        allowedMimeTypes: ['image/png'],
      })
      const result = await guard.process({
        buffer: PNG,
        filename: 'photo.png',
        mimeType: 'image/png',
        size: PNG.length,
      })
      expect(result.success).toBe(false)
      expect(result.error).toBe('STORAGE_ERROR')
    } finally {
      await rm(blockedPath, { force: true })
    }
  })

  it('does not store the file when validation fails', async () => {
    const guard = createGuard({
      storage: 'local',
      localPath: tmpDir,
      allowedExtensions: ['jpg'],
      allowedMimeTypes: ['image/jpeg'],
    })
    await guard.process({ buffer: PNG, filename: 'photo.png', mimeType: 'image/png', size: PNG.length })
    // tmpDir should not exist at all (nothing written)
    const { access } = await import('fs/promises')
    await expect(access(tmpDir)).rejects.toThrow()
  })
})
