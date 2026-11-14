import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { Triangle, X } from 'lucide-react'

import Button from './Button'
import cx from '../../utils/cx'

const SIZES = {
  sm: 'max-w-[420px]',
  md: 'max-w-[520px]',
  lg: 'max-w-[720px]',
}

function useLockScroll(active) {
  useEffect(() => {
    if (!active) return undefined
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [active])
}

/**
 * Centered dialog. Rendered through a portal above the shell, animated with
 * Framer Motion, closable with Escape or a backdrop click.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  icon: Icon,
  size = 'md',
  footer,
  children,
  closeOnBackdrop = true,
}) {
  const { t } = useTranslation()
  useLockScroll(open)

  useEffect(() => {
    if (!open) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={closeOnBackdrop ? onClose : undefined}
            className="fixed inset-0 bg-scrim"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            initial={{ opacity: 0, y: 10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className={cx(
              'relative z-[81] w-full rounded-lg border border-line bg-surface',
              SIZES[size] ?? SIZES.md,
            )}
          >
            <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
              {Icon && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-sunken text-ink-soft">
                  <Icon size={14} strokeWidth={1.9} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                {title && (
                  <h2 className="text-[14px] font-semibold leading-6 text-ink">{title}</h2>
                )}
                {description && (
                  <p className="mt-0.5 text-[12.5px] leading-5 text-muted">{description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={t('common.closeDialog')}
                className="-mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-sunken hover:text-ink"
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            <div className="px-4 py-4">{children}</div>

            {footer && (
              <div className="flex items-center justify-end gap-2 border-t border-line bg-sunken/40 px-4 py-3">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** Destructive-action confirmation built on top of `Modal`. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Are you sure?',
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loading = false,
  tone = 'danger',
}) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title === 'Are you sure?' ? t('common.areYouSure') : title}
      description={description}
      icon={Triangle}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            {cancelLabel === 'Cancel' ? t('common.cancel') : cancelLabel}
          </Button>
          <Button variant={tone === 'danger' ? 'primary' : 'accent'} loading={loading} onClick={onConfirm}>
            {confirmLabel === 'Confirm' ? t('common.confirm') : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[12.5px] leading-5 text-muted">
        {t('common.irreversibleAction')}
      </p>
    </Modal>
  )
}
