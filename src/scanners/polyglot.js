import { failResult } from '../errors/UploadError.js'

// Hex byte sequences searched from offset 32 onward.
// Matching any of these in a non-archive file indicates a polyglot.
const RED_FLAGS = [
  { hex: '4d5a', label: 'Windows PE/EXE (MZ header)' },
  { hex: '3c736372697074', label: 'embedded <script> tag' },
  { hex: '504b0304', label: 'nested ZIP archive' },
  { hex: '3c3f706870', label: 'embedded PHP code' },
  { hex: '2321', label: 'shell shebang (#!)' },
]

// Pre-convert hex patterns to Buffer instances once at module load.
const FLAG_BUFS = RED_FLAGS.map(({ hex, label }) => ({
  buf: Buffer.from(hex, 'hex'),
  label,
}))

const SCAN_SKIP = 32

/**
 * Search for a needle Buffer inside a haystack Buffer starting at `fromOffset`.
 * @param {Buffer} haystack
 * @param {Buffer} needle
 * @param {number} fromOffset
 * @returns {boolean}
 */
function includes(haystack, needle, fromOffset) {
  const limit = haystack.length - needle.length
  for (let i = fromOffset; i <= limit; i++) {
    let match = true
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) { match = false; break }
    }
    if (match) return true
  }
  return false
}

/**
 * Scan a file buffer for polyglot indicators from byte 32 onward.
 * Files that embed executable or script content inside another format
 * (e.g. JPEG with a hidden PE header) are rejected.
 *
 * @param {Buffer} buffer
 * @returns {{ success: true } | { success: false, error: string, message: string }}
 */
export function checkPolyglot(buffer) {
  if (buffer.length <= SCAN_SKIP) return { success: true }

  for (const { buf, label } of FLAG_BUFS) {
    if (includes(buffer, buf, SCAN_SKIP)) {
      return failResult('POLYGLOT_DETECTED', `File contains suspicious embedded content: ${label}`)
    }
  }

  return { success: true }
}
