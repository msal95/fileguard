// uploadshield — TypeScript definitions
// Works with Node.js >=18, React >=18, Express, Next.js App Router, Fastify

/// <reference types="node" />

// ── Error codes ───────────────────────────────────────────────────────────────

export type ErrorCode =
  | 'FILE_TOO_LARGE'
  | 'INVALID_EXTENSION'
  | 'INVALID_MIME_TYPE'
  | 'INVALID_MAGIC_BYTES'
  | 'ZIP_BOMB_DETECTED'
  | 'POLYGLOT_DETECTED'
  | 'UNSAFE_FILENAME'
  | 'VIRUS_DETECTED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'STORAGE_ERROR'

// ── Result shapes ─────────────────────────────────────────────────────────────

export interface UploadData {
  url: string | null
  filename: string
  size: number
  mimeType: string
  storage: 'local' | 's3' | 'cloudinary' | string
}

export interface SuccessResult {
  success: true
  data: UploadData
}

export interface FailResult {
  success: false
  error: ErrorCode
  message: string
}

export type Result = SuccessResult | FailResult

export interface ValidationSuccess {
  success: true
  sanitizedFilename: string
}

export type ValidationResult = ValidationSuccess | FailResult

export interface ScanSuccess {
  success: true
  skipped?: boolean
}

export type ScanResult = ScanSuccess | FailResult

// ── Config ────────────────────────────────────────────────────────────────────

export interface ScanConfig {
  /** Always true — cannot be disabled. */
  magicBytes?: boolean
  /** Always true for archive types. */
  zipBomb?: boolean
  /** Always true. */
  polyglot?: boolean
  /** Opt-in: requires clamscan peer dep. Default: false. */
  clamav?: boolean
  /** Opt-in: requires a VirusTotal API key. Default: false. */
  virustotal?: boolean
}

export interface RateLimitConfig {
  enabled?: boolean
  maxUploads?: number
  windowMs?: number
}

export interface AuditConfig {
  enabled?: boolean
  logPath?: string
}

export interface ClamAVOptions {
  clamdscan?: {
    host?: string
    port?: number
    timeout?: number
    localFallback?: boolean
    path?: string
    configFile?: string
    multiscan?: boolean
    reloadDb?: boolean
    active?: boolean
    bypassRest?: boolean
  }
  preference?: string
}

export interface VirusTotalOptions {
  apiKey: string
  /** Milliseconds between poll attempts. Default: 5000. */
  pollIntervalMs?: number
  /** Maximum polling attempts before skipping. Default: 3. */
  maxPolls?: number
}

export interface FileguardConfig {
  // File validation
  maxFileSize?: number
  allowedExtensions?: string[]
  allowedMimeTypes?: string[]
  sanitizeFilename?: boolean
  scan?: ScanConfig
  rateLimit?: RateLimitConfig
  audit?: AuditConfig

  // Storage
  storage?: 'local' | 's3' | 'cloudinary'

  // Local storage
  localPath?: string

  // S3 storage
  bucket?: string
  region?: string
  prefix?: string
  endpoint?: string

  // Cloudinary storage
  cloudName?: string
  apiKey?: string
  apiSecret?: string
  resourceType?: 'auto' | 'image' | 'video' | 'raw'
  folder?: string

  // Optional scanner options
  clamavOptions?: ClamAVOptions
  virustotalOptions?: VirusTotalOptions

  // Next.js adapter
  fieldName?: string
}

// ── File input ────────────────────────────────────────────────────────────────

export interface FileInput {
  buffer: Buffer
  filename: string
  mimeType: string
  size: number
  sanitizedFilename?: string
}

// ── Errors ────────────────────────────────────────────────────────────────────

export declare class UploadError extends Error {
  readonly code: ErrorCode
  constructor(code: ErrorCode, message: string)
}

export declare function failResult(code: ErrorCode, message: string): FailResult
export declare function successResult(data: UploadData): SuccessResult

// ── createGuard ───────────────────────────────────────────────────────────────

export interface ProcessMeta {
  /** User ID or IP address used for rate limiting. */
  key?: string
}

export interface Guard {
  process(file: FileInput, meta?: ProcessMeta): Promise<Result>
}

export declare function createGuard(config?: FileguardConfig): Guard
export { createGuard as uploadshield }

// ── Core validation ───────────────────────────────────────────────────────────

export declare function validateFile(
  file: FileInput,
  config?: FileguardConfig
): Promise<ValidationResult>

export declare function checkFileSize(
  size: number,
  maxFileSize: number
): { success: true } | FailResult

export declare function checkExtension(
  filename: string,
  allowedExtensions: string[]
): { success: true } | FailResult

export declare function checkMimeType(
  mimeType: string,
  allowedMimeTypes: string[]
): { success: true } | FailResult

