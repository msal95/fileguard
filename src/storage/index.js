export { localStore } from './local.js'
export { s3Store } from './s3.js'
export { cloudinaryStore } from './cloudinary.js'

/**
 * Return the storage adapter function for the given storage type string.
 * @param {'local'|'s3'|'cloudinary'} type
 * @returns {Function}
 */
export async function getStorageAdapter(type) {
  switch (type) {
    case 'local': {
      const { localStore } = await import('./local.js')
      return localStore
    }
    case 's3': {
      const { s3Store } = await import('./s3.js')
      return s3Store
    }
    case 'cloudinary': {
      const { cloudinaryStore } = await import('./cloudinary.js')
      return cloudinaryStore
    }
    default:
      throw new Error(`Unknown storage adapter: "${type}". Valid values: local, s3, cloudinary`)
  }
}
