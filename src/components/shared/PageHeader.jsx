import cx from '../../utils/cx'

/**
 * Standard page masthead. Every feature route starts with one so the vertical
 * rhythm and title scale never drift between modules.
 */
export default function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}) {
  return (
    <header className={cx('mb-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-line bg-surface text-ink-soft">
              <Icon size={16} strokeWidth={1.8} />
            </span>
          )}

          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1 font-mono tnum text-[10.5px] uppercase tracking-[0.14em] text-faint">
                {eyebrow}
              </p>
            )}
            <h1 className="text-[20px] font-semibold leading-7 tracking-[-0.02em] text-ink">
              {title}
            </h1>
            {description && (
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-muted">{description}</p>
            )}
          </div>
        </div>

        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>

      {meta && <div className="mt-4">{meta}</div>}
    </header>
  )
}
