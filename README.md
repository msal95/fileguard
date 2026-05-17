# uploadshield

Production-grade secure file upload middleware for Node.js.

Not just a file picker — real security: magic byte detection, ZIP bomb protection, polyglot file blocking, optional ClamAV + VirusTotal scanning, and unified adapters for Express, Next.js, and Fastify.

[![npm version](https://img.shields.io/npm/v/uploadshield.svg)](https://www.npmjs.com/package/uploadshield)
[![npm downloads](https://img.shields.io/npm/dm/uploadshield.svg)](https://www.npmjs.com/package/uploadshield)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node >=18](https://img.shields.io/node/v/uploadshield.svg)](https://www.npmjs.com/package/uploadshield)

---

## Features

- 🔍 **Magic bytes validation** — reads the actual file signature, not just the extension or declared MIME type
- 💣 **ZIP bomb detection** — rejects archives with compression ratio > 100× or > 1000 files
- 🧬 **Polyglot detection** — blocks files that embed MZ/EXE, `<script>`, PHP, nested ZIP, or shell shebangs
- 🧹 **Filename sanitization** — strips path traversal, null bytes, reserved names, and unsafe characters
- 🚦 **Rate limiting** — per-user/IP in-memory limiter, no Redis required
- 🦠 **ClamAV scanning** — opt-in, skips gracefully if daemon is unavailable
- 🌐 **VirusTotal scanning** — opt-in, skips gracefully on missing API key or network failure
- 🗄️ **Storage adapters** — local disk, AWS S3, Cloudinary
- ⚡ **Framework adapters** — Express middleware, Next.js App Router handler, Fastify plugin
- ⚛️ **React UI components** — DropZone, UploadButton, ProgressBar, FilePreview with CSS variable theming
- 📋 **Audit logging** — append-only JSON log of every upload attempt
- 🟦 **TypeScript** — full type definitions included, no `@types/uploadshield` needed

---

## Installation

```bash
npm install uploadshield
yarn add uploadshield
pnpm add uploadshield
bun add uploadshield
```

Optional peer dependencies — install only what you need:

```bash
# S3 storage
npm install @aws-sdk/client-s3
yarn add @aws-sdk/client-s3

# Cloudinary storage
npm install cloudinary
yarn add cloudinary

# ClamAV scanning
npm install clamscan
yarn add clamscan

# React UI components
npm install react
yarn add react
```

---

## Validation Pipeline

Every upload passes through this fixed sequence. No step can be skipped.

| Step | Check |
|------|-------|
| 1 | File size |
| 2 | Extension allowlist |
| 3 | MIME type allowlist |
| 4 | Magic bytes (reads first 8 KB of buffer) |
| 5 | ZIP bomb detection (archive types only) |
| 6 | Polyglot detection |
| 7 | Filename sanitization |
| 8 | ClamAV scan *(opt-in)* |
| 9 | VirusTotal scan *(opt-in)* |
| 10 | Rate limit check |
| 11 | Store to adapter |

---

## Quick Start

```js
import { createGuard } from 'uploadshield'

const guard = createGuard({
  allowedExtensions: ['jpg', 'png', 'pdf'],
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFileSize: 5 * 1024 * 1024, // 5 MB
  storage: 'local',
  localPath: './uploads',
})

const result = await guard.process({
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

## Express

```js
import express from 'express'
import { createExpressMiddleware } from 'uploadshield/express'

const app = express()

app.post(
  '/upload',
  createExpressMiddleware({
    allowedExtensions: ['jpg', 'png', 'pdf'],
    allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    maxFileSize: 5 * 1024 * 1024,
    storage: 'local',
    localPath: './uploads',
  }),
  (req, res) => {
    if (!req.uploadResult.success) return res.status(422).json(req.uploadResult)
    res.json(req.uploadResult)
  }
)
```

The middleware always calls `next()`. Validation errors appear in `req.uploadResult` — nothing is ever thrown.

---

## Next.js App Router

```js
// app/api/upload/route.js
import { createNextHandler } from 'uploadshield/nextjs'

export const POST = createNextHandler({
  allowedExtensions: ['jpg', 'png', 'pdf'],
  allowedMimeTypes: ['image/jpeg', 'image/png', 'application/pdf'],
  maxFileSize: 5 * 1024 * 1024,
  storage: 'local',
  localPath: './public/uploads',
  fieldName: 'file', // default
})
```

Returns a `Response` with JSON. Status `200` on success, `422` on validation failure, `400` when no file found.

---

## Fastify

```js
import Fastify from 'fastify'
import { createFastifyPlugin } from 'uploadshield/fastify'

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

## Storage Adapters

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
  prefix: 'uploads',     // optional key prefix
  endpoint: '...',       // optional — for S3-compatible services (MinIO, R2, etc.)
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
  resourceType: 'auto',  // 'image' | 'video' | 'raw' | 'auto'
  folder: 'uploads',     // optional
}
```

---

## Optional Scanners

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

If `clamscan` is not installed or the daemon is unreachable, the scan is **skipped with a console warning** — the upload is never blocked by a missing scanner.

### VirusTotal

```js
{
  scan: { virustotal: true },
  virustotalOptions: {
    apiKey: process.env.VT_API_KEY,
    pollIntervalMs: 5000,  // default
    maxPolls: 3,           // default
  },
}
```

If the API key is missing or the request fails, the scan is **skipped** — the upload proceeds.

---

## React UI Components

```bash
npm install react
```

```jsx
import { DropZone, UploadButton, ProgressBar, FilePreview } from 'uploadshield/react'

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

All four components accept a `headless` prop — set it to `true` to strip all built-in styles and apply your own CSS.

### CSS Variables

Theme any component by setting these on a parent element:

```css
:root {
  --fg-primary:     #2563eb;
  --fg-border:      #d1d5db;
  --fg-bg:          #fafafa;
  --fg-bg-active:   #eff6ff;
  --fg-text:        #111827;
  --fg-text-muted:  #9ca3af;
  --fg-radius:      8px;
  --fg-padding:     40px 24px;
  --fg-font-size:   14px;
  --fg-bar-height:  8px;
  --fg-bar-bg:      #e5e7eb;
  --fg-btn-padding: 8px 18px;
  --fg-btn-text:    #ffffff;
}
```

---

## Rate Limiting

```js
import { createGuard } from 'uploadshield'

const guard = createGuard({
  storage: 'local',
  localPath: './uploads',
  rateLimit: {
    enabled: true,
    maxUploads: 10,      // per key per window
    windowMs: 60_000,    // 1 minute
  },
})

// Pass a key (user ID or IP) as the second argument
const result = await guard.process(file, { key: req.ip })
```

---

## Audit Logging

```js
{
  audit: {
    enabled: true,
    logPath: './logs/uploads.log',  // appends JSON-newline entries
  },
}
```

Each log entry contains: `event`, `filename`, `size`, `storage`, `url` or `error`, and a UTC timestamp.

---

## Low-Level API

Use the building blocks directly without a framework adapter:

```js
import { validateFile } from 'uploadshield'
import { localStore } from 'uploadshield/storage/local'

const validation = await validateFile(
  { buffer, filename: 'photo.png', mimeType: 'image/png', size: buffer.length },
  { allowedExtensions: ['png'], allowedMimeTypes: ['image/png'] }
)

if (!validation.success) {
  console.error(validation.error) // 'INVALID_EXTENSION' | 'INVALID_MAGIC_BYTES' | …
} else {
  const result = await localStore(
    { ...file, sanitizedFilename: validation.sanitizedFilename },
    { localPath: './uploads' }
  )
}
```

---

## Result Shape

Every function returns a plain object — nothing is ever thrown to the caller.

```js
// Success
{ success: true, data: { url, filename, size, mimeType, storage } }

// Failure
{ success: false, error: 'ERROR_CODE', message: 'Human readable message' }
```

### Error Codes

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

## Default Configuration

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
    magicBytes: true,    // always on — cannot be disabled
    zipBomb:    true,    // runs for archive types
    polyglot:   true,    // always on
    clamav:     false,   // opt-in
    virustotal: false,   // opt-in
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

## TypeScript

Full type definitions are included — no `@types/uploadshield` needed.

```ts
import { createGuard } from 'uploadshield'
import type { FileguardConfig, Result } from 'uploadshield'

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

## Sub-path Exports

```js
import { createGuard, validateFile }       from 'uploadshield'
import { createExpressMiddleware }          from 'uploadshield/express'
import { createNextHandler }               from 'uploadshield/nextjs'
import { createFastifyPlugin }             from 'uploadshield/fastify'
import { localStore }                      from 'uploadshield/storage/local'
import { s3Store }                         from 'uploadshield/storage/s3'
import { cloudinaryStore }                 from 'uploadshield/storage/cloudinary'
import { DropZone, UploadButton }          from 'uploadshield/react'
import { scanWithClamAV }                  from 'uploadshield/scanners/clamav'
import { scanWithVirusTotal }              from 'uploadshield/scanners/virustotal'
```

---

## What's Built

| Module | Status |
|--------|--------|
| Core validation (size, extension, MIME, magic bytes) | ✅ |
| ZIP bomb detection | ✅ |
| Polyglot file detection | ✅ |
| Filename sanitization | ✅ |
| In-memory rate limiter | ✅ |
| Audit logger | ✅ |
| Local storage adapter | ✅ |
| S3 storage adapter | ✅ |
| Cloudinary storage adapter | ✅ |
| Express middleware | ✅ |
| Next.js App Router handler | ✅ |
| Fastify plugin | ✅ |
| ClamAV scanner (opt-in) | ✅ |
| VirusTotal scanner (opt-in) | ✅ |
| React UI components (4 components) | ✅ |
| TypeScript definitions | ✅ |

---

## Requirements

- Node.js >= 18.0.0
- `file-type`, `busboy`, `uuid` (included as dependencies)
- `@aws-sdk/client-s3` (optional — S3 storage)
- `cloudinary` (optional — Cloudinary storage)
- `clamscan` (optional — ClamAV scanning)
- `react >= 18` (optional — UI components)

---

## License

MIT © [Muhammad Shahid](https://github.com/msal95)
