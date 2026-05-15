import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be declared before importing the module under test.
const mockSend = vi.fn()
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((params) => ({ _params: params })),
}))

const { s3Store } = await import('../../src/storage/s3.js')

const baseConfig = { bucket: 'my-bucket', region: 'us-east-1' }

const makeFile = (overrides = {}) => ({
  buffer: Buffer.from('img data'),
  filename: 'photo.jpg',
  sanitizedFilename: 'abc123.jpg',
  size: 8,
  mimeType: 'image/jpeg',
  ...overrides,
})

beforeEach(() => {
  mockSend.mockReset()
  mockSend.mockResolvedValue({}) // default: success
})

describe('s3Store', () => {
  it('calls PutObjectCommand with correct params and returns a success result', async () => {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')

    const result = await s3Store(makeFile(), baseConfig)

    expect(result.success).toBe(true)
    expect(result.data.storage).toBe('s3')
    expect(result.data.filename).toBe('abc123.jpg')
    expect(result.data.size).toBe(8)
    expect(result.data.mimeType).toBe('image/jpeg')

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        Bucket: 'my-bucket',
        Key: 'abc123.jpg',
        ContentType: 'image/jpeg',
      })
    )
    expect(mockSend).toHaveBeenCalledOnce()
  })

  it('returns a correctly shaped S3 URL', async () => {
    const result = await s3Store(makeFile(), baseConfig)
    expect(result.data.url).toBe('https://my-bucket.s3.us-east-1.amazonaws.com/abc123.jpg')
  })

  it('prepends prefix to the S3 key when provided', async () => {
    const { PutObjectCommand } = await import('@aws-sdk/client-s3')
    await s3Store(makeFile(), { ...baseConfig, prefix: 'uploads/2024' })

    expect(PutObjectCommand).toHaveBeenCalledWith(
      expect.objectContaining({ Key: 'uploads/2024/abc123.jpg' })
    )
  })

  it('uses a custom endpoint URL when provided', async () => {
    const result = await s3Store(makeFile(), {
      ...baseConfig,
      endpoint: 'http://localhost:9000',
    })
    expect(result.data.url).toBe('http://localhost:9000/my-bucket/abc123.jpg')
  })

  it('returns STORAGE_ERROR when bucket is not configured', async () => {
    const result = await s3Store(makeFile(), { region: 'us-east-1' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
    expect(result.message).toMatch(/bucket/i)
  })

  it('returns STORAGE_ERROR when the SDK send call throws', async () => {
    mockSend.mockRejectedValueOnce(new Error('Access Denied'))
    const result = await s3Store(makeFile(), baseConfig)
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
    expect(result.message).toMatch(/Access Denied/i)
  })
})
