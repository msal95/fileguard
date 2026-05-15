import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'
import { detectFileType, validateMagicBytes } from '../../src/scanners/magicBytes.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '../../fixtures')

describe('detectFileType', () => {
  it('detects PNG magic bytes', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const type = await detectFileType(buffer)
    expect(type).not.toBeNull()
    expect(type.mime).toBe('image/png')
    expect(type.ext).toBe('png')
  })

  it('detects PDF magic bytes', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.pdf'))
    const type = await detectFileType(buffer)
    expect(type).not.toBeNull()
    expect(type.mime).toBe('application/pdf')
  })

  it('returns null for random binary data with no known signature', async () => {
    const buffer = Buffer.from('this is just plain text with no magic bytes')
    const type = await detectFileType(buffer)
    expect(type).toBeNull()
  })

  it('returns null for an empty buffer (no crash)', async () => {
    const type = await detectFileType(Buffer.alloc(0))
    expect(type).toBeNull()
  })

  it('returns null for a null-ish input without throwing', async () => {
    const type = await detectFileType(null)
    expect(type).toBeNull()
  })

  it('detects ZIP magic bytes', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.zip'))
    const type = await detectFileType(buffer)
    expect(type).not.toBeNull()
    expect(type.mime).toBe('application/zip')
  })
})

describe('validateMagicBytes', () => {
  it('passes when declared MIME matches magic bytes (PNG)', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const result = await validateMagicBytes(buffer, 'image/png', ['image/png'])
    expect(result.success).toBe(true)
  })

  it('passes when declared MIME matches magic bytes (PDF)', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.pdf'))
    const result = await validateMagicBytes(buffer, 'application/pdf', ['application/pdf'])
    expect(result.success).toBe(true)
  })

  it('fails when magic bytes indicate a different type than declared', async () => {
    // PNG buffer but declared as PDF
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const result = await validateMagicBytes(buffer, 'application/pdf', ['image/png', 'application/pdf'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_MAGIC_BYTES')
  })

  it('fails when detected type is not in the allowed list', async () => {
    // PNG but only PDF is allowed
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const result = await validateMagicBytes(buffer, 'image/png', ['application/pdf'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_MAGIC_BYTES')
  })

  it('fails EXE renamed to PNG (magic bytes mismatch)', async () => {
    const exeBuffer = Buffer.concat([
      Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]),
      Buffer.alloc(256),
    ])
    const result = await validateMagicBytes(exeBuffer, 'image/png', ['image/png'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_MAGIC_BYTES')
  })

  it('handles image/jpg alias — normalised to image/jpeg', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    // PNG declared as image/jpg — should fail (PNG !== JPEG), but no crash from alias lookup
    const result = await validateMagicBytes(buffer, 'image/jpg', ['image/jpg'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_MAGIC_BYTES')
  })

  it('returns INVALID_MAGIC_BYTES for an empty buffer (undetectable type)', async () => {
    const result = await validateMagicBytes(Buffer.alloc(0), 'image/png', ['image/png'])
    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_MAGIC_BYTES')
  })

  it('includes detectedMime and detectedExt in success result', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    const result = await validateMagicBytes(buffer, 'image/png', ['image/png'])
    expect(result.success).toBe(true)
    expect(result.detectedMime).toBe('image/png')
    expect(result.detectedExt).toBe('png')
  })
})