export declare function mergeConfig(userConfig?: Partial<FileguardConfig>): FileguardConfig

// ── Sanitizer ─────────────────────────────────────────────────────────────────

export interface SanitizeResult {
  sanitizedFilename: string
  wasUnsafe: boolean
}

export declare function sanitizeFilename(filename: string): SanitizeResult

// ── Rate limiter ──────────────────────────────────────────────────────────────

export interface RateLimiter {
  check(key: string): { success: true } | FailResult
  reset(key: string): void
}

export declare function createRateLimiter(
  config?: Pick<RateLimitConfig, 'maxUploads' | 'windowMs'>
): RateLimiter

// ── Audit logger ──────────────────────────────────────────────────────────────

export interface Logger {
  log(event: Record<string, unknown>): Promise<void>
}

export declare function createLogger(config?: AuditConfig): Logger

// ── Scanners ──────────────────────────────────────────────────────────────────

export interface DetectedType {
  ext: string
  mime: string
}

export declare function detectFileType(buffer: Buffer): Promise<DetectedType | null>

export declare function validateMagicBytes(
  buffer: Buffer,
  declaredMime: string,
  allowedMimeTypes: string[]
): Promise<{ success: true; detectedMime: string; detectedExt: string } | FailResult>

export declare function checkZipBomb(
  buffer: Buffer,
  options?: { ratioThreshold?: number; maxFiles?: number }
): { success: true } | FailResult

export declare function checkPolyglot(buffer: Buffer): { success: true } | FailResult

export declare function scanWithClamAV(
  buffer: Buffer,
  clamavOptions?: ClamAVOptions
): Promise<ScanResult>

export declare function scanWithVirusTotal(
  buffer: Buffer,
  config?: VirusTotalOptions & { pollIntervalMs?: number; maxPolls?: number }
): Promise<ScanResult>

// ── Storage adapters ──────────────────────────────────────────────────────────

export interface LocalConfig {
  localPath?: string
}

export interface S3Config {
  bucket: string
  region?: string
  prefix?: string
  endpoint?: string
}

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
  resourceType?: 'auto' | 'image' | 'video' | 'raw'
  folder?: string
}

export declare function localStore(file: FileInput, config?: LocalConfig): Promise<Result>
export declare function s3Store(file: FileInput, config: S3Config): Promise<Result>
export declare function cloudinaryStore(file: FileInput, config: CloudinaryConfig): Promise<Result>

export type StorageAdapter = typeof localStore | typeof s3Store | typeof cloudinaryStore

export declare function getStorageAdapter(
  type: 'local' | 's3' | 'cloudinary'
): Promise<StorageAdapter>

// ── Framework adapters ────────────────────────────────────────────────────────

// Express
export interface ExpressRequest {
  headers: Record<string, string | string[] | undefined>
  pipe<T>(destination: T): T
  uploadResult?: Result
  [key: string]: unknown
}

export interface ExpressResponse {
  [key: string]: unknown
}

export type NextFunction = (err?: unknown) => void

export declare function createExpressMiddleware(
  config?: FileguardConfig
): (req: ExpressRequest, res: ExpressResponse, next: NextFunction) => void

// Next.js App Router
export declare function createNextHandler(
  config?: FileguardConfig
): (request: Request) => Promise<Response>

// Fastify
export declare function createFastifyPlugin(
  config?: FileguardConfig
): (fastify: unknown) => Promise<void>

// ── React UI components ───────────────────────────────────────────────────────
// React (>=18) must be installed as a peer dependency.

export interface UploadError {
  error: ErrorCode
  message: string
  file: File
}

export interface DropZoneProps {
  onUpload?: (file: File) => void
  onError?: (err: UploadError) => void
  accept?: string[]
  maxSize?: number
  headless?: boolean
  multiple?: boolean
  children?: unknown
  className?: string
  style?: Record<string, string | number>
  [prop: string]: unknown
}

export interface UploadButtonProps {
  onUpload?: (file: File) => void
  onError?: (err: UploadError) => void
  accept?: string[]
  maxSize?: number
  multiple?: boolean
  headless?: boolean
  disabled?: boolean
  children?: unknown
  className?: string
  style?: Record<string, string | number>
  [prop: string]: unknown
}

export interface ProgressBarProps {
  progress?: number
  label?: string
  headless?: boolean
  className?: string
  style?: Record<string, string | number>
  [prop: string]: unknown
}

export interface FilePreviewProps {
  file: File | null
  onRemove?: () => void
  headless?: boolean
  className?: string
  style?: Record<string, string | number>
  [prop: string]: unknown
}

export declare function DropZone(props: DropZoneProps): unknown
export declare function UploadButton(props: UploadButtonProps): unknown
export declare function ProgressBar(props: ProgressBarProps): unknown
export declare function FilePreview(props: FilePreviewProps): unknown
