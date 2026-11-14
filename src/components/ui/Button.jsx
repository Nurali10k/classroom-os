import { forwardRef } from 'react'
import cx from '../../utils/cx'

const VARIANTS = {
  /** Solid — the default for primary actions. Inverts in dark mode. */
  primary:
    'bg-solid text-on-solid border border-transparent hover:bg-solid-hover active:bg-solid-active',
  /** Deep indigo — used when a primary action needs to read as "system". */
  accent:
    'bg-accent text-white border border-transparent hover:bg-accent-hover active:bg-accent-active',
  /** Thin outline on the card surface — the workhorse secondary control. */
  secondary:
    'bg-surface text-ink-soft border border-line hover:border-line-strong hover:bg-sunken',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-sunken hover:text-ink',
  subtle: 'bg-sunken text-ink-soft border border-transparent hover:bg-sunken-strong',
  danger:
    'bg-danger-soft text-danger border border-danger-line hover:bg-danger-soft-strong active:bg-danger-soft-strong',
}

const SIZES = {
  sm: 'h-8 px-2.5 text-[12.5px] gap-1.5',
  md: 'h-9 px-3.5 text-[13px] gap-2',
  lg: 'h-10 px-4 text-[13.5px] gap-2',
  icon: 'h-9 w-9 justify-center',
  'icon-sm': 'h-8 w-8 justify-center',
}

function Spinner({ className }) {
  return (
    <svg
      className={cx('animate-spin', className)}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M21 12a9 9 0 0 0-9-9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/**
 * @param {object} props
 * @param {'primary'|'accent'|'secondary'|'ghost'|'subtle'|'danger'} [props.variant]
 * @param {'sm'|'md'|'lg'|'icon'|'icon-sm'} [props.size]
 */
const Button = forwardRef(function Button(
  {
    variant = 'secondary',
    size = 'md',
    icon: Icon,
    iconRight: IconRight,
    loading = false,
    fullWidth = false,
    className,
    children,
    disabled,
    type = 'button',
    ...rest
  },
  ref,
) {
  const isIconOnly = size === 'icon' || size === 'icon-sm'

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex select-none items-center justify-center rounded-md font-medium',
        'transition-colors duration-150 ease-out',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANTS[variant] ?? VARIANTS.secondary,
        SIZES[size] ?? SIZES.md,
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <Spinner />
      ) : (
        Icon && <Icon size={isIconOnly ? 16 : 14.5} strokeWidth={1.9} className="shrink-0" />
      )}
      {!isIconOnly && children}
      {!isIconOnly && IconRight && (
        <IconRight size={14.5} strokeWidth={1.9} className="shrink-0 opacity-70" />
      )}
    </button>
  )
})

export default Button
