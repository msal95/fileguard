import { useRef, useCallback } from 'react'

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
  button: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: 'var(--fg-btn-padding, 8px 18px)',
    border: 'none',
    borderRadius: 'var(--fg-radius, 6px)',
    backgroundColor: 'var(--fg-primary, #2563eb)',
    color: 'var(--fg-btn-text, #ffffff)',
    fontSize: 'var(--fg-font-size, 14px)',
    fontWeight: '500',
    lineHeight: 1.5,
    cursor: 'pointer',
    transition: 'background-color 0.15s, opacity 0.15s',
  },
  disabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Simple file-picker button with optional client-side validation.
 *
 * This is a client-side convenience layer only — always validate again on
 * the server using fileguard's validation pipeline.
 *
 * @param {object}   props
 * @param {Function} [props.onUpload]   Called with each File that passes validation.
 * @param {Function} [props.onError]    Called with { error, message, file } on validation failure.
 * @param {string[]} [props.accept]     Allowed file extensions (e.g. ['pdf', 'docx']).
 * @param {number}   [props.maxSize]    Max file size in bytes.
 * @param {boolean}  [props.multiple]   If true, allows picking multiple files.
 * @param {boolean}  [props.headless]   If true, renders no inline styles on the button.
 * @param {boolean}  [props.disabled]
 * @param {*}        [props.children]   Button label content.
 * @param {string}   [props.className]
 * @param {object}   [props.style]      Additional style overrides.
 */
export function UploadButton({
  onUpload,
  onError,
  accept = [],
  maxSize,
  multiple = false,
  headless = false,
  disabled = false,
  children = 'Upload File',
  className,
  style,
  ...rest
}) {
  const inputRef = useRef(null)

  const handleFiles = useCallback(
    (files) => {
      Array.from(files).forEach((file) => {
        const result = clientValidate(file, accept, maxSize)
        if (!result.valid) {
          onError?.({ error: result.error, message: result.message, file })
          return
        }
        onUpload?.(file)
      })
    },
    [accept, maxSize, onUpload, onError]
  )

  const onClick = () => { if (!disabled) inputRef.current?.click() }
  const onChange = (e) => {
    if (e.target.files?.length) handleFiles(e.target.files)
    e.target.value = ''
  }

  const computedStyle = headless
    ? style
    : { ...S.button, ...(disabled ? S.disabled : {}), ...style }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        accept={accept.length ? accept.map((e) => `.${e}`).join(',') : undefined}
        multiple={multiple}
        disabled={disabled}
        onChange={onChange}
        tabIndex={-1}
      />
      <button
        type="button"
        className={className}
        style={computedStyle}
        disabled={disabled}
        onClick={onClick}
        {...rest}
      >
        {children}
      </button>
    </>
  )
}
