import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'

export default function NotFoundPage() {
  const { pathname } = useLocation()
  const { t } = useTranslation()

  return (
    <div className="grid-backdrop flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="font-mono tnum text-[11px] uppercase tracking-[0.2em] text-faint">Error 404</p>
      <h1 className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        {t('errors.routeNotFound')}
      </h1>
      <p className="mt-1.5 max-w-md font-mono text-[12px] text-muted">{pathname}</p>
      <a
        href="/dashboard"
        className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-solid px-3.5 text-[13px] font-medium text-on-solid transition-colors hover:bg-solid-hover"
      >
        <ArrowLeft size={14} strokeWidth={1.9} />
        {t('access.backToDashboard')}
      </a>
    </div>
  )
}
