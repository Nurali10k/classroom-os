import { useTranslation } from 'react-i18next'
import cx from '../../utils/cx'
import { ROLE_META } from '../../utils/constants'

const TONES = {
  neutral: 'bg-sunken text-ink-soft border-line',
  outline: 'bg-surface text-muted border-line',
  ink: 'bg-solid text-on-solid border-transparent',
  accent: 'bg-accent-soft text-accent-ink border-accent-line',
  danger: 'bg-danger-soft text-danger border-danger-line',
  warn: 'bg-warn-soft text-warn border-warn-line',
  success: 'bg-success-soft text-success border-success-line',
}

const DOT_TONES = {
  neutral: 'bg-faint',
  ink: 'bg-solid',
  accent: 'bg-accent',
  danger: 'bg-danger',
  warn: 'bg-dot-warn',
  success: 'bg-dot-success',
}

export function Dot({ tone = 'neutral', pulse = false, className }) {
  return (
    <span className={cx('relative flex h-1.5 w-1.5 shrink-0', className)}>
      {pulse && (
        <span
          className={cx(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            DOT_TONES[tone] ?? DOT_TONES.neutral,
          )}
        />
      )}
      <span
        className={cx('relative inline-flex h-1.5 w-1.5 rounded-full', DOT_TONES[tone] ?? DOT_TONES.neutral)}
      />
    </span>
  )
}

export default function Badge({
  tone = 'neutral',
  icon: Icon,
  dot = false,
  mono = false,
  className,
  children,
  ...rest
}) {
  return (
    <span
      className={cx(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-md border px-1.5',
        'text-[11px] font-medium leading-none',
        mono && 'font-mono tnum uppercase tracking-tight',
        TONES[tone] ?? TONES.neutral,
        className,
      )}
      {...rest}
    >
      {dot && <Dot tone={tone} />}
      {Icon && <Icon size={11.5} strokeWidth={2} className="shrink-0 opacity-80" />}
      {children}
    </span>
  )
}

/** Role chip that reads its label straight from the domain constants. */
export function RoleBadge({ role, className, showLabel = true }) {
  const { t } = useTranslation()
  const meta = ROLE_META[role]
  if (!meta) return null

  return (
    <Badge
      tone={meta.tone}
      mono
      className={className}
      title={t(`roles.${role}.summary`, { defaultValue: meta.summary })}
    >
      {showLabel ? t(`roles.${role}.label`, { defaultValue: meta.label }) : meta.abbr}
    </Badge>
  )
}

/** Room / lesson badge — always monospaced so grid columns never jitter. */
export function MonoBadge({ tone = 'outline', className, children, ...rest }) {
  return (
    <Badge tone={tone} mono className={cx('px-2', className)} {...rest}>
      {children}
    </Badge>
  )
}
