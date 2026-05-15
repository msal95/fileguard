import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFile } from 'fs/promises'
import { fileURLToPath } from 'url'
import path from 'path'

// ── Mocks (must come before imports that trigger dynamic import of clamscan) ──
const mockScanStream = vi.fn()
const mockInit = vi.fn()

vi.mock('clamscan', () => ({
  default: vi.fn().mockImplementation(() => ({ init: mockInit })),
}))

// Top-level imports so vi.mock('clamscan') is active for the whole module graph.
const { scanWithClamAV } = await import('../../src/scanners/clamav.js')
const { validateFile } = await import('../../src/core/validator.js')

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(__dirname, '../../fixtures')

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockScanStream.mockReset()
  mockInit.mockReset()
  mockInit.mockResolvedValue({ scanStream: mockScanStream })
  mockScanStream.mockResolvedValue({ isInfected: false, viruses: [] })
})

// ── Unit tests ────────────────────────────────────────────────────────────────

describe('scanWithClamAV', () => {
  it('returns success for a clean file', async () => {
    const result = await scanWithClamAV(Buffer.from('clean data'))
    expect(result.success).toBe(true)
    expect(result.skipped).toBeUndefined()
    expect(mockScanStream).toHaveBeenCalledOnce()
  })

  it('returns VIRUS_DETECTED for an infected file', async () => {
    mockScanStream.mockResolvedValueOnce({ isInfected: true, viruses: ['Eicar.Test.File'] })
    const result = await scanWithClamAV(Buffer.from('infected'))
    expect(result.success).toBe(false)
    expect(result.error).toBe('VIRUS_DETECTED')
    expect(result.message).toMatch(/Eicar\.Test\.File/)
  })

  it('returns VIRUS_DETECTED with "unknown" when virus list is empty', async () => {
    mockScanStream.mockResolvedValueOnce({ isInfected: true, viruses: [] })
    const result = await scanWithClamAV(Buffer.from('infected'))
    expect(result.success).toBe(false)
    expect(result.error).toBe('VIRUS_DETECTED')
    expect(result.message).toMatch(/unknown/)
  })

  it('skips (success) when ClamAV daemon is not running', async () => {
    mockInit.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    const result = await scanWithClamAV(Buffer.from('any'))
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
  })

  it('skips (success) when scanStream throws', async () => {
    mockScanStream.mockRejectedValueOnce(new Error('Scan crashed'))
    const result = await scanWithClamAV(Buffer.from('any'))
    expect(result.success).toBe(true)
    expect(result.skipped).toBe(true)
  })

  it('forwards clamavOptions to NodeClam.init()', async () => {
    const opts = { clamdscan: { host: '127.0.0.1', port: 3310 } }
    await scanWithClamAV(Buffer.from('data'), opts)
    expect(mockInit).toHaveBeenCalledWith(opts)
  })
})

// ── Integration through validateFile ─────────────────────────────────────────

describe('validateFile — ClamAV integration', () => {
  it('returns VIRUS_DETECTED via the full pipeline when ClamAV flags the file', async () => {
    mockScanStream.mockResolvedValueOnce({ isInfected: true, viruses: ['Test.Virus'] })
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))

    const result = await validateFile(
      { buffer: pngBuffer, filename: 'safe.png', mimeType: 'image/png', size: pngBuffer.length },
      { scan: { clamav: true } }
    )

    expect(result.success).toBe(false)
    expect(result.error).toBe('VIRUS_DETECTED')
  })

  it('passes through when ClamAV returns clean', async () => {
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))

    const result = await validateFile(
      { buffer: pngBuffer, filename: 'safe.png', mimeType: 'image/png', size: pngBuffer.length },
      { scan: { clamav: true } }
    )

    expect(result.success).toBe(true)
  })

  it('does not run ClamAV when scan.clamav is false (default)', async () => {
    // If ClamAV were called, it would use mockScanStream which is clean. But we
    // verify it is never invoked at all.
    const pngBuffer = await readFile(path.join(fixturesDir, 'safe.png'))

    await validateFile(
      { buffer: pngBuffer, filename: 'safe.png', mimeType: 'image/png', size: pngBuffer.length }
      // no config override → scan.clamav defaults to false
    )

    expect(mockScanStream).not.toHaveBeenCalled()
  })
})
