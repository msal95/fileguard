import { useState, useEffect } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'])

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${bytes} B`
}

// ── Default styles (overridable via CSS variables) ────────────────────────────

const S = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: 'var(--fg-padding, 12px)',
    border: '1px solid var(--fg-border, #e5e7eb)',
    borderRadius: 'var(--fg-radius, 8px)',
    backgroundColor: 'var(--fg-bg, #ffffff)',
  },
  thumbnail: {
    width: '48px',
    height: '48px',
    objectFit: 'cover',
    borderRadius: '4px',
    flexShrink: 0,
    display: 'block',
  },
  iconBox: {
    width: '48px',
    height: '48px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--fg-bg-active, #eff6ff)',
    borderRadius: '4px',
    fontSize: '22px',
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 'var(--fg-font-size, 14px)',
    fontWeight: '500',
    color: 'var(--fg-text, #111827)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    margin: 0,
  },
  meta: {
    fontSize: '12px',
    color: 'var(--fg-text-muted, #9ca3af)',
    margin: '2px 0 0',
  },
  removeBtn: {
    flexShrink: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--fg-text-muted, #9ca3af)',
    fontSize: '20px',
    lineHeight: 1,
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '4px',
    transition: 'color 0.15s',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Preview a selected file before it is uploaded.
 * Displays a thumbnail for images and a generic icon for other file types.
 *
 * @param {object}   props
 * @param {File}     props.file        The browser File object to preview.
 * @param {Function} [props.onRemove]  Called when the user clicks the remove button.
 * @param {boolean}  [props.headless]  If true, renders only semantic markup with no inline styles.
 * @param {string}   [props.className]
 * @param {object}   [props.style]     Additional style overrides.
 */
export function FilePreview({ file, onRemove, headless = false, className, style, ...rest }) {
  const [previewUrl, setPreviewUrl] = useState(null)
  const isImage = file != null && IMAGE_TYPES.has(file.type)

  useEffect(() => {
    if (!isImage || file == null) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(file)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [file, isImage])

  if (file == null) return null

  if (headless) {
    return (
      <div className={className} style={style} {...rest}>
        {isImage && previewUrl && <img src={previewUrl} alt={file.name} />}
        <span>{file.name}</span>
        <span>{formatBytes(file.size)}</span>
        <span>{file.type || 'unknown'}</span>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label={`Remove ${file.name}`}>
            Remove
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={className} style={{ ...S.container, ...style }} {...rest}>
      {isImage && previewUrl ? (
        <img src={previewUrl} alt="" style={S.thumbnail} aria-hidden="true" />
      ) : (
        <div style={S.iconBox} aria-hidden="true">
          📄
        </div>
      )}

      <div style={S.info}>
        <p style={S.name} title={file.name}>{file.name}</p>
        <p style={S.meta}>{formatBytes(file.size)} &middot; {file.type || 'unknown type'}</p>
      </div>

      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={S.removeBtn}
          aria-label={`Remove ${file.name}`}
          title="Remove file"
        >
          &times;
        </button>
      )}
    </div>
  )
}
