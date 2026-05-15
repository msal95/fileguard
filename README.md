# fileguard

Production-grade secure file upload middleware for Node.js — magic bytes validation, virus scanning, multi-storage, and React UI components in one package.

Not just a file picker. Real security: magic byte detection, ZIP bomb protection, polyglot file blocking, optional ClamAV + VirusTotal scanning, and unified adapters for Express, Next.js, and Fastify.

[![npm version](https://img.shields.io/npm/v/fileguard.svg)](https://www.npmjs.com/package/fileguard)
[![npm downloads](https://img.shields.io/npm/dm/fileguard.svg)](https://www.npmjs.com/package/fileguard)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node >=18](https://img.shields.io/node/v/fileguard.svg)](https://www.npmjs.com/package/fileguard)

---

## Installation

```bash
npm install fileguard
```

Optional peer dependencies (install only what you need):

```bash
npm install @aws-sdk/client-s3   # S3 storage
npm install cloudinary           # Cloudinary storage
npm install clamscan             # ClamAV scanning
```

---

## Validation order

Every upload is checked in this fixed order. No step can be skipped.

1. File size
2. Extension allowlist
3. MIME type allowlist
4. Magic bytes (reads first 8 KB of the buffer)
5. ZIP bomb detection (archive types only)
6. Polyglot detection
7. Filename sanitisation
8. ClamAV scan *(opt-in)*
9. VirusTotal scan *(opt-in)*
10. Rate limit check
11. Store to adapter

---

## Express

```js
import express from 'express'
import { createExpressMiddleware } from 'fileguard/express'

const app = express()

app.post(
  '/upload',
  createExpressMiddleware({
    allowedExtensions: ['jpg', 'png', 'pdf'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxFileSize: 5 * 1024 * 1024, // 5 MB
    storage: 'local',
    localPath: './uploads',
  }),
  (req, res) => {
    const result = req.uploadResult
    if (!result.success) return res.status(422).json(result)
    res.json(result)
  }
)
```

The middleware always calls `next()`. Validation errors are in `req.uploadResult`, not thrown.

---

## Next.js App Router

```js
// app/api/upload/route.js
import { createNextHandler } from 'fileguard/nextjs'

export const POST = createNextHandler({
  allowedExtensions: ['jpg', 'png', 'pdf'],
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFileSize: 5 * 1024 * 1024,
  storage: 'local',
  localPath: './public/uploads',
  fieldName: 'file', // default
})
```

Returns a `Response` with JSON. Status 200 on success, 422 on validation failure, 400 when no file found.

---

## Fastify

```js
import Fastify from 'fastify'
import { createFastifyPlugin } from 'fileguard/fastify'

const fastify = Fastify()

await fastify.register(createFastifyPlugin({
  storage: 'local',
  localPath: './uploads',
}))

fastify.post('/upload', { preHandler: fastify.uploadGuard() }, async (req, reply) => {
  return req.uploadResult
})
```

---

## Storage adapters

### Local

```js
{ storage: 'local', localPath: './uploads' }
```

### S3

```bash
npm install @aws-sdk/client-s3
```

```js
{
  storage: 's3',
  bucket: 'my-bucket',
  region: 'us-east-1',
  prefix: 'uploads',    // optional key prefix
  endpoint: '...',      // optional — for S3-compatible services (MinIO etc.)
}
```

### Cloudinary

```bash
npm install cloudinary
```

```js
{
  storage: 'cloudinary',
  cloudName: 'my-cloud',
  apiKey: 'key',
  apiSecret: 'secret',
  resourceType: 'auto', // 'image' | 'video' | 'raw' | 'auto'
  folder: 'uploads',    // optional
}
```

---

## Optional scanners

### ClamAV

```bash
npm install clamscan
```

```js
{
  scan: { clamav: true },
  clamavOptions: {
    clamdscan: { host: '127.0.0.1', port: 3310 },
  },
}
```

If `clamscan` is not installed or the daemon is not running, the scan is **skipped** with a console warning — the upload is never blocked by a missing scanner.

### VirusTotal

```js
{
  scan: { virustotal: true },
  virustotalOptions: {
    apiKey: process.env.VT_API_KEY,
    pollIntervalMs: 5000, // default
    maxPolls: 3,          // default
  },
}
```

If the API key is missing or the request fails, the scan is **skipped** — the upload proceeds.

---

## React UI components

```bash
npm install react
```

```jsx
import { DropZone, UploadButton, ProgressBar, FilePreview } from 'fileguard/react'

function Uploader() {
  const [file, setFile] = useState(null)
  const [progress, setProgress] = useState(0)

  const handleUpload = async (file) => {
    setFile(file)
    const form = new FormData()
    form.append('file', file)

    const xhr = new XMLHttpRequest()
    xhr.upload.onprogress = (e) => setProgress(Math.round(e.loaded / e.total * 100))
    xhr.open('POST', '/api/upload')
    xhr.send(form)
  }

  return (
    <>
      <DropZone
        onUpload={handleUpload}
        onError={(err) => console.error(err.message)}
        accept={['jpg', 'png', 'pdf']}
        maxSize={5 * 1024 * 1024}
      />
      {file && <FilePreview file={file} onRemove={() => setFile(null)} />}
      {progress > 0 && <ProgressBar progress={progress} label="Uploading…" />}
      <UploadButton onUpload={handleUpload}>Pick a file</UploadButton>
    </>
  )
}
```

All components accept a `headless` prop — set it to `true` to strip all inline styles and apply your own CSS.

### CSS variables

Themed via CSS variables on any parent element:

```css
:root {
  --fg-primary:    #2563eb;
  --fg-border:     #d1d5db;
  --fg-bg:         #fafafa;
  --fg-bg-active:  #eff6ff;
  --fg-text:       #111827;
  --fg-text-muted: #9ca3af;
  --fg-radius:     8px;
  --fg-padding:    40px 24px;
  --fg-font-size:  14px;
  --fg-bar-height: 8px;
  --fg-bar-bg:     #e5e7eb;
  --fg-btn-padding: 8px 18px;
  --fg-btn-text:   #ffffff;
}
```

---

## Default configuration

```js
{
  maxFileSize: 10 * 1024 * 1024,           // 10 MB
  allowedExtensions: [
    'jpg', 'jpeg', 'png', 'gif', 'webp',
    'pdf', 'doc', 'docx', 'xls', 'xlsx',
  ],
  allowedMimeTypes: [
    'image/jpeg', 'image/png', 'image/gif',
    'image/webp', 'application/pdf',
  ],
  storage: 'local',
  localPath: './uploads',
  scan: {
    magicBytes: true,   // cannot be disabled
    zipBomb:    true,   // runs for archive types
    polyglot:   true,   // always runs
    clamav:     false,  // opt-in
    virustotal: false,  // opt-in
  },
  rateLimit: {
    enabled:    false,
    maxUploads: 10,
    windowMs:   60_000,
  },
  audit: {
    enabled: false,
    logPath: './logs/uploads.log',
  },
  sanitizeFilename: true,
}
```

---

## Result shape

Every function returns a plain object — nothing is ever thrown to the caller.

```js
// Success
{ success: true, data: { url, filename, size, mimeType, storage } }

// Failure
{ success: false, error: 'ERROR_CODE', message: 'Human readable message' }
```

### Error codes

| Code | Trigger |
|------|---------|
| `FILE_TOO_LARGE` | File exceeds `maxFileSize` |
| `INVALID_EXTENSION` | Extension not in `allowedExtensions` |
| `INVALID_MIME_TYPE` | Declared MIME not in `allowedMimeTypes` |
| `INVALID_MAGIC_BYTES` | File content doesn't match declared type |
| `ZIP_BOMB_DETECTED` | Compression ratio > 100× or > 1000 files |
| `POLYGLOT_DETECTED` | File embeds MZ, `<script>`, nested ZIP, or PHP |
| `UNSAFE_FILENAME` | Reserved for future use |
| `VIRUS_DETECTED` | ClamAV or VirusTotal flagged the file |
| `RATE_LIMIT_EXCEEDED` | Upload rate limit exceeded |
| `STORAGE_ERROR` | Write to storage adapter failed |

---

## TypeScript

Full type definitions are included — no `@types/fileguard` needed.

```ts
import { createGuard, FileguardConfig, Result } from 'fileguard'

const guard = createGuard({ storage: 'local', localPath: './uploads' })

const result: Result = await guard.process({
  buffer,
  filename: 'photo.jpg',
  mimeType: 'image/jpeg',
  size: buffer.length,
})

if (result.success) {
  console.log(result.data.url)
} else {
  console.error(result.error, result.message)
}
```

---

## Low-level API

Use the building blocks directly without a framework adapter:

```js
import { validateFile } from 'fileguard'
import { localStore }   from 'fileguard/storage/local'

const validation = await validateFile(
  { buffer, filename: 'photo.png', mimeType: 'image/png', size: buffer.length },
  { allowedExtensions: ['png'], allowedMimeTypes: ['image/png'] }
)

if (!validation.success) {
  console.error(validation.error) // 'INVALID_EXTENSION' | 'INVALID_MAGIC_BYTES' | …
} else {
  const result = await localStore(
    { ...fileInput, sanitizedFilename: validation.sanitizedFilename },
    { localPath: './uploads' }
  )
}
```

---

## License

MIT
