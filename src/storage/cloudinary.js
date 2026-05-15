import { failResult, successResult } from '../errors/UploadError.js'

/**
 * Upload a file to Cloudinary.
 * Requires the optional peer dependency: cloudinary
 *
 * @param {{ buffer: Buffer, sanitizedFilename: string, size: number, mimeType: string }} file
 * @param {{ cloudName: string, apiKey: string, apiSecret: string, resourceType?: string, folder?: string }} config
 * @returns {Promise<{ success: true, data: object } | { success: false, error: string, message: string }>}
 */
export async function cloudinaryStore(file, config = {}) {
  let cloudinary
  try {
    const mod = await import('cloudinary')
    cloudinary = mod.v2
  } catch {
    return failResult(
      'STORAGE_ERROR',
      'Cloudinary storage requires the cloudinary package. Install it with: npm install cloudinary'
    )
  }

  const { cloudName, apiKey, apiSecret, resourceType = 'auto', folder } = config
  if (!cloudName || !apiKey || !apiSecret) {
    return failResult('STORAGE_ERROR', 'Cloudinary storage requires cloudName, apiKey, and apiSecret')
  }

  cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret })

  try {
    const uploadOptions = {
      resource_type: resourceType,
      use_filename: true,
      unique_filename: false,
    }
    if (folder) uploadOptions.folder = folder

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(uploadOptions, (err, res) => {
        if (err) reject(err)
        else resolve(res)
      })
      stream.end(file.buffer)
    })

    return successResult({
      url: result.secure_url,
      filename: file.sanitizedFilename,
      size: file.size,
      mimeType: file.mimeType,
      storage: 'cloudinary',
    })
  } catch (err) {
    return failResult('STORAGE_ERROR', `Cloudinary upload failed: ${err.message}`)
  }
}
