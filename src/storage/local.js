import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { failResult, successResult } from '../errors/UploadError.js'

/**
 * Store a file to the local filesystem.
 *
 * @param {{ buffer: Buffer, sanitizedFilename?: string, filename: string, size: number, mimeType: string }} file
 * @param {{ localPath?: string }} [config]
 * @returns {Promise<{ success: true, data: object } | { success: false, error: string, message: string }>}
 */
export async function localStore(file, config = {}) {
  const { localPath = './uploads' } = config
  const ext = path.extname(file.filename).toLowerCase()
  const filename = file.sanitizedFilename ?? `${uuidv4()}${ext}`
  const destDir = path.resolve(localPath)
  const destPath = path.join(destDir, filename)

  // Guard against path traversal: sanitizedFilename must stay under destDir
  if (!destPath.startsWith(destDir + path.sep) && destPath !== destDir) {
    return failResult('STORAGE_ERROR', 'Path traversal detected in filename')
  }

  try {
    await mkdir(destDir, { recursive: true })
    await writeFile(destPath, file.buffer)

    return successResult({
      url: destPath,
      filename,
      size: file.size,
      mimeType: file.mimeType,
      storage: 'local',
    })
  } catch (err) {
    return failResult('STORAGE_ERROR', `Local storage failed: ${err.message}`)
  }
}
