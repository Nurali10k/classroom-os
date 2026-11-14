import { useTranslation } from 'react-i18next'
import cx from '../../utils/cx'

const SIZES = { xs: 12, sm: 14, md: 18, lg: 24 }

/** Custom hairline spinner — one accent arc on a faint track. */
export function Spinner({ size = 14, className, label = 'Loading' }) {
  const { t } = useTranslation()
  const px = typeof size === 'number' ? size : (SIZES[size] ?? 14)

  return (
    <span
      role="status"
      aria-label={label === 'Loading' ? t('common.loading') : label}
      className={cx('inline-flex items-center', className)}
    >
      <svg
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        className="animate-spin"
        aria-hidden="true"
      >
        <circle
          cx="12"
          cy="12"
          r="9.5"
          stroke="currentColor"
          strokeOpacity="0.16"
          strokeWidth="2.5"
        />
        <path
          d="M12 2.5a9.5 9.5 0 0 1 9.5 9.5"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
    </span>
  )
}

/** Inline centered loading block for card bodies. */
export function Loader({ label = 'Loading', className, compact = false }) {
  const { t } = useTranslation()
  return (
    <div
      className={cx(
        'flex items-center justify-center gap-2.5 text-muted',
        compact ? 'py-6' : 'py-14',
        className,
      )}
    >
      <Spinner size={15} />
      <span className="text-[12.5px]">{label === 'Loading' ? t('common.loading') : label}</span>
    </div>
  )
}

/** Full-viewport loader used while the auth session resolves. */
export function PageLoader({ label = 'Booting Classroom OS' }) {
  const { t } = useTranslation()
  return (
    <div className="grid-backdrop flex min-h-screen flex-col items-center justify-center gap-3 bg-canvas">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface text-ink">
        <Spinner size={16} />
      </div>
      <p className="font-mono tnum text-[11.5px] uppercase tracking-[0.14em] text-faint">
        {label === 'Booting Classroom OS' ? t('app.booting') : label}
      </p>
    </div>
  )
}

export function SkeletonBlock({ className }) {
  return <div className={cx('animate-pulse rounded-md bg-sunken', className)} />
}

/** Table/list placeholder that mirrors the real row rhythm. */
export function SkeletonRows({ rows = 5, className }) {
  return (
    <div className={cx('divide-y divide-line', className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <SkeletonBlock className="h-7 w-7 rounded-full" />
          <SkeletonBlock className="h-3 w-40" />
          <SkeletonBlock className="ml-auto h-3 w-20" />
          <SkeletonBlock className="h-5 w-16" />
        </div>
      ))}
    </div>
  )
}

export default Loader
