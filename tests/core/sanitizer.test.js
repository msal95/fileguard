import { describe, it, expect } from 'vitest'
import { sanitizeFilename } from '../../src/core/sanitizer.js'

describe('sanitizeFilename', () => {
  it('preserves a clean filename unchanged', () => {
    const { sanitizedFilename, wasUnsafe } = sanitizeFilename('photo.jpg')
    expect(sanitizedFilename).toBe('photo.jpg')
    expect(wasUnsafe).toBe(false)
  })

  it('lowercases the extension', () => {
    const { sanitizedFilename } = sanitizeFilename('Image.PNG')
    expect(sanitizedFilename.endsWith('.png')).toBe(true)
  })

  it('replaces spaces with underscores in the stem', () => {
    const { sanitizedFilename } = sanitizeFilename('my photo.jpg')
    expect(sanitizedFilename).toBe('my_photo.jpg')
  })

  it('sanitizes path traversal (../../../etc/passwd) to UUID + ext', () => {
    const { sanitizedFilename, wasUnsafe } = sanitizeFilename('../../../etc/passwd')
    expect(wasUnsafe).toBe(true)
    // Result must not contain any path separators or dots-dots
    expect(sanitizedFilename).not.toContain('..')
    expect(sanitizedFilename).not.toContain('/')
    expect(sanitizedFilename).not.toContain('\\')
    // UUID pattern: 8-4-4-4-12 hex chars
    expect(sanitizedFilename).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('sanitizes filenames containing forward slashes', () => {
    const { wasUnsafe } = sanitizeFilename('foo/bar.jpg')
    expect(wasUnsafe).toBe(true)
  })

  it('sanitizes filenames containing backslashes', () => {
    const { wasUnsafe } = sanitizeFilename('foo\\bar.jpg')
    expect(wasUnsafe).toBe(true)
  })

  it('sanitizes filenames containing null bytes', () => {
    const { wasUnsafe } = sanitizeFilename('evil\0.jpg')
    expect(wasUnsafe).toBe(true)
  })

  it('sanitizes Windows reserved name CON', () => {
    const { sanitizedFilename, wasUnsafe } = sanitizeFilename('CON.txt')
    expect(wasUnsafe).toBe(true)
    expect(sanitizedFilename).not.toBe('CON.txt')
    expect(sanitizedFilename.endsWith('.txt')).toBe(true)
  })

  it('sanitizes Windows reserved name NUL (case-insensitive)', () => {
    const { wasUnsafe } = sanitizeFilename('nul.exe')
    expect(wasUnsafe).toBe(true)
  })

  it('sanitizes COM1 and LPT9', () => {
    expect(sanitizeFilename('COM1.txt').wasUnsafe).toBe(true)
    expect(sanitizeFilename('LPT9.doc').wasUnsafe).toBe(true)
  })

  it('truncates filenames longer than 255 characters', () => {
    const longName = 'a'.repeat(260) + '.jpg'
    const { sanitizedFilename } = sanitizeFilename(longName)
    expect(sanitizedFilename.length).toBeLessThanOrEqual(255)
  })

  it('generates a UUID name when the stem is empty after cleaning', () => {
    const { sanitizedFilename } = sanitizeFilename('!!@@##.jpg')
    expect(sanitizedFilename.endsWith('.jpg')).toBe(true)
    expect(sanitizedFilename).not.toBe('!!@@##.jpg')
  })

  it('handles a dotfile filename (.jpg) without crashing', () => {
    // Node.js path.extname('.jpg') returns '' — the whole string is treated as stem
    // The leading dot is stripped by the sanitizer, yielding 'jpg' as the final name
    const { sanitizedFilename, wasUnsafe } = sanitizeFilename('.jpg')
    expect(typeof sanitizedFilename).toBe('string')
    expect(sanitizedFilename.length).toBeGreaterThan(0)
    expect(wasUnsafe).toBe(false)
  })

  it('converts whitespace-only stem to underscores (no crash)', () => {
    const { sanitizedFilename, wasUnsafe } = sanitizeFilename('   .png')
    // spaces → underscores; not flagged as unsafe
    expect(sanitizedFilename.endsWith('.png')).toBe(true)
    expect(wasUnsafe).toBe(false)
    expect(sanitizedFilename).toMatch(/^_+\.png$/)
  })

  it('preserves hyphens in the filename stem', () => {
    const { sanitizedFilename, wasUnsafe } = sanitizeFilename('my-photo-2024.jpg')
    expect(sanitizedFilename).toBe('my-photo-2024.jpg')
    expect(wasUnsafe).toBe(false)
  })

  it('strips unicode/emoji characters from the stem without crashing', () => {
    // Unicode chars stripped by regex; not flagged as "unsafe" (no traversal/control chars)
    const { sanitizedFilename, wasUnsafe } = sanitizeFilename('café_photo🔥.jpg')
    expect(wasUnsafe).toBe(false)
    expect(sanitizedFilename.endsWith('.jpg')).toBe(true)
    expect(sanitizedFilename).not.toContain('🔥')
    expect(sanitizedFilename).not.toContain('é')
  })
})
