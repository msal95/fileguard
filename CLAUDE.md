# fileguard — Agent Instructions

Production-grade secure file upload middleware for Node.js.
Supports JS + TS. Works with Express, Next.js, Fastify.
Storage: Local, S3, Cloudinary. React UI components included.
ClamAV and VirusTotal scanning are optional.

---

## Build Phase Tracker

Complete phases in order. Never start a phase until the previous one passes all tests.

| Phase | Module | Status |
|-------|--------|--------|
| 1 | Project scaffold + core validation | ✅ DONE |
| 2 | Security scanners (zip bomb, polyglot, sanitizer, rate limiter) | ✅ DONE |
| 3 | Storage adapters (local, S3, Cloudinary) | ✅ DONE |
| 4 | Framework adapters (Express, Next.js, Fastify) | ✅ DONE |
| 5 | Optional scanners (ClamAV, VirusTotal) | ✅ DONE |
| 6 | React UI components | ✅ DONE |
| 7 | TypeScript definitions + final polish | ✅ DONE |

Update status: 🔲 TODO → 🔄 IN PROGRESS → ✅ DONE

---

## Architecture

```
fileguard/
├── src/
│   ├── core/
│   │   ├── validator.js       # Magic bytes + MIME + extension checks
│   │   ├── sanitizer.js       # Filename sanitization, path traversal block
│   │   ├── rateLimiter.js     # Per-user/IP in-memory rate limiter
│   │   └── index.js
│   ├── scanners/
│   │   ├── magicBytes.js      # File signature detection (zero deps)
│   │   ├── zipBomb.js         # ZIP bomb + archive abuse detection
│   │   ├── polyglot.js        # Polyglot file detection
│   │   ├── clamav.js          # Optional: ClamAV integration
│   │   ├── virustotal.js      # Optional: VirusTotal API
│   │   └── index.js
│   ├── storage/
│   │   ├── local.js           # Local disk storage adapter
│   │   ├── s3.js              # AWS S3 adapter
│   │   ├── cloudinary.js      # Cloudinary adapter
│   │   └── index.js
│   ├── adapters/
│   │   ├── express.js         # Express middleware
│   │   ├── nextjs.js          # Next.js App Router handler
│   │   ├── fastify.js         # Fastify plugin
│   │   └── index.js
│   ├── react/
│   │   ├── DropZone.jsx       # Drag-drop zone component
│   │   ├── UploadButton.jsx   # Simple file picker button
│   │   ├── ProgressBar.jsx    # Upload progress indicator
│   │   ├── FilePreview.jsx    # Preview before upload
│   │   └── index.js
│   ├── audit/
│   │   └── logger.js          # Audit log: every upload attempt
│   ├── errors/
│   │   └── UploadError.js     # Custom error classes
│   └── index.js               # Main entry point
├── types/
│   └── index.d.ts             # Full TypeScript definitions
├── tests/
│   ├── core/
│   ├── scanners/
│   ├── storage/
│   └── adapters/
├── fixtures/                  # Test files (safe images, PDFs, malicious samples)
├── CLAUDE.md
├── README.md
├── package.json
└── index.js
```

---

## Core Rules

**Never break these:**
- All functions return `{ success, data, error }` — never throw to caller
- Magic bytes check always runs — it is not optional
- Extension check always runs — it is not optional
- MIME check always runs — it is not optional
- ClamAV and VirusTotal are opt-in only — never required
- Zero mandatory external dependencies for core validation
- Every public function must have a JSDoc comment
- Every module must have its own test file

**File validation order (strict):**
1. File size check (fast, reject early)
2. Extension allowlist check
3. MIME type check
4. Magic bytes check (reads first 8KB of buffer)
5. ZIP bomb detection (if archive type)
6. Polyglot detection
7. Filename sanitization
8. ClamAV scan (if enabled)
9. VirusTotal scan (if enabled)
10. Rate limit check
11. Store to adapter

**Return shape (always):**
```js
// Success
{ success: true, data: { url, filename, size, mimeType, storage } }

// Failure
{ success: false, error: 'REASON_CODE', message: 'Human readable message' }
```

**Error codes:**
```
FILE_TOO_LARGE
INVALID_EXTENSION
INVALID_MIME_TYPE
INVALID_MAGIC_BYTES
ZIP_BOMB_DETECTED
POLYGLOT_DETECTED
UNSAFE_FILENAME
VIRUS_DETECTED
RATE_LIMIT_EXCEEDED
STORAGE_ERROR
```

