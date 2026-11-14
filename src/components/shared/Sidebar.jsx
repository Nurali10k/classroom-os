import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LogOut, X } from 'lucide-react'

import { NAV_ITEMS } from '../../app/navigation'
import { useAuth } from '../../hooks/useAuth'
import { Dot, RoleBadge } from '../ui/Badge'
import { initials } from '../../utils/format'
import { APP_NAME } from '../../utils/constants'
import cx from '../../utils/cx'

function Wordmark() {
  const { t } = useTranslation()

  return (
    <div className="flex items-center gap-2.5 px-1">
      <span
        className="flex h-7 w-7 items-center justify-center rounded-md bg-solid text-on-solid"
        aria-hidden="true"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <rect
            x="0.6"
            y="0.6"
            width="12.8"
            height="12.8"
            rx="2.4"
            stroke="currentColor"
            strokeOpacity="0.5"
          />
          <rect x="3.6" y="3.6" width="6.8" height="6.8" rx="1.2" fill="currentColor" />
        </svg>
      </span>
      <div className="leading-none">
        <p className="text-[13.5px] font-semibold tracking-[-0.015em] text-ink">{APP_NAME}</p>
        <p className="mt-1 font-mono tnum text-[10px] uppercase tracking-[0.13em] text-faint">
          {t('app.className')}
        </p>
      </div>
    </div>
  )
}

export default function Sidebar({ open, onClose }) {
  const { profile, effectiveRole, can, signOut, isDemoMode } = useAuth()
  const { t } = useTranslation()

  const items = NAV_ITEMS.filter((item) => !item.capability || can(item.capability))

  const linkClass = ({ isActive }) =>
    cx(
      'group flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors duration-150',
      isActive
        ? 'bg-sunken font-medium text-ink'
        : 'font-normal text-muted hover:bg-sunken hover:text-ink',
    )

  return (
    <>
      {/* Mobile scrim */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className={cx(
          'fixed inset-0 z-40 bg-scrim transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <aside
        className={cx(
          'fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col border-r border-line bg-surface',
          'transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-line pl-3 pr-2">
          <Wordmark />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('topbar.closeNav')}
            className="flex h-7 w-7 items-center justify-center rounded-md text-faint transition-colors hover:bg-sunken hover:text-ink lg:hidden"
          >
            <X size={14} strokeWidth={2} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2.5">
          <p className="mb-1.5 px-2 font-mono tnum text-[10px] uppercase tracking-[0.13em] text-faint">
            {t('nav.section')}
          </p>

          <div className="flex flex-col gap-0.5">
            {items.map((item) => (
              <NavLink key={item.to} to={item.to} className={linkClass} onClick={onClose}>
                {({ isActive }) => (
                  <>
                    <item.icon
                      size={15}
                      strokeWidth={isActive ? 2.1 : 1.8}
                      className={cx('shrink-0', isActive ? 'text-ink' : 'text-faint group-hover:text-ink-soft')}
                    />
                    <span className="truncate">
                      {t(
                        {
                          '/dashboard': 'nav.dashboard',
                          '/homework': 'nav.homework',
                          '/schedule': 'nav.schedule',
                          '/freedom-timer': 'nav.freedomTimer',
                          '/duty': 'nav.duty',
                          '/materials': 'nav.materials',
                          '/profile': 'nav.profile',
                          '/admin': 'nav.admin',
                        }[item.to],
                        { defaultValue: item.label },
                      )}
                    </span>
                    {isActive && <span className="ml-auto h-1 w-1 shrink-0 rounded-full bg-ink" />}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        <div className="shrink-0 border-t border-line p-2.5">
          <div className="mb-2.5 flex items-center gap-2 rounded-md border border-line bg-sunken/40 px-2.5 py-2">
            <Dot tone={isDemoMode ? 'warn' : 'success'} pulse />
            <div className="min-w-0">
              <p className="truncate text-[11.5px] font-medium text-ink-soft">
                {isDemoMode ? t('workspace.demoDataset') : t('workspace.firestoreConnected')}
              </p>
              <p className="truncate font-mono tnum text-[10px] uppercase tracking-tight text-faint">
                {isDemoMode ? t('workspace.localOffline') : t('workspace.liveOffline')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <NavLink
              to="/profile"
              onClick={onClose}
              aria-label={t('profile.open')}
              title={t('profile.open')}
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1 py-1 text-left transition-colors hover:bg-sunken"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line bg-sunken font-mono text-[10.5px] font-semibold text-ink-soft">
                {initials(profile?.displayName)}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium leading-4 text-ink">
                  {profile?.displayName ?? t('workspace.unknownMember')}
                </p>
                <div className="mt-1">
                  <RoleBadge role={effectiveRole} className="h-[18px] px-1 text-[10px]" />
                </div>
              </div>
            </NavLink>

            <button
              type="button"
              onClick={signOut}
              aria-label={t('workspace.signOut')}
              title={t('workspace.signOut')}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-faint transition-colors hover:bg-sunken hover:text-danger"
            >
              <LogOut size={14} strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
