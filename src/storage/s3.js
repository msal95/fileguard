import { failResult, successResult } from '../errors/UploadError.js'

/**
 * Store a file to AWS S3 (or an S3-compatible service).
 * Requires the optional peer dependency: @aws-sdk/client-s3
 *
 * @param {{ buffer: Buffer, sanitizedFilename: string, size: number, mimeType: string }} file
 * @param {{ bucket: string, region?: string, prefix?: string, endpoint?: string }} config
 * @returns {Promise<{ success: true, data: object } | { success: false, error: string, message: string }>}
 */
export async function s3Store(file, config = {}) {
  let S3Client, PutObjectCommand
  try {
    const sdk = await import('@aws-sdk/client-s3')
    S3Client = sdk.S3Client
    PutObjectCommand = sdk.PutObjectCommand
  } catch {
    return failResult(
      'STORAGE_ERROR',
      'S3 storage requires @aws-sdk/client-s3. Install it with: npm install @aws-sdk/client-s3'
    )
  }

  const { bucket, region = 'us-east-1', prefix = '', endpoint } = config
  if (!bucket) {
    return failResult('STORAGE_ERROR', 'S3 storage requires a bucket name in config')
  }

  const filename = file.sanitizedFilename
  const key = prefix ? `${prefix}/${filename}` : filename

  const clientOptions = { region }
  if (endpoint) clientOptions.endpoint = endpoint

  const client = new S3Client(clientOptions)

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimeType,
        ContentLength: file.size,
      })
    )

    const baseUrl = endpoint
      ? `${endpoint.replace(/\/$/, '')}/${bucket}/${key}`
      : `https://${bucket}.s3.${region}.amazonaws.com/${key}`

    return successResult({
      url: baseUrl,
      filename,
      size: file.size,
      mimeType: file.mimeType,
      storage: 's3',
    })
  } catch (err) {
    return failResult('STORAGE_ERROR', `S3 upload failed: ${err.message}`)
  }
}