---

## Dependencies

**Core (always installed):**
```json
{
  "file-type": "^19.0.0",
  "busboy": "^1.6.0",
  "uuid": "^9.0.0"
}
```

**Optional peer dependencies (user installs if needed):**
```json
{
  "@aws-sdk/client-s3": "peer — S3 storage",
  "cloudinary": "peer — Cloudinary storage",
  "clamscan": "peer — ClamAV scanning",
  "react": "peer — React UI components"
}
```

**Dev only:**
```json
{
  "vitest": "^1.6.0",
  "typescript": "^5.0.0"
}
```

---

## Key Implementation Details

### Magic Bytes (Phase 1)
```js
// Use file-type package — reads buffer, not filename
import { fileTypeFromBuffer } from 'file-type'
const type = await fileTypeFromBuffer(buffer.subarray(0, 8192))
// type = { ext: 'jpg', mime: 'image/jpeg' } or undefined
```

### ZIP Bomb Detection (Phase 2)
```js
// Check compression ratio — reject if > 100x
// Uncompressed size / compressed size > 100 = bomb
// Read zip central directory without full extraction
```

### Polyglot Detection (Phase 2)
```js
// After magic bytes pass, scan deeper buffer for:
const redFlags = [
  '4d5a',       // MZ — Windows PE/EXE header
  '3c7363726970', // <script
  '504b0304',   // ZIP header (skip first 32 bytes)
]
// Search from byte offset 32 onward
```

### Filename Sanitization (Phase 2)
```js
// Strip path separators, null bytes, special chars
// Generate UUID-based safe name: uuid + original-ext
// Block reserved names: CON, PRN, AUX, NUL, COM1-9, LPT1-9
// Max length: 255 chars
```

### Rate Limiter (Phase 2)
```js
// In-memory Map — no Redis needed
// Key: userId or IP
// Config: { maxUploads: 10, windowMs: 60000 }
// Auto-clean expired entries on each check
```

### S3 Adapter (Phase 3)
```js
// Use @aws-sdk/client-s3 v3 (modular, tree-shakeable)
// Support: putObject, presigned URLs, custom bucket/prefix
// Check if peer dep installed before using — throw clear message if not
```

### Cloudinary Adapter (Phase 3)
```js
// Use cloudinary npm package
// Support: image + raw + video resource_type
// Return secure_url in data
// Check if peer dep installed before using
```

### Express Adapter (Phase 4)
```js
// Returns middleware function: (req, res, next) => void
// Attaches result to req.uploadResult
// Calls next(error) on failure
```

### Next.js Adapter (Phase 4)
```js
// Returns handler: async (request: Request) => Response
// Works with App Router (route.js)
// Returns JSON response directly
```

### Fastify Adapter (Phase 4)
```js
// Returns Fastify plugin: fp((fastify, opts, done) => ...)
// Adds fastify.uploadGuard() decorator
```

---

## Phase Details

### Phase 1 — Core Validation
Files to create:
- `src/core/validator.js` — main validation pipeline
- `src/scanners/magicBytes.js` — magic byte detection
- `src/errors/UploadError.js` — error classes
- `src/index.js` — exports createGuard factory
- `tests/core/validator.test.js`
- `tests/scanners/magicBytes.test.js`
- `package.json` — with correct exports map
- `index.js` — root entry

Test command: `npm test -- tests/core tests/scanners/magicBytes.test.js`

Acceptance: upload a valid PNG → passes. Upload PNG renamed to .exe → fails INVALID_EXTENSION. Upload EXE renamed to .png → fails INVALID_MAGIC_BYTES.

---

### Phase 2 — Security Scanners
Files to create:
- `src/scanners/zipBomb.js`
- `src/scanners/polyglot.js`
- `src/core/sanitizer.js`
- `src/core/rateLimiter.js`
- `src/audit/logger.js`
- `tests/scanners/zipBomb.test.js`
- `tests/scanners/polyglot.test.js`
- `tests/core/sanitizer.test.js`
- `tests/core/rateLimiter.test.js`
- `fixtures/` — add test files: safe.png, safe.pdf, bomb.zip, polyglot.jpg

Test command: `npm test -- tests/scanners tests/core`

Acceptance: zip bomb → ZIP_BOMB_DETECTED. Polyglot → POLYGLOT_DETECTED. `../../../etc/passwd` filename → sanitized to UUID. Rate limit exceeded → RATE_LIMIT_EXCEEDED.

