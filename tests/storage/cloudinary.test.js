import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock must be declared before the module under test is imported.
const mockUploadStream = vi.fn()
const mockConfig = vi.fn()

vi.mock('cloudinary', () => ({
  v2: {
    config: mockConfig,
    uploader: {
      upload_stream: mockUploadStream,
    },
  },
}))

const { cloudinaryStore } = await import('../../src/storage/cloudinary.js')

const SECURE_URL = 'https://res.cloudinary.com/demo/image/upload/v1/abc123.jpg'

const baseConfig = {
  cloudName: 'demo',
  apiKey: 'key123',
  apiSecret: 'secret456',
}

const makeFile = (overrides = {}) => ({
  buffer: Buffer.from('img data'),
  filename: 'photo.jpg',
  sanitizedFilename: 'abc123.jpg',
  size: 8,
  mimeType: 'image/jpeg',
  ...overrides,
})

beforeEach(() => {
  mockUploadStream.mockReset()
  mockConfig.mockReset()

  // Default mock: simulate a successful upload
  mockUploadStream.mockImplementation((_opts, cb) => {
    cb(null, { secure_url: SECURE_URL })
    return { end: vi.fn() }
  })
})

describe('cloudinaryStore', () => {
  it('calls cloudinary.config with credentials', async () => {
    await cloudinaryStore(makeFile(), baseConfig)
    expect(mockConfig).toHaveBeenCalledWith({
      cloud_name: 'demo',
      api_key: 'key123',
      api_secret: 'secret456',
    })
  })

  it('returns a success result with secure_url', async () => {
    const result = await cloudinaryStore(makeFile(), baseConfig)

    expect(result.success).toBe(true)
    expect(result.data.url).toBe(SECURE_URL)
    expect(result.data.storage).toBe('cloudinary')
    expect(result.data.filename).toBe('abc123.jpg')
    expect(result.data.size).toBe(8)
    expect(result.data.mimeType).toBe('image/jpeg')
  })

  it('calls upload_stream and ends the stream with the file buffer', async () => {
    const mockEnd = vi.fn()
    mockUploadStream.mockImplementation((_opts, cb) => {
      cb(null, { secure_url: SECURE_URL })
      return { end: mockEnd }
    })

    const file = makeFile()
    await cloudinaryStore(file, baseConfig)

    expect(mockUploadStream).toHaveBeenCalledOnce()
    expect(mockEnd).toHaveBeenCalledWith(file.buffer)
  })

  it('passes the folder option when provided', async () => {
    await cloudinaryStore(makeFile(), { ...baseConfig, folder: 'uploads/avatars' })

    expect(mockUploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ folder: 'uploads/avatars' }),
      expect.any(Function)
    )
  })

  it('uses the resourceType option when provided', async () => {
    await cloudinaryStore(makeFile(), { ...baseConfig, resourceType: 'raw' })

    expect(mockUploadStream).toHaveBeenCalledWith(
      expect.objectContaining({ resource_type: 'raw' }),
      expect.any(Function)
    )
  })

  it('returns STORAGE_ERROR when credentials are missing', async () => {
    const result = await cloudinaryStore(makeFile(), { cloudName: 'demo' })
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
    expect(result.message).toMatch(/apiKey|apiSecret/i)
  })

  it('returns STORAGE_ERROR when the upload_stream callback receives an error', async () => {
    mockUploadStream.mockImplementation((_opts, cb) => {
      cb(new Error('Upload quota exceeded'))
      return { end: vi.fn() }
    })

    const result = await cloudinaryStore(makeFile(), baseConfig)
    expect(result.success).toBe(false)
    expect(result.error).toBe('STORAGE_ERROR')
    expect(result.message).toMatch(/quota/i)
  })
})
