import { failResult } from '../errors/UploadError.js'

const EOCD_SIG = 0x06054b50
const CD_SIG = 0x02014b50

/**
 * Locate the End of Central Directory record by scanning backwards.
 * @param {Buffer} buf
 * @returns {number} byte offset, or -1 if not found
 */
function findEOCD(buf) {
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === EOCD_SIG) return i
  }
  return -1
}

/**
 * Walk the central directory and sum compressed/uncompressed sizes.
 * @param {Buffer} buf
 * @param {number} cdOffset
 * @param {number} cdSize
 * @returns {{ totalCompressed: number, totalUncompressed: number, fileCount: number }}
 */
function parseCentralDirectory(buf, cdOffset, cdSize) {
  let totalCompressed = 0
  let totalUncompressed = 0
  let fileCount = 0
  let offset = cdOffset

  while (offset < cdOffset + cdSize && offset + 46 <= buf.length) {
    if (buf.readUInt32LE(offset) !== CD_SIG) break

    const compressedSize = buf.readUInt32LE(offset + 20)
    const uncompressedSize = buf.readUInt32LE(offset + 24)
    const filenameLen = buf.readUInt16LE(offset + 28)
    const extraLen = buf.readUInt16LE(offset + 30)
    const commentLen = buf.readUInt16LE(offset + 32)

    totalCompressed += compressedSize
    totalUncompressed += uncompressedSize
    fileCount++

    offset += 46 + filenameLen + extraLen + commentLen
  }

  return { totalCompressed, totalUncompressed, fileCount }
}

/**
 * Check a ZIP buffer for zip bomb patterns.
 * Rejects if compression ratio > ratioThreshold or file count > maxFiles.
 *
 * @param {Buffer} buffer
 * @param {{ ratioThreshold?: number, maxFiles?: number }} [options]
 * @returns {{ success: true } | { success: false, error: string, message: string }}
 */
export function checkZipBomb(buffer, options = {}) {
  const { ratioThreshold = 100, maxFiles = 1000 } = options

  const eocdOffset = findEOCD(buffer)
  if (eocdOffset === -1) {
    return failResult('ZIP_BOMB_DETECTED', 'Invalid ZIP structure: no end-of-central-directory record found')
  }

  const cdSize = buffer.readUInt32LE(eocdOffset + 12)
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16)

  if (cdOffset + cdSize > buffer.length) {
    return failResult('ZIP_BOMB_DETECTED', 'Invalid ZIP structure: central directory out of bounds')
  }

  const { totalCompressed, totalUncompressed, fileCount } = parseCentralDirectory(buffer, cdOffset, cdSize)

  if (fileCount > maxFiles) {
    return failResult('ZIP_BOMB_DETECTED', `ZIP contains ${fileCount} files, exceeding the limit of ${maxFiles}`)
  }

  if (totalCompressed > 0 && totalUncompressed / totalCompressed > ratioThreshold) {
    const ratio = (totalUncompressed / totalCompressed).toFixed(1)
    return failResult('ZIP_BOMB_DETECTED', `Compression ratio ${ratio}x exceeds the limit of ${ratioThreshold}x`)
  }

  return { success: true }
}