---

### Phase 3 — Storage Adapters
Files to create:
- `src/storage/local.js`
- `src/storage/s3.js`
- `src/storage/cloudinary.js`
- `src/storage/index.js`
- `tests/storage/local.test.js`
- `tests/storage/s3.test.js` (mock @aws-sdk)
- `tests/storage/cloudinary.test.js` (mock cloudinary)

Test command: `npm test -- tests/storage`

Acceptance: local adapter saves file to disk, returns path. S3 adapter (mocked) returns expected URL shape. Cloudinary adapter (mocked) returns secure_url.

---

### Phase 4 — Framework Adapters
Files to create:
- `src/adapters/express.js`
- `src/adapters/nextjs.js`
- `src/adapters/fastify.js`
- `src/adapters/index.js`
- `tests/adapters/express.test.js`
- `tests/adapters/nextjs.test.js`

Test command: `npm test -- tests/adapters`

Acceptance: Express — req.uploadResult populated on success. Next.js — returns Response with JSON. Invalid file — correct error code returned, not thrown.

---

### Phase 5 — Optional Scanners
Files to create:
- `src/scanners/clamav.js`
- `src/scanners/virustotal.js`
- `tests/scanners/clamav.test.js` (mock clamscan)
- `tests/scanners/virustotal.test.js` (mock fetch)

Test command: `npm test -- tests/scanners/clamav tests/scanners/virustotal`

Rules:
- If ClamAV not installed: log warning, skip scan, do NOT fail upload
- If VirusTotal API key missing: log warning, skip scan
- If scan returns infected: return VIRUS_DETECTED

---

### Phase 6 — React UI Components
Files to create:
- `src/react/DropZone.jsx`
- `src/react/UploadButton.jsx`
- `src/react/ProgressBar.jsx`
- `src/react/FilePreview.jsx`
- `src/react/index.js`

Rules:
- Zero CSS framework dependency — inline styles with CSS vars
- Headless variant available for each component (unstyled)
- Client-side only: extension check + size check (NOT a replacement for server checks)
- Expose: `onUpload`, `onError`, `onProgress` callbacks
- Works with React 18+

---

### Phase 7 — TypeScript + Polish
Files to create:
- `types/index.d.ts` — full type definitions for all public APIs
- Update `package.json` exports map
- Update README.md with final API
- Run full test suite

Test command: `npm test`

Acceptance: zero TypeScript errors when imported in a `.ts` file. All 7 phases' tests pass.

---

## package.json Exports Map

```json
{
  "exports": {
    ".": "./index.js",
    "./express": "./src/adapters/express.js",
    "./nextjs": "./src/adapters/nextjs.js",
    "./fastify": "./src/adapters/fastify.js",
    "./storage/s3": "./src/storage/s3.js",
    "./storage/cloudinary": "./src/storage/cloudinary.js",
    "./storage/local": "./src/storage/local.js",
    "./react": "./src/react/index.js",
    "./scanners/clamav": "./src/scanners/clamav.js",
    "./scanners/virustotal": "./src/scanners/virustotal.js"
  }
}
```

---

## Default Config Reference

```js
const defaultConfig = {
  maxFileSize: 10 * 1024 * 1024,      // 10MB
  allowedExtensions: ['jpg','jpeg','png','gif','webp','pdf','doc','docx','xls','xlsx'],
  allowedMimeTypes: ['image/jpeg','image/png','image/gif','image/webp','application/pdf'],
  storage: 'local',
  localPath: './uploads',
  scan: {
    magicBytes: true,     // always true — cannot disable
    zipBomb: true,        // always true for archive types
    polyglot: true,       // always true
    clamav: false,        // opt-in
    virustotal: false,    // opt-in
  },
  rateLimit: {
    enabled: false,
    maxUploads: 10,
    windowMs: 60 * 1000,
  },
  audit: {
    enabled: false,
    logPath: './logs/uploads.log',
  },
  sanitizeFilename: true,
}
```

---

## Testing Notes

- Use `vitest` for all tests
- Never make real network calls in tests — mock S3, Cloudinary, VirusTotal
- Keep test fixture files small (< 50KB each)
- Test both success and failure paths for every function
- Run `npm test` after each phase to confirm nothing broke

---

## What NOT to Build in v1

- Chunked / resumable uploads
- Video processing / transcoding
- Image resizing / optimization
- Database integration
- Admin dashboard UI
- Encryption at rest

These are v2 features. Keep v1 focused.
