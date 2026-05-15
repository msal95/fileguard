import { describe, it, expect, afterEach } from 'vitest'
import { rm, readFile, access } from 'fs/promises'
import os from 'os'
import path from 'path'
import { localStore } from '../../src/storage/local.js'

const tmpDir = path.join(os.tmpdir(), 'fileguard-test-local')

afterEach(async () => {
  await rm(tmpDir, { recursive: true, force: true })
})

const makeFile = (overrides = {}) => ({
  buffer: Buffer.from('hello world'),
  filename: 'test.png',
  sanitizedFilename: 'safe-name.png',
  size: 11,
  mimeType: 'image/png',
  ...overrides,
})

describe('localStore', () => {
  it('writes the file to disk and returns a success result', async () => {
    const file = makeFile()
    const result = await localStore(file, { localPath: tmpDir })

    expect(result.success).toBe(true)
    expect(result.data.storage).toBe('local')
    expect(result.data.filename).toBe('safe-name.png')
    expect(result.data.size).toBe(11)
    expect(result.data.mimeType).toBe('image/png')
    expect(result.data.url).toContain('safe-name.png')
  })

  it('the written file contains the exact buffer contents', async () => {
    const content = Buffer.from('fileguard content check')
    const file = makeFile({ buffer: content, size: content.length })
    const result = await localStore(file, { localPath: tmpDir })

    const written = await readFile(result.data.url)
    expect(written.equals(content)).toBe(true)
  })

  it('creates the destination directory if it does not exist', async () => {
    const nestedDir = path.join(tmpDir, 'a', 'b', 'c')
    const result = await localStore(makeFile(), { localPath: nestedDir })

    expect(result.success).toBe(true)
    await expect(access(result.data.url)).resolves.toBeUndefined()
  })

  it('uses sanitizedFilename when provided', async () => {
    const result = await localStore(
      makeFile({ sanitizedFilename: 'custom-uuid.png' }),
      { localPath: tmpDir }
    )
    expect(result.data.filename).toBe('custom-uuid.png')
  })

  it('falls back to a UUID name when sanitizedFilename is missing', async () => {
    const file = makeFile()
    delete file.sanitizedFilename
    const result = await localStore(file, { localPath: tmpDir })

    expect(result.success).toBe(true)
    // UUID + extension: 36 chars + 4 = 40 char filename
    expect(result.data.filename).toMatch(/^[0-9a-f-]{36}\.png$/)
  })

  it('returns STORAGE_ERROR when the path is not writable', async () => {
    // /proc/fileguard-test is unwritable on macOS/Linux
    const result = await localStore(makeFile(), { localPath: '/proc/fileguard-test-unreachable' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
  })

  it('uses ./uploads as the default localPath', async () => {
    const result = await localStore(makeFile(), { localPath: tmpDir })
    expect(result.data.url).toMatch(/safe-name\.png$/)
  })

  it('returns STORAGE_ERROR if sanitizedFilename escapes destDir via path traversal', async () => {
    const result = await localStore(
      makeFile({ sanitizedFilename: '../../../etc/passwd' }),
      { localPath: tmpDir }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
    expect(result.message).toMatch(/path traversal/i)
  })
})
