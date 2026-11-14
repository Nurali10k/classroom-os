import { Link, Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Lock, LogOut } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import Button from '../ui/Button'
import { PageLoader } from '../ui/Loader'
import { RoleBadge } from '../ui/Badge'
import { ROLE_META } from '../../utils/constants'

function DisabledAccount() {
  const { signOut } = useAuth()
  const { t } = useTranslation()

  return (
    <div className="grid-backdrop flex min-h-[62vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-[420px] rounded-lg border border-line bg-surface p-6 text-center">
        <h2 className="text-[15px] font-semibold text-ink">{t('access.accountDeactivated')}</h2>
        <p className="mt-1.5 text-[12.5px] leading-5 text-muted">
          {t('access.accountDeactivatedDescription')}
        </p>
        <Button className="mt-5" variant="secondary" icon={LogOut} onClick={signOut}>
          {t('workspace.signOut')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Shown when a member reaches a route their authority does not cover. We render
 * an explanation rather than silently redirecting so the boundary is obvious.
 */
export function AccessDenied({ reason, requirement }) {
  const { effectiveRole } = useAuth()
  const { t } = useTranslation()
  const meta = ROLE_META[effectiveRole]

  return (
    <div className="grid-backdrop flex min-h-[62vh] items-center justify-center px-6 py-16">
      <div className="w-full max-w-[480px] rounded-lg border border-line bg-surface p-6 text-center">
        <span className="mx-auto mb-3 flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-sunken text-ink-soft">
          <Lock size={16} strokeWidth={1.9} />
        </span>

        <h2 className="text-[15px] font-semibold text-ink">{t('access.restrictedArea')}</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-5 text-muted">
          {reason ?? t('access.defaultReason')}
        </p>

        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="text-[11.5px] text-muted">{t('access.viewingAs')}</span>
          <RoleBadge role={effectiveRole} />
          {requirement && (
            <>
              <ArrowRight size={12} className="text-faint" />
              <span className="font-mono tnum text-[11px] uppercase tracking-tight text-faint">
                {t(`access.capabilities.${requirement.replace(':', '.')}`, { defaultValue: requirement })}
              </span>
            </>
          )}
        </div>

        {meta && (
          <p className="mt-3 rounded-md border border-line bg-sunken px-3 py-2 text-[11.5px] leading-4 text-muted">
            {t(`roles.${effectiveRole}.summary`)}
          </p>
        )}

        <div className="mt-5 flex items-center justify-center gap-2">
          <Link
            to="/dashboard"
            className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-surface px-3.5 text-[13px] font-medium text-ink-soft transition-colors hover:border-line-strong hover:bg-sunken"
          >
            {t('access.backToDashboard')}
          </Link>
        </div>
      </div>
    </div>
  )
}

/**
 * Route guard.
 *
 * @param {object} props
 * @param {string} [props.capability] e.g. `'homework:write'`
 * @param {string[]} [props.roles] explicit allow-list, when capability granularity is wrong
 */
export default function ProtectedRoute({ children, capability = null, roles = null }) {
  const { ready, isAuthenticated, profile, can, effectiveRole } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()

  if (!ready) return <PageLoader />

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />
  }

  if (profile?.isActive === false) return <DisabledAccount />

  if (capability && !can(capability)) {
    return (
      <AccessDenied
        reason={t('access.elevatedAuthorityRequired')}
        requirement={capability}
      />
    )
  }

  if (roles && !roles.includes(effectiveRole)) {
    return <AccessDenied reason={t('access.specificRolesRequired')} />
  }

  return children
}

/** Inverse guard: keeps signed-in members away from the auth screens. */
export function GuestRoute({ children }) {
  const { ready, isAuthenticated } = useAuth()

  if (!ready) return <PageLoader />
  if (isAuthenticated) return <Navigate to="/dashboard" replace />

  return children
}
