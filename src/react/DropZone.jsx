import { useState, useRef, useCallback } from 'react'

// ── Client-side validation ────────────────────────────────────────────────────

function clientValidate(file, accept, maxSize) {
  const ext = file.name.split('.').pop().toLowerCase()
  if (accept.length > 0 && !accept.map((e) => e.toLowerCase()).includes(ext)) {
    return { valid: false, error: 'INVALID_EXTENSION', message: `File type .${ext} is not allowed` }
  }
  if (maxSize != null && file.size > maxSize) {
    return { valid: false, error: 'FILE_TOO_LARGE', message: `File size exceeds the ${maxSize}-byte limit` }
  }
  return { valid: true }
}

// ── Default styles (overridable via CSS variables) ────────────────────────────

const S = {
  zone: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 'var(--fg-padding, 40px 24px)',
    border: '2px dashed var(--fg-border, #d1d5db)',
    borderRadius: 'var(--fg-radius, 10px)',
    backgroundColor: 'var(--fg-bg, #fafafa)',
    color: 'var(--fg-text, #6b7280)',
    cursor: 'pointer',
    transition: 'border-color 0.15s, background-color 0.15s',
    userSelect: 'none',
    outline: 'none',
  },
  zoneActive: {
    borderColor: 'var(--fg-primary, #2563eb)',
    backgroundColor: 'var(--fg-bg-active, #eff6ff)',
    color: 'var(--fg-text-active, #1d4ed8)',
  },
  hint: {
    margin: 0,
    fontSize: 'var(--fg-font-size, 14px)',
    lineHeight: 1.5,
    pointerEvents: 'none',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Drag-and-drop file upload zone with optional client-side validation.
 *
 * This is a client-side convenience layer only — always validate again on
 * the server using fileguard's validation pipeline.
 *
 * @param {object}   props
 * @param {Function} [props.onUpload]   Called with the File when it passes validation.
 * @param {Function} [props.onError]    Called with { error, message, file } on validation failure.
 * @param {string[]} [props.accept]     Allowed file extensions (e.g. ['png', 'jpg']).
 * @param {number}   [props.maxSize]    Max file size in bytes.
 * @param {boolean}  [props.headless]   If true, renders no inline styles.
 * @param {boolean}  [props.multiple]   If true, allows picking multiple files (all validated).
 * @param {*}        [props.children]   Override the default inner content.
 * @param {string}   [props.className]
 * @param {object}   [props.style]      Additional style overrides.
 */
export function DropZone({
  onUpload,
  onError,
  accept = [],
  maxSize,
  headless = false,
  multiple = false,
  children,
  className,
  style,
  ...rest
}) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef(null)

  const handleFile = useCallback(
    (file) => {
      const result = clientValidate(file, accept, maxSize)
      if (!result.valid) {
        onError?.({ error: result.error, message: result.message, file })
        return
      }
      onUpload?.(file)
    },
    [accept, maxSize, onUpload, onError]
  )

  const handleFiles = useCallback(
    (files) => Array.from(files).forEach(handleFile),
    [handleFile]
  )

  const onDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false) }
  const onDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files)
  }
  const onClick = () => inputRef.current?.click()
  const onKeyDown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }
  const onChange = (e) => {
    if (e.target.files?.length) handleFiles(e.target.files)
    e.target.value = ''
  }

  const computedStyle = headless
    ? style
    : { ...S.zone, ...(isDragging ? S.zoneActive : {}), ...style }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="File upload drop zone. Press Enter or Space to open the file picker."
      className={className}
      style={computedStyle}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onClick}
      onKeyDown={onKeyDown}
      {...rest}
    >
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        accept={accept.length ? accept.map((e) => `.${e}`).join(',') : undefined}
        multiple={multiple}
        onChange={onChange}
        tabIndex={-1}
      />
      {children ?? (
        <p style={headless ? undefined : S.hint}>
          Drop a file here or <strong>click to browse</strong>
        </p>
      )}
    </div>
  )
}
