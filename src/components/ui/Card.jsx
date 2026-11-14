import cx from '../../utils/cx'

/**
 * Flat white surface with a 1px hairline. No blurry shadows — elevation is
 * communicated with borders and spacing only.
 */
export default function Card({
  as: Tag = 'div',
  interactive = false,
  padded = false,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={cx(
        'surface',
        padded && 'p-4',
        interactive && 'transition-colors duration-150 hover:border-line-strong',
        className,
      )}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export function CardHeader({ icon: Icon, title, description, actions, className, children }) {
  return (
    <div
      className={cx(
        'flex items-start justify-between gap-4 border-b border-line px-4 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-2.5">
        {Icon && (
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-sunken text-muted">
            <Icon size={13} strokeWidth={1.9} />
          </span>
        )}
        <div className="min-w-0">
          {title && (
            <h3 className="truncate text-[13.5px] font-semibold leading-6 text-ink">{title}</h3>
          )}
          {description && (
            <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{description}</p>
          )}
          {children}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
    </div>
  )
}

export function CardBody({ className, padded = true, children }) {
  return <div className={cx(padded && 'p-4', className)}>{children}</div>
}

export function CardFooter({ className, children }) {
  return (
    <div
      className={cx(
        'flex items-center justify-between gap-3 border-t border-line bg-sunken/40 px-4 py-2.5',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** Uppercase micro-label used above sections and inside dense tables. */
export function SectionLabel({ className, children }) {
  return (
    <span
      className={cx(
        'text-[10.5px] font-semibold uppercase tracking-[0.09em] text-faint',
        className,
      )}
    >
      {children}
    </span>
  )
}

export function EmptyState({ icon: Icon, title, description, action, className }) {
  return (
    <div
      className={cx(
        'grid-backdrop flex flex-col items-center justify-center rounded-lg border border-dashed border-line px-6 py-12 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-muted">
          <Icon size={16} strokeWidth={1.8} />
        </span>
      )}
      <h3 className="text-[13.5px] font-semibold text-ink">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-[12.5px] leading-5 text-muted">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

/** Two-column definition row used across dashboards and detail panels. */
export function DataRow({ label, value, mono = false, className }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 py-2', className)}>
      <span className="text-[12.5px] text-muted">{label}</span>
      <span
        className={cx(
          'text-[12.5px] font-medium text-ink',
          mono && 'font-mono tnum tracking-tight',
        )}
      >
        {value}
      </span>
    </div>
  )
}
