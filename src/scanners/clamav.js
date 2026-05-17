import { Readable } from 'stream'
import { failResult } from '../errors/UploadError.js'

/**
 * Scan a buffer with ClamAV using the optional `clamscan` peer dependency.
 *
 * Behaviour when ClamAV is unavailable:
 *   - clamscan not installed  → warn + skip (upload proceeds)
 *   - ClamAV daemon not running → warn + skip (upload proceeds)
 *
 * @param {Buffer} buffer
 * @param {object} [clamavOptions] - options forwarded to NodeClam.init()
 * @returns {Promise<{ success: true, skipped?: true } | { success: false, error: string, message: string }>}
 */
export async function scanWithClamAV(buffer, clamavOptions = {}) {
  let NodeClam
  try {
    const mod = await import('clamscan')
    NodeClam = mod.default ?? mod
  } catch {
    console.warn(
      '[uploadshield] ClamAV scan skipped: clamscan package is not installed. ' +
        'Install it with: npm install clamscan'
    )
    return { success: true, skipped: true }
  }

  let clam
  try {
    clam = await new NodeClam().init(clamavOptions)
  } catch (err) {
    console.warn(`[uploadshield] ClamAV initialisation failed: ${err.message}. Skipping scan.`)
    return { success: true, skipped: true }
  }

  try {
    const stream = Readable.from(buffer)
    const { isInfected, viruses } = await clam.scanStream(stream)

    if (isInfected) {
      const names = Array.isArray(viruses) && viruses.length ? viruses.join(', ') : 'unknown'
      return failResult('VIRUS_DETECTED', `ClamAV detected malware: ${names}`)
    }

    return { success: true }
  } catch (err) {
    console.warn(`[uploadshield] ClamAV scan error: ${err.message}. Skipping scan.`)
    return { success: true, skipped: true }
  }
}
