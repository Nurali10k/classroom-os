import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion } from 'framer-motion'
import { CalendarDays, Megaphone, ShieldCheck, Users, Wrench } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import PageHeader from '../../components/shared/PageHeader'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import { ROLE_META } from '../../utils/constants'
import UserManagement from './UserManagement'
import PostAnnouncement from './PostAnnouncement'
import HomeworkEditor from './HomeworkEditor'
import ScheduleEditor from './ScheduleEditor'
import cx from '../../utils/cx'

const PANELS = [
  {
    id: 'users',
    label: 'users',
    icon: Users,
    title: 'userManagement',
    description: 'userDescription',
    Component: UserManagement,
  },
  {
    id: 'announcements',
    label: 'announcements',
    icon: Megaphone,
    title: 'postAnnouncement',
    description: 'announcementDescription',
    Component: PostAnnouncement,
  },
  {
    id: 'curriculum',
    label: 'curriculum',
    icon: Wrench,
    title: 'infrastructure',
    description: 'infrastructureDescription',
    Component: HomeworkEditor,
  },
  {
    id: 'schedule',
    label: 'schedule',
    icon: CalendarDays,
    title: 'scheduleManagement',
    description: 'scheduleDescription',
    Component: ScheduleEditor,
  },
]

/**
 * Hidden administration console. Reached only through the admin-only
 * `admin:access` capability guard.
 */
export default function AdminPage() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const [panel, setPanel] = useState('users')

  const active = PANELS.find((entry) => entry.id === panel) ?? PANELS[0]
  const ActivePanel = active.Component

  return (
    <>
      <PageHeader
        eyebrow={t('admin.eyebrow')}
        icon={ShieldCheck}
        title={t('admin.title')}
        description={t('admin.description')}
        actions={
          <Badge tone="ink" mono icon={ShieldCheck}>
            {ROLE_META[profile?.role]?.abbr ?? 'ADM'}
          </Badge>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-1 rounded-md border border-line bg-surface p-0.5">
        {PANELS.map((entry) => {
          const Icon = entry.icon
          const isActive = entry.id === panel

          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setPanel(entry.id)}
              className={cx(
                'inline-flex h-8 items-center gap-2 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors',
                isActive ? 'bg-solid text-on-solid' : 'text-muted hover:text-ink',
              )}
            >
              <Icon size={13.5} strokeWidth={1.9} className={isActive ? 'text-on-solid/80' : 'text-faint'} />
              {t(`admin.${entry.label}`)}
            </button>
          )
        })}

        <span className="ml-auto hidden pr-2 font-mono tnum text-[10.5px] uppercase tracking-[0.1em] text-faint sm:inline">
          {t(`admin.${active.title}`)}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="mb-3 flex items-baseline gap-2">
            <h2 className="text-[14px] font-semibold tracking-[-0.01em] text-ink">{t(`admin.${active.title}`)}</h2>
            <span className="text-[12px] text-muted">— {t(`admin.${active.description}`)}</span>
          </div>

          <ActivePanel />
        </motion.div>
      </AnimatePresence>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line px-4 py-3">
        <p className="text-[11.5px] leading-5 text-faint">
          {t('admin.acceleratorHint')}
        </p>
        <Button size="sm" variant="ghost" icon={ShieldCheck} disabled>
          {t('admin.auditEnabled')}
        </Button>
      </div>
    </>
  )
}
