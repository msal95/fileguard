import { failResult } from '../errors/UploadError.js'

const VT_BASE = 'https://www.virustotal.com/api/v3'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Scan a buffer with the VirusTotal API v3.
 *
 * Behaviour when scanning is unavailable:
 *   - apiKey missing or empty  → warn + skip (upload proceeds)
 *   - upload or poll failure   → warn + skip (upload proceeds)
 *   - analysis never completes → warn + skip (upload proceeds)
 *
 * @param {Buffer} buffer
 * @param {{ apiKey?: string, pollIntervalMs?: number, maxPolls?: number }} [config]
 * @returns {Promise<{ success: true, skipped?: true } | { success: false, error: string, message: string }>}
 */
export async function scanWithVirusTotal(buffer, config = {}) {
  const { apiKey, pollIntervalMs = 5_000, maxPolls = 3 } = config

  if (!apiKey) {
    console.warn('[uploadshield] VirusTotal scan skipped: no apiKey configured.')
    return { success: true, skipped: true }
  }

  const headers = { 'x-apikey': apiKey }

  // ── Upload ──────────────────────────────────────────────────────────────────
  let analysisId
  try {
    const formData = new FormData()
    formData.append('file', new Blob([buffer]), 'upload')

    const uploadRes = await fetch(`${VT_BASE}/files`, {
      method: 'POST',
      headers,
      body: formData,
    })

    if (!uploadRes.ok) {
      const text = await uploadRes.text().catch(() => uploadRes.status)
      console.warn(`[uploadshield] VirusTotal upload failed (${uploadRes.status}): ${text}. Skipping scan.`)
      return { success: true, skipped: true }
    }

    const { data } = await uploadRes.json()
    analysisId = data.id
  } catch (err) {
    console.warn(`[uploadshield] VirusTotal upload error: ${err.message}. Skipping scan.`)
    return { success: true, skipped: true }
  }

  // ── Poll for results ────────────────────────────────────────────────────────
  for (let i = 0; i < maxPolls; i++) {
    try {
      const res = await fetch(`${VT_BASE}/analyses/${analysisId}`, { headers })

      if (res.ok) {
        const { data } = await res.json()
        const status = data?.attributes?.status

        if (status === 'completed') {
          const { malicious = 0, suspicious = 0 } = data.attributes.stats ?? {}
          if (malicious > 0 || suspicious > 0) {
            return failResult(
              'VIRUS_DETECTED',
              `VirusTotal flagged this file (malicious: ${malicious}, suspicious: ${suspicious})`
            )
          }
          return { success: true }
        }
      }
    } catch (err) {
      console.warn(`[uploadshield] VirusTotal poll error: ${err.message}. Skipping scan.`)
      return { success: true, skipped: true }
    }

    // Wait before next poll (skip sleep on the final iteration)
    if (i < maxPolls - 1) await sleep(pollIntervalMs)
  }

  console.warn('[uploadshield] VirusTotal analysis did not complete in time. Skipping scan.')
  return { success: true, skipped: true }
}
