import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'
import { checkPolyglot } from '../../src/scanners/polyglot.js'
import { validateFile } from '../../src/core/validator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '../../fixtures')

describe('checkPolyglot', () => {
  it('passes a clean PNG (no suspicious bytes)', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.png'))
    expect(checkPolyglot(buffer).success).toBe(true)
  })

  it('passes a clean PDF', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.pdf'))
    expect(checkPolyglot(buffer).success).toBe(true)
  })

  it('fails when MZ (PE/EXE) header appears after offset 32', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'polyglot.jpg'))
    const result = checkPolyglot(buffer)
    expect(result.success).toBe(false)
    expect(result.error).toBe('POLYGLOT_DETECTED')
    expect(result.message).toMatch(/MZ/i)
  })

  it('fails when <script tag appears after offset 32', () => {
    const buf = Buffer.alloc(64, 0x00)
    buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF // JPEG magic
    // <script at offset 33
    Buffer.from('<script', 'ascii').copy(buf, 33)
    const result = checkPolyglot(buf)
    expect(result.success).toBe(false)
    expect(result.error).toBe('POLYGLOT_DETECTED')
    expect(result.message).toMatch(/script/i)
  })

  it('fails when a nested ZIP header appears after offset 32', () => {
    const buf = Buffer.alloc(64, 0x00)
    buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF // JPEG magic
    // PK\x03\x04 at offset 40
    buf[40] = 0x50; buf[41] = 0x4B; buf[42] = 0x03; buf[43] = 0x04
    const result = checkPolyglot(buf)
    expect(result.success).toBe(false)
    expect(result.error).toBe('POLYGLOT_DETECTED')
  })

  it('ignores suspicious bytes that fall within the first 32 bytes', () => {
    // MZ at offset 0 — should NOT be flagged (scanning starts at 32)
    const buf = Buffer.alloc(64, 0x00)
    buf[0] = 0x4D; buf[1] = 0x5A // MZ at byte 0
    expect(checkPolyglot(buf).success).toBe(true)
  })

  it('passes a buffer shorter than 32 bytes (nothing to scan)', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF])
    expect(checkPolyglot(buf).success).toBe(true)
  })

  it('passes an empty buffer without crashing', () => {
    expect(checkPolyglot(Buffer.alloc(0)).success).toBe(true)
  })

  it('fails when PHP tag (<?php) appears after offset 32', () => {
    const buf = Buffer.alloc(64, 0x00)
    buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF // JPEG magic
    // <?php at offset 33
    Buffer.from('<?php', 'ascii').copy(buf, 33)
    const result = checkPolyglot(buf)
    expect(result.success).toBe(false)
    expect(result.error).toBe('POLYGLOT_DETECTED')
    expect(result.message).toMatch(/PHP/i)
  })

  it('fails when shell shebang (#!) appears after offset 32', () => {
    const buf = Buffer.alloc(64, 0x00)
    buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF // JPEG magic
    buf[34] = 0x23; buf[35] = 0x21 // #! at offset 34
    const result = checkPolyglot(buf)
    expect(result.success).toBe(false)
    expect(result.error).toBe('POLYGLOT_DETECTED')
    expect(result.message).toMatch(/shebang/i)
  })

  it('flags suspicious bytes at exactly offset 32 (the scan start)', () => {
    const buf = Buffer.alloc(64, 0x00)
    buf[0] = 0xFF; buf[1] = 0xD8; buf[2] = 0xFF // JPEG magic
    // MZ at exactly offset 32
    buf[32] = 0x4D; buf[33] = 0x5A
    const result = checkPolyglot(buf)
    expect(result.success).toBe(false)
    expect(result.error).toBe('POLYGLOT_DETECTED')
  })
})

describe('validateFile — polyglot integration', () => {
  it('rejects polyglot.jpg through the full pipeline', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'polyglot.jpg'))
    const result = await validateFile({
      buffer,
      filename: 'polyglot.jpg',
      mimeType: 'image/jpeg',
      size: buffer.length,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('POLYGLOT_DETECTED')
  })
})
