import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'

// Top-level imports — fetch is stubbed per-test via vi.stubGlobal.
import { scanWithVirusTotal } from '../../src/scanners/virustotal.js'
import { validateFile } from '../../src/core/validator.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '../../fixtures')

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ANALYSIS_ID = 'abc123-analysis'
const UPLOAD_RESPONSE = { data: { id: ANALYSIS_ID } }

const CLEAN_RESPONSE = {
  data: {
    id: ANALYSIS_ID,
    attributes: { status: 'completed', stats: { malicious: 0, suspicious: 0, undetected: 10 } },
  },
}

const INFECTED_RESPONSE = {
  data: {
    id: ANALYSIS_ID,
    attributes: { status: 'completed', stats: { malicious: 5, suspicious: 2, undetected: 3 } },
  },
}

function mockFetch(...responses) {
  const fns = responses.map((r) =>
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(r),
      text: () => Promise.resolve(JSON.stringify(r)),
    })
  )
  let call = 0
  vi.stubGlobal('fetch', (...args) => fns[Math.min(call++, fns.length - 1)](...args))
}

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('scanWithVirusTotal', () => {
  it('skips (success) and warns when apiKey is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await scanWithVirusTotal(Buffer.from('data'), {})
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/apiKey/i))
    warn.mockRestore()
  })

  it('skips when apiKey is an empty string', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await scanWithVirusTotal(Buffer.from('data'), { apiKey: '' })
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    warn.mockRestore()
  })

  it('returns success for a clean file', async () => {
    mockFetch(UPLOAD_RESPONSE, CLEAN_RESPONSE)
    const result = await scanWithVirusTotal(Buffer.from('clean'), {
      apiKey: 'test-key',
      pollIntervalMs: 0,
    })
    expect(result.success).toBe(true)
    expect(result.skipped).toBeUndefined()
  })

  it('returns VIRUS_DETECTED for an infected file (malicious > 0)', async () => {
    mockFetch(UPLOAD_RESPONSE, INFECTED_RESPONSE)
    const result = await scanWithVirusTotal(Buffer.from('malware'), {
      apiKey: 'test-key',
      pollIntervalMs: 0,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('VIRUS_DETECTED')
    expect(result.message).toMatch(/malicious: 5/)
  })

  it('returns VIRUS_DETECTED when only suspicious count > 0', async () => {
    const suspiciousOnly = {
      data: {
        id: ANALYSIS_ID,
        attributes: { status: 'completed', stats: { malicious: 0, suspicious: 3, undetected: 7 } },
      },
    }
    mockFetch(UPLOAD_RESPONSE, suspiciousOnly)
    const result = await scanWithVirusTotal(Buffer.from('suspicious'), {
      apiKey: 'test-key',
      pollIntervalMs: 0,
    })
    expect(result.success).toBe(false)
    expect(result.error).toBe('VIRUS_DETECTED')
    expect(result.message).toMatch(/suspicious: 3/)
  })

  it('skips when analysis status is never "completed" with maxPolls=1', async () => {
    const queued = { data: { id: ANALYSIS_ID, attributes: { status: 'queued', stats: {} } } }
    let call = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const body = call++ === 0 ? UPLOAD_RESPONSE : queued
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await scanWithVirusTotal(Buffer.from('data'), {
      apiKey: 'test-key',
      pollIntervalMs: 0,
      maxPolls: 1,
    })
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    warn.mockRestore()
  })

  it('skips when analysis status is an unknown value (not completed/queued)', async () => {
    const failedAnalysis = {
      data: { id: ANALYSIS_ID, attributes: { status: 'failed', stats: {} } },
    }
    let call = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const body = call++ === 0 ? UPLOAD_RESPONSE : failedAnalysis
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await scanWithVirusTotal(Buffer.from('data'), {
      apiKey: 'test-key',
      pollIntervalMs: 0,
      maxPolls: 1,
    })
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    warn.mockRestore()
  })

  it('skips (success) when the upload returns a non-OK status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') })
    )
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await scanWithVirusTotal(Buffer.from('data'), { apiKey: 'bad-key' })
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/upload failed/i))
    warn.mockRestore()
  })

  it('skips (success) when the upload fetch throws a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ENOTFOUND')))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await scanWithVirusTotal(Buffer.from('data'), { apiKey: 'test-key' })
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    warn.mockRestore()
  })

  it('skips (success) when the analysis never completes within maxPolls', async () => {
    const queued = {
      data: { id: ANALYSIS_ID, attributes: { status: 'queued', stats: {} } },
    }
    let call = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const body = call++ === 0 ? UPLOAD_RESPONSE : queued
      return Promise.resolve({ ok: true, json: () => Promise.resolve(body) })
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await scanWithVirusTotal(Buffer.from('data'), {
      apiKey: 'test-key',
      pollIntervalMs: 0,
      maxPolls: 2,
    })
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/did not complete/i))
    warn.mockRestore()
  })

  it('skips (success) when a poll fetch throws', async () => {
    let call = 0
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      if (call++ === 0) return Promise.resolve({ ok: true, json: () => Promise.resolve(UPLOAD_RESPONSE) })
      return Promise.reject(new Error('Network reset'))
    }))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const result = await scanWithVirusTotal(Buffer.from('data'), {
      apiKey: 'test-key',
      pollIntervalMs: 0,
    })
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
    warn.mockRestore()
  })
})

// ── Integration through validateFile ─────────────────────────────────────────

describe('validateFile — VirusTotal integration', () => {
  it('returns VIRUS_DETECTED via the full pipeline when VT flags the file', async () => {
    mockFetch(UPLOAD_RESPONSE, INFECTED_RESPONSE)
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))

    const result = await validateFile(
      { buffer: pngBuffer, filename: 'safe.png', mimeType: 'image/png', size: pngBuffer.length },
      { scan: { virustotal: true }, virustotalOptions: { apiKey: 'test-key', pollIntervalMs: 0 } }
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('VIRUS_DETECTED')
  })

  it('does not call VirusTotal when scan.virustotal is false (default)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))

    await validateFile(
      { buffer: pngBuffer, filename: 'safe.png', mimeType: 'image/png', size: pngBuffer.length }
    )

    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
