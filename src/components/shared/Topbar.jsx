import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Languages, Menu, Moon, Slash, Sun } from 'lucide-react'

import { findNavItem } from '../../app/navigation'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../hooks/useTheme'
import { setLanguage } from '../../i18n/config'
import Badge, { RoleBadge } from '../ui/Badge'
import { formatDate, getStudyWeek, isoWeekday } from '../../utils/dateHelpers'
import { APP_NAME, LANGUAGES } from '../../utils/constants'

/** Monospaced clock — tabular numerals keep the seconds from jumping. */
function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const pad = (value) => String(value).padStart(2, '0')

  return (
    <span className="hidden font-mono tnum text-[12px] tracking-tight text-ink-soft sm:inline">
      {pad(now.getHours())}:{pad(now.getMinutes())}:{pad(now.getSeconds())}
    </span>
  )
}

export default function Topbar({ onOpenSidebar }) {
  const { pathname } = useLocation()
  const { effectiveRole } = useAuth()
  const { t, i18n } = useTranslation()
  const { isDark, toggleTheme } = useTheme()
  const item = findNavItem(pathname)
  const navKeys = {
    '/dashboard': ['nav.dashboard', 'nav.dashboardShort'],
    '/homework': ['nav.homework', 'nav.homeworkShort'],
    '/schedule': ['nav.schedule', 'nav.scheduleShort'],
    '/freedom-timer': ['nav.freedomTimer', 'nav.freedomTimerShort'],
    '/duty': ['nav.duty', 'nav.dutyShort'],
    '/materials': ['nav.materials', 'nav.materialsShort'],
    '/profile': ['nav.profile', 'nav.profile'],
    '/admin': ['nav.admin', 'nav.adminShort'],
  }
  const [labelKey, shortKey] = navKeys[item?.to] ?? []

  const today = new Date()
  const week = getStudyWeek(today)
  const isSchoolDay = isoWeekday(today) <= 6

  return (
    <header className="sticky top-0 z-30 flex h-[52px] items-center gap-3 border-b border-line bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label={t('topbar.openNav')}
        className="-ml-1.5 flex h-8 w-8 items-center justify-center rounded-md text-muted transition-all hover:-translate-y-px hover:bg-sunken hover:text-ink lg:hidden"
      >
        <Menu size={16} strokeWidth={1.9} />
      </button>

      <nav aria-label={t('topbar.breadcrumb')} className="flex min-w-0 items-center gap-1.5">
        <span className="hidden text-[12.5px] text-faint sm:inline">{APP_NAME}</span>
        <Slash size={11} className="hidden shrink-0 -rotate-12 text-faint sm:inline" />
        <span className="truncate text-[12.5px] font-medium text-ink">
          {shortKey ? t(shortKey) : item ? t(labelKey, { defaultValue: item.label }) : t('topbar.breadcrumbFallback')}
        </span>
      </nav>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <span className="hidden text-[12.5px] text-muted md:inline">
          {formatDate(today, { withWeekday: true })}
        </span>

        <span className="hidden h-4 w-px bg-line sm:block" />

        <Badge tone={week.parity === 'even' ? 'accent' : 'neutral'} mono dot>
          {week.parity === 'even'
            ? t('topbar.evenWeek', { number: week.number })
            : t('topbar.oddWeek', { number: week.number })}
        </Badge>

        {!isSchoolDay && (
          <Badge tone="warn" mono>
            {t('topbar.noLessons')}
          </Badge>
        )}

        <LiveClock />

        <span className="hidden h-4 w-px bg-line sm:block" />

        <RoleBadge role={effectiveRole} className="hidden sm:inline-flex" />

        <label className="flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2 text-muted transition-colors hover:bg-sunken">
          <Languages size={14} aria-hidden="true" />
          <span className="sr-only">{t('language.switch')}</span>
          <select
            aria-label={t('language.switch')}
            value={i18n.resolvedLanguage ?? i18n.language}
            onChange={(event) => setLanguage(event.target.value)}
            className="max-w-[72px] cursor-pointer bg-transparent text-[11px] font-medium text-ink outline-none"
          >
            {LANGUAGES.map((language) => (
              <option key={language.code} value={language.code}>
                {language.short}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
          title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface text-muted transition-all hover:-translate-y-px hover:bg-sunken hover:text-ink"
        >
          {isDark ? <Sun size={15} /> : <Moon size={15} />}
        </button>

        <span className="font-mono tnum hidden shrink-0 text-[10.5px] uppercase tracking-[0.12em] text-faint lg:inline">
          {t('topbar.term')}
        </span>
      </div>
    </header>
  )
}
