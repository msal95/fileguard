// Smoke-test that the public type definitions compile without errors.
import type {
  FileguardConfig,
  Result,
  FailResult,
  SuccessResult,
  ValidationResult,
  ValidationSuccess,
  ErrorCode,
  Guard,
  RateLimiter,
  RateLimitConfig,
  FileInput,
  UploadData,
  ScanResult,
  SanitizeResult,
  Logger,
  AuditConfig,
  DetectedType,
  LocalConfig,
  S3Config,
  CloudinaryConfig,
  ProcessMeta,
  DropZoneProps,
  UploadButtonProps,
  ProgressBarProps,
  FilePreviewProps,
} from './types/index.d.ts'

// ── Config ────────────────────────────────────────────────────────────────────

const cfg: FileguardConfig = {
  maxFileSize: 5 * 1024 * 1024,
  allowedExtensions: ['jpg', 'png', 'pdf'],
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  storage: 'local',
  localPath: './uploads',
  scan: { clamav: false, virustotal: false, magicBytes: true },
  rateLimit: { enabled: true, maxUploads: 10, windowMs: 60_000 },
  audit: { enabled: false, logPath: './logs/upload.log' },
  sanitizeFilename: true,
}

const s3Cfg: FileguardConfig = {
  storage: 's3',
  bucket: 'my-bucket',
  region: 'us-east-1',
  prefix: 'uploads',
}

const cloudinaryCfg: FileguardConfig = {
  storage: 'cloudinary',
  cloudName: 'demo',
  apiKey: 'key',
  apiSecret: 'secret',
  resourceType: 'image',
  folder: 'avatars',
}

// ── File input ────────────────────────────────────────────────────────────────

const fileInput: FileInput = {
  buffer: Buffer.alloc(100),
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  size: 100,
  sanitizedFilename: 'abc123.jpg',
}

// ── Result shapes ─────────────────────────────────────────────────────────────

const ok: SuccessResult = {
  success: true,
  data: { url: 'https://cdn.example.com/file.jpg', filename: 'file.jpg', size: 100, mimeType: 'image/jpeg', storage: 'local' },
}

const fail: FailResult = {
  success: false,
  error: 'INVALID_EXTENSION',
  message: 'Extension not allowed',
}

const result: Result = ok
const result2: Result = fail

const vs: ValidationSuccess = { success: true, sanitizedFilename: 'abc.jpg' }
const vr: ValidationResult = vs

// ── Guard ─────────────────────────────────────────────────────────────────────

async function testGuard(guard: Guard) {
  const r: Result = await guard.process(fileInput)
  const r2: Result = await guard.process(fileInput, { key: '127.0.0.1' })

  if (r.success) {
    const url: string | null = r.data.url
    const name: string = r.data.filename
    const size: number = r.data.size
  } else {
    const code: ErrorCode = r.error
    const msg: string = r.message
  }
}

// ── Rate limiter ──────────────────────────────────────────────────────────────

function testLimiter(limiter: RateLimiter) {
  const r = limiter.check('user-id')
  limiter.reset('user-id')
}

// ── Sanitize result ───────────────────────────────────────────────────────────

const sr: SanitizeResult = { sanitizedFilename: 'abc123.jpg', wasUnsafe: true }
const _sf: string = sr.sanitizedFilename
const _unsafe: boolean = sr.wasUnsafe

// ── Scan result ───────────────────────────────────────────────────────────────

const scanOk: ScanResult = { success: true }
const scanSkip: ScanResult = { success: true, skipped: true }
const scanFail: ScanResult = { success: false, error: 'VIRUS_DETECTED', message: 'Infected' }

// ── Storage configs ───────────────────────────────────────────────────────────

const localCfg: LocalConfig = { localPath: './uploads' }
const s3: S3Config = { bucket: 'my-bucket', region: 'us-east-1', prefix: 'up', endpoint: 'http://localhost:9000' }
const cdn: CloudinaryConfig = { cloudName: 'demo', apiKey: 'key', apiSecret: 'secret', folder: 'up', resourceType: 'image' }

// ── React prop shapes ─────────────────────────────────────────────────────────

const dzProps: DropZoneProps = {
  onUpload: (f: File) => console.log(f.name),
  onError: (e) => console.error(e.error, e.message),
  accept: ['jpg', 'png'],
  maxSize: 5 * 1024 * 1024,
  headless: false,
  multiple: false,
  className: 'my-zone',
}

const ubProps: UploadButtonProps = {
  onUpload: (f: File) => {},
  accept: ['pdf'],
  multiple: true,
  headless: true,
  disabled: false,
  children: 'Upload',
}

const pbProps: ProgressBarProps = {
  progress: 42,
  label: 'Uploading…',
  headless: false,
}

const fpProps: FilePreviewProps = {
  file: null,
  onRemove: () => {},
  headless: false,
}

// Ensure ErrorCode exhaustiveness
function assertCode(c: ErrorCode): string {
  switch (c) {
    case 'FILE_TOO_LARGE': return c
    case 'INVALID_EXTENSION': return c
    case 'INVALID_MIME_TYPE': return c
    case 'INVALID_MAGIC_BYTES': return c
    case 'ZIP_BOMB_DETECTED': return c
    case 'POLYGLOT_DETECTED': return c
    case 'UNSAFE_FILENAME': return c
    case 'VIRUS_DETECTED': return c
    case 'RATE_LIMIT_EXCEEDED': return c
    case 'STORAGE_ERROR': return c
  }
}
