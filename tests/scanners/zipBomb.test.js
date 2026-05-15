import { describe, it, expect } from 'vitest'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'
import { checkZipBomb } from '../../src/scanners/zipBomb.js'
import { validateFile } from '../../src/core/validator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '../../fixtures')

describe('checkZipBomb', () => {
  it('passes a safe ZIP with low compression ratio', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.zip'))
    const result = checkZipBomb(buffer)
    expect(result.success).toBe(true)
  })

  it('fails a zip bomb with ratio > 100', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'bomb.zip'))
    const result = checkZipBomb(buffer)
    expect(result.success).toBe(false)
    expect(result.error).toBe('ZIP_BOMB_DETECTED')
    expect(result.message).toMatch(/ratio/i)
  })

  it('fails when a ZIP contains too many files', () => {
    // Build a minimal central directory with 1001 fake entries.
    // Each CDH entry: 46 bytes + filename length. Use 1-char filename.
    const fileCount = 1001
    const cdEntries = []
    for (let i = 0; i < fileCount; i++) {
      const cdh = Buffer.alloc(47)
      cdh.writeUInt32LE(0x02014b50, 0) // CD signature
      cdh.writeUInt32LE(10, 20)        // compressed size
      cdh.writeUInt32LE(10, 24)        // uncompressed size (ratio 1x — fine)
      cdh.writeUInt16LE(1, 28)         // filename length = 1
      cdh.writeUInt16LE(0, 30)         // extra length
      cdh.writeUInt16LE(0, 32)         // comment length
      cdh[46] = 0x61                   // filename = 'a'
      cdEntries.push(cdh)
    }
    const cd = Buffer.concat(cdEntries)

    // Build a valid EOCD pointing to our fake CD
    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(0, 4)
    eocd.writeUInt16LE(0, 6)
    eocd.writeUInt16LE(fileCount, 8)
    eocd.writeUInt16LE(fileCount, 10)
    eocd.writeUInt32LE(cd.length, 12)
    eocd.writeUInt32LE(0, 16) // CD starts at offset 0
    eocd.writeUInt16LE(0, 20)

    const buffer = Buffer.concat([cd, eocd])
    const result = checkZipBomb(buffer)
    expect(result.success).toBe(false)
    expect(result.error).toBe('ZIP_BOMB_DETECTED')
    expect(result.message).toMatch(/1001/)
  })

  it('returns error for a buffer with no EOCD record', () => {
    const buffer = Buffer.from('not a zip file at all')
    const result = checkZipBomb(buffer)
    expect(result.success).toBe(false)
    expect(result.error).toBe('ZIP_BOMB_DETECTED')
  })

  it('respects a custom ratioThreshold option', () => {
    // Build a ZIP with 50x compression — passes default (100x) but fails custom (40x)
    function buildZip(compressedSize, uncompressedSize) {
      const cdh = Buffer.alloc(47)
      cdh.writeUInt32LE(0x02014b50, 0)
      cdh.writeUInt32LE(compressedSize, 20)
      cdh.writeUInt32LE(uncompressedSize, 24)
      cdh.writeUInt16LE(1, 28); cdh.writeUInt16LE(0, 30); cdh.writeUInt16LE(0, 32)
      cdh[46] = 0x61
      const eocd = Buffer.alloc(22)
      eocd.writeUInt32LE(0x06054b50, 0)
      eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
      eocd.writeUInt32LE(cdh.length, 12); eocd.writeUInt32LE(0, 16)
      return Buffer.concat([cdh, eocd])
    }

    const buf = buildZip(100, 5000) // 50x ratio
    expect(checkZipBomb(buf).success).toBe(true)                                // passes at 100x threshold
    expect(checkZipBomb(buf, { ratioThreshold: 40 }).success).toBe(false)       // fails at 40x threshold
    expect(checkZipBomb(buf, { ratioThreshold: 40 }).error).toBe('ZIP_BOMB_DETECTED')
  })

  it('respects a custom maxFiles option', () => {
    // Build a ZIP with 5 files — fails custom maxFiles: 3
    const fileCount = 5
    const cdEntries = []
    for (let i = 0; i < fileCount; i++) {
      const cdh = Buffer.alloc(47)
      cdh.writeUInt32LE(0x02014b50, 0)
      cdh.writeUInt32LE(10, 20); cdh.writeUInt32LE(10, 24)
      cdh.writeUInt16LE(1, 28); cdh.writeUInt16LE(0, 30); cdh.writeUInt16LE(0, 32)
      cdh[46] = 0x61
      cdEntries.push(cdh)
    }
    const cd = Buffer.concat(cdEntries)
    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(fileCount, 8); eocd.writeUInt16LE(fileCount, 10)
    eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(0, 16)
    const buf = Buffer.concat([cd, eocd])

    expect(checkZipBomb(buf).success).toBe(true)                              // passes default (1000)
    expect(checkZipBomb(buf, { maxFiles: 3 }).success).toBe(false)            // fails custom (3)
    expect(checkZipBomb(buf, { maxFiles: 3 }).error).toBe('ZIP_BOMB_DETECTED')
  })

  it('passes a ZIP with compression ratio just under the threshold', () => {
    // 99x ratio — should pass the 100x default threshold
    const cdh = Buffer.alloc(47)
    cdh.writeUInt32LE(0x02014b50, 0)
    cdh.writeUInt32LE(100, 20); cdh.writeUInt32LE(9900, 24) // 99x
    cdh.writeUInt16LE(1, 28); cdh.writeUInt16LE(0, 30); cdh.writeUInt16LE(0, 32)
    cdh[46] = 0x61
    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
    eocd.writeUInt32LE(cdh.length, 12); eocd.writeUInt32LE(0, 16)
    const buf = Buffer.concat([cdh, eocd])
    expect(checkZipBomb(buf).success).toBe(true)
  })

  it('passes when totalCompressed is 0 (no division by zero)', () => {
    // Stored files have compressedSize == uncompressedSize, so if both are 0 — no ratio check
    const cdh = Buffer.alloc(47)
    cdh.writeUInt32LE(0x02014b50, 0)
    cdh.writeUInt32LE(0, 20); cdh.writeUInt32LE(0, 24)
    cdh.writeUInt16LE(1, 28); cdh.writeUInt16LE(0, 30); cdh.writeUInt16LE(0, 32)
    cdh[46] = 0x61
    const eocd = Buffer.alloc(22)
    eocd.writeUInt32LE(0x06054b50, 0)
    eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10)
    eocd.writeUInt32LE(cdh.length, 12); eocd.writeUInt32LE(0, 16)
    const buf = Buffer.concat([cdh, eocd])
    expect(checkZipBomb(buf).success).toBe(true) // 0/0 is guarded; no crash
  })
})

describe('validateFile — ZIP bomb integration', () => {
  it('rejects a bomb.zip through the full pipeline', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'bomb.zip'))
    const result = await validateFile(
      { buffer, filename: 'bomb.zip', mimeType: 'application/zip', size: buffer.length },
      { allowedExtensions: ['zip'], allowedMimeTypes: ['application/zip'] }
    )
    expect(result.success).toBe(false)
    expect(result.error).toBe('ZIP_BOMB_DETECTED')
  })

  it('passes a safe.zip through the full pipeline', async () => {
    const buffer = await readFile(path.join(fixturesDir, 'safe.zip'))
    const result = await validateFile(
      { buffer, filename: 'safe.zip', mimeType: 'application/zip', size: buffer.length },
      { allowedExtensions: ['zip'], allowedMimeTypes: ['application/zip'] }
    )
    expect(result.success).toBe(true)
  })
})
