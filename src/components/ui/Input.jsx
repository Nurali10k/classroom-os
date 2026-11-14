import { forwardRef, useId } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Search } from 'lucide-react'
import cx from '../../utils/cx'

/** Label + hint + error shell. Wraps any single control. */
export function Field({ label, hint, error, required, htmlFor, className, children }) {
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="flex items-center gap-1 text-[12.5px] font-medium text-ink-soft"
        >
          {label}
          {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[11.5px] leading-4 text-danger">{error}</p>
      ) : (
        hint && <p className="text-[11.5px] leading-4 text-muted">{hint}</p>
      )}
    </div>
  )
}

const inputClass = 'field'

export const Input = forwardRef(function Input(
  { className, invalid = false, icon: Icon, ...rest },
  ref,
) {
  if (Icon) {
    return (
      <div className="relative">
        <Icon
          size={14}
          strokeWidth={1.9}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
        />
        <input
          ref={ref}
          className={cx(inputClass, 'pl-8', invalid && 'border-danger-line', className)}
          {...rest}
        />
      </div>
    )
  }

  return <input ref={ref} className={cx(inputClass, invalid && 'border-danger-line', className)} {...rest} />
})

export const Textarea = forwardRef(function Textarea(
  { className, rows = 4, invalid = false, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(inputClass, 'resize-y leading-6', invalid && 'border-danger-line', className)}
      {...rest}
    />
  )
})

/**
 * Native select styled to match the input system — keeps keyboard, mobile and
 * accessibility behaviour for free.
 * @param {{ options?: Array<{ value: string, label: string, disabled?: boolean }>, placeholder?: string }} props
 */
export const Select = forwardRef(function Select(
  { className, options = [], placeholder, children, invalid = false, ...rest },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        className={cx(
          inputClass,
          'cursor-pointer appearance-none pr-8',
          invalid && 'border-danger-line',
          className,
        )}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      <ChevronDown
        size={14}
        strokeWidth={1.9}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-faint"
      />
    </div>
  )
})

export function SearchInput({ value, onChange, placeholder = 'Search…', className, autoFocus }) {
  const id = useId()
  const { t } = useTranslation()

  return (
    <div className={cx('relative', className)}>
      <Search
        size={14}
        strokeWidth={1.9}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-faint"
      />
      <input
        id={id}
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder === 'Search…' ? t('common.search') : placeholder}
        className={cx(inputClass, 'pl-8 pr-16 [&::-webkit-search-cancel-button]:hidden')}
      />
      <span className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 text-[10.5px] font-medium text-faint sm:block">
        {value ? `${value.length}` : ''}
      </span>
    </div>
  )
}

/** Inline toggle used by the duty roster and permission matrices. */
export function Checkbox({ checked, onChange, label, disabled, className, description }) {
  const id = useId()

  return (
    <label
      htmlFor={id}
      className={cx(
        'flex cursor-pointer select-none items-start gap-2.5',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span className="relative mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange?.(event.target.checked)}
          className="peer h-4 w-4 cursor-pointer appearance-none rounded-[4px] border border-line-strong bg-surface transition-colors checked:border-[var(--color-solid)] checked:bg-solid disabled:cursor-not-allowed"
        />
        <svg
          viewBox="0 0 16 16"
          className="pointer-events-none absolute h-3 w-3 text-on-solid opacity-0 transition-opacity peer-checked:opacity-100"
          aria-hidden="true"
        >
          <path
            d="M3.5 8.4l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-[12.5px] leading-4 text-ink-soft">{label}</span>}
          {description && (
            <span className="mt-0.5 block text-[11.5px] leading-4 text-muted">{description}</span>
          )}
        </span>
      )}
    </label>
  )
}

export default Input
