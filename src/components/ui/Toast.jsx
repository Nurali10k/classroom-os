import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { CircleCheck, Info, Triangle, X } from 'lucide-react'

import { useAppDispatch, useAppSelector } from '../../app/hooks'
import { dismissToast, selectToasts } from '../../features/ui/uiSlice'
import { Spinner } from './Loader'
import { Dot } from './Badge'
import cx from '../../utils/cx'

const ICONS = {
  neutral: null,
  info: Info,
  loading: null,
  success: CircleCheck,
  error: Triangle,
  warning: Triangle,
}

const ACCENT = {
  neutral: 'text-muted',
  info: 'text-accent',
  loading: 'text-muted',
  success: 'text-success',
  error: 'text-danger',
  warning: 'text-warn',
}

function ToastItem({ toast, onDismiss }) {
  const { t } = useTranslation()
  const Icon = ICONS[toast.tone] ?? ICONS.neutral

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 6, scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-auto w-[336px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-line bg-surface"
      role="status"
    >
      <div className="flex items-start gap-2.5 p-3">
        <span className={cx('mt-px flex h-4 w-4 shrink-0 items-center justify-center', ACCENT[toast.tone])}>
          {toast.tone === 'loading' ? <Spinner size={13} /> : Icon ? <Icon size={14} strokeWidth={2.1} /> : <Dot tone="neutral" />}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-medium leading-5 text-ink">{toast.title}</p>
          {toast.description && (
            <p className="mt-0.5 text-[11.5px] leading-4 text-muted">{toast.description}</p>
          )}
        </div>

        <button
          type="button"
          onClick={() => onDismiss(toast.id)}
          aria-label={t('notifications.dismiss')}
          className="-mr-1 -mt-0.5 flex h-6 w-6 items-center justify-center rounded-md text-faint transition-colors hover:bg-sunken hover:text-ink"
        >
          <X size={13} strokeWidth={2} />
        </button>
      </div>

      {toast.duration > 0 && toast.tone !== 'loading' && (
        <motion.span
          initial={{ width: '100%' }}
          animate={{ width: 0 }}
          transition={{ duration: toast.duration / 1000, ease: 'linear' }}
          className="block h-px bg-line"
        />
      )}
    </motion.div>
  )
}

/** Mounted once in the app shell. Renders the bottom-right notification stack. */
export function ToastViewport() {
  const toasts = useAppSelector(selectToasts)
  const dispatch = useAppDispatch()

  useEffect(() => {
    if (toasts.length === 0) return undefined
    const timers = toasts
      .filter((toast) => toast.duration > 0)
      .map((toast) =>
        window.setTimeout(() => dispatch(dismissToast(toast.id)), toast.duration),
      )
    return () => timers.forEach((timer) => window.clearTimeout(timer))
  }, [toasts, dispatch])

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[70] flex flex-col items-end gap-2 print:hidden">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={(id) => dispatch(dismissToast(id))} />
        ))}
      </AnimatePresence>
    </div>
  )
}

export default ToastViewport
