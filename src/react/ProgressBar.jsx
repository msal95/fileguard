// ── Default styles (overridable via CSS variables) ────────────────────────────

const S = {
  wrapper: {
    width: '100%',
  },
  labelRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: '6px',
    fontSize: 'var(--fg-font-size, 13px)',
    color: 'var(--fg-text, #6b7280)',
  },
  track: {
    width: '100%',
    height: 'var(--fg-bar-height, 8px)',
    backgroundColor: 'var(--fg-bar-bg, #e5e7eb)',
    borderRadius: 'var(--fg-radius, 999px)',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: 'var(--fg-primary, #2563eb)',
    borderRadius: 'inherit',
    transition: 'width 0.25s ease',
  },
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Upload progress indicator.
 *
 * @param {object}  props
 * @param {number}  [props.progress]  Value from 0–100. Clamped automatically.
 * @param {string}  [props.label]     Optional label shown above the bar.
 * @param {boolean} [props.headless]  If true, renders only semantic markup with no inline styles.
 * @param {string}  [props.className]
 * @param {object}  [props.style]     Additional style overrides for the outermost element.
 */
export function ProgressBar({ progress = 0, label, headless = false, className, style, ...rest }) {
  const clamped = Math.max(0, Math.min(100, progress))

  if (headless) {
    return (
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Upload progress'}
        className={className}
        style={style}
        {...rest}
      >
        <div style={{ width: `${clamped}%` }} />
      </div>
    )
  }

  return (
    <div className={className} style={{ ...S.wrapper, ...style }} {...rest}>
      {label != null && (
        <div style={S.labelRow} aria-hidden="true">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Upload progress'}
        style={S.track}
      >
        <div style={{ ...S.fill, width: `${clamped}%` }} />
      </div>
    </div>
  )
}
