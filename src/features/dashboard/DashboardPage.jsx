import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Hourglass,
  Megaphone,
  NotebookPen,
  Pencil,
  Pin,
  Plus,
  Trash,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { useNow } from '../../hooks/useNow'
import { useToast } from '../../hooks/useToast'
import { ConfirmDialog } from '../../components/ui/Modal'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardBody, CardHeader, EmptyState } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge, { MonoBadge } from '../../components/ui/Badge'
import { Loader } from '../../components/ui/Loader'
import AnnouncementDialog from './AnnouncementDialog'
import {
  ANNOUNCEMENT_STATUS,
  ANNOUNCEMENT_STATUS_META,
  ANNOUNCEMENT_STATUS_ORDER,
  COLLECTIONS,
  ROLES,
} from '../../utils/constants'
import {
  formatCountdown,
  formatRelative,
  getStudyWeek,
  getVacationCountdown,
  greet,
  isOverdue,
  isoWeekday,
  toDate,
  toISODate,
} from '../../utils/dateHelpers'
import { initials } from '../../utils/format'
import cx from '../../utils/cx'
import {
  DEFAULT_CLASS_NAME,
  DEFAULT_DAY_TIMES,
  SCHEDULE_CLASS_STORAGE_KEY,
  getClassSchedule,
} from '../schedule/defaultSchedule'

/* ------------------------------------------------------------------ */

function StatTile({ icon: Icon, label, value, detail, to }) {
  const body = (
    <>
      <div className="flex items-center justify-between">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-sunken text-muted">
          <Icon size={13} strokeWidth={1.9} />
        </span>
        {to && <ArrowUpRight size={13} className="text-faint" />}
      </div>
      <p className="mt-3 font-mono tnum text-[20px] font-semibold leading-6 tracking-[-0.02em] text-ink">
        {value}
      </p>
      <p className="mt-0.5 truncate text-[12px] font-medium text-ink-soft">{label}</p>
      {detail && <p className="mt-0.5 truncate text-[11.5px] text-faint">{detail}</p>}
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className="surface group p-3.5 transition-colors duration-150 hover:border-line-strong"
      >
        {body}
      </Link>
    )
  }

  return <div className="surface p-3.5">{body}</div>
}

function AnnouncementCard({ item, author, canWrite, onEdit, onDelete }) {
  const { t } = useTranslation()
  const meta = ANNOUNCEMENT_STATUS_META[item.status] ?? ANNOUNCEMENT_STATUS_META.regular
  const expired = item.expiresAt && toDate(item.expiresAt) < new Date()

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="group relative border-b border-line px-4 py-3.5 last:border-b-0"
    >
      <div className="flex items-start gap-3">
        <span
          className={cx(
            'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
            item.status === ANNOUNCEMENT_STATUS.URGENT
              ? 'border-danger-line bg-danger-soft text-danger'
              : item.status === ANNOUNCEMENT_STATUS.PINNED
                ? 'border-accent-line bg-accent-soft text-accent-ink'
                : 'border-line bg-sunken text-muted',
          )}
        >
          {item.status === ANNOUNCEMENT_STATUS.PINNED ? (
            <Pin size={12.5} strokeWidth={2} />
          ) : (
            <Megaphone size={12.5} strokeWidth={2} />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[13.5px] font-semibold leading-5 text-ink">{item.title}</h3>
            <Badge tone={meta.tone} mono>
              {t(`announcements.status.${item.status}`, { defaultValue: meta.label })}
            </Badge>
            {expired && (
              <Badge tone="outline" mono>
                {t('common.expired')}
              </Badge>
            )}
          </div>

          <p className="mt-1 text-[12.5px] leading-5 text-muted">{item.content}</p>

          <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-faint">
            <span className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-line bg-surface font-mono text-[8.5px] font-semibold text-ink-soft">
                {initials(author?.displayName)}
              </span>
              {author?.displayName ?? t('announcements.classOffice')}
            </span>
            <span className="h-2.5 w-px bg-line" />
            <span>{formatRelative(item.createdAt, new Date(), t)}</span>
            {item.expiresAt && (
              <>
                <span className="h-2.5 w-px bg-line" />
                <span className="font-mono tnum">
                  {t('announcements.expires', { when: formatRelative(item.expiresAt, new Date(), t) })}
                </span>
              </>
            )}
          </div>
        </div>

        {canWrite && (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <Button size="icon-sm" variant="ghost" icon={Pencil} aria-label={t('announcements.edit')} onClick={() => onEdit(item)} />
            <Button size="icon-sm" variant="ghost" icon={Trash} aria-label={t('announcements.delete')} onClick={() => onDelete(item)} />
          </div>
        )}
      </div>
    </motion.article>
  )
}

/* ------------------------------------------------------------------ */

export default function DashboardPage() {
  const { t } = useTranslation()
  const now = useNow(1000)
  const { profile, can } = useAuth()
  const [selectedClass] = useState(
    () => profile?.className || window.localStorage.getItem(SCHEDULE_CLASS_STORAGE_KEY) || DEFAULT_CLASS_NAME,
  )
  const toast = useToast()
  const { remove } = useFirestore()

  const { data: announcements, loading: announcementsLoading } = useCollection(COLLECTIONS.ANNOUNCEMENTS)
  const { data: homework } = useCollection(COLLECTIONS.HOMEWORK)
  const { data: subjects } = useCollection(COLLECTIONS.SUBJECTS)
  const { data: schedule } = useCollection(COLLECTIONS.SCHEDULE)
  const { data: users } = useCollection(COLLECTIONS.MEMBERS)
  const { data: roster } = useCollection(COLLECTIONS.DUTY_ROSTER)

  const [dialog, setDialog] = useState({ open: false, record: null })
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const canWrite = can('announcements:write')

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const userById = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users])

  const board = useMemo(() => {
    const weight = (status) => {
      const index = ANNOUNCEMENT_STATUS_ORDER.indexOf(status)
      return index === -1 ? ANNOUNCEMENT_STATUS_ORDER.length : index
    }
    return [...announcements]
      .filter((item) => canWrite || !(item.expiresAt && toDate(item.expiresAt) < now))
      .sort((a, b) => weight(a.status) - weight(b.status) || (b.createdAt ?? '') > (a.createdAt ?? ''))
  }, [announcements, canWrite, now])

  const today = toISODate(now)
  const todayIso = isoWeekday(now)
  const canViewAllClasses = profile?.role === ROLES.ADMIN || profile?.role === ROLES.TEACHER
  const activeClass = !canViewAllClasses && profile?.className ? profile.className : selectedClass
  const activeSubgroup = canViewAllClasses ? '' : profile?.subgroup
  const classSchedule = useMemo(
    () => getClassSchedule(schedule, activeClass).filter(
      (row) => !row.subgroup || !activeSubgroup || row.subgroup === activeSubgroup,
    ),
    [schedule, activeClass, activeSubgroup],
  )
  const weekdayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][todayIso - 1]
  const weekdayLabel = t(`weekdays.${weekdayKey}.full`)

  const lessonsToday = useMemo(
    () => classSchedule.filter((row) => row.dayOfWeek === todayIso).sort((a, b) => a.lessonNumber - b.lessonNumber),
    [classSchedule, todayIso],
  )
  const todayLessonCount = new Set(lessonsToday.map((lesson) => lesson.lessonNumber)).size

  const week = getStudyWeek(now)
  const countdown = getVacationCountdown(now)
  const dayTimes = activeClass === DEFAULT_CLASS_NAME ? DEFAULT_DAY_TIMES[todayIso] : null

  const todayDuty = useMemo(() => roster.find((row) => row.date === today) ?? null, [roster, today])

  const openHomework = useMemo(
    () => homework.filter((item) => !isOverdue(item.deadlineDate, now)),
    [homework, now],
  )

  const nextDeadline = useMemo(() => {
    const sorted = [...openHomework].sort((a, b) => (a.deadlineDate > b.deadlineDate ? 1 : -1))
    return sorted[0] ?? null
  }, [openHomework])

  const isOnDuty = Boolean(todayDuty?.cleanerUids?.includes(profile?.uid))

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(COLLECTIONS.ANNOUNCEMENTS, pendingDelete.id)
      toast.success(t('announcements.removed'), pendingDelete.title)
      setPendingDelete(null)
    } catch (cause) {
      toast.error(t('announcements.deleteFailed'), cause?.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={`${t(week.parity === 'odd' ? 'topbar.oddWeekLabel' : 'topbar.evenWeekLabel')} · ${t('topbar.weekLabel', { number: week.number })} · ${weekdayLabel}`}
        icon={CalendarDays}
        title={`${greet(now, t)}, ${profile?.displayName?.split(' ')[0] ?? t('common.you')}`}
        description={t('dashboard.description')}
        actions={
          canWrite && (
            <Button variant="primary" icon={Plus} onClick={() => setDialog({ open: true, record: null })}>
              {t('announcements.new')}
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={NotebookPen}
          label={t('dashboard.openAssignments')}
          value={openHomework.length}
          detail={nextDeadline ? t('dashboard.nextDue', { when: formatRelative(nextDeadline.deadlineDate, now, t) }) : t('dashboard.nothingOutstanding')}
          to="/homework"
        />
        <StatTile
          icon={Clock}
          label={t('dashboard.todaysLessons')}
          value={todayLessonCount}
          detail={
            dayTimes
              ? `${dayTimes.start}–${dayTimes.end}`
              : t('schedule.lessonCount', { count: todayLessonCount })
          }
          to="/schedule"
        />
        <StatTile
          icon={ClipboardCheck}
          label={t('dashboard.dutyPoints')}
          value={profile?.dutyCount ?? 0}
          detail={isOnDuty ? t('dashboard.onDutyToday') : t('dashboard.rotationCredit')}
          to="/duty"
        />
        <StatTile
          icon={Hourglass}
          label={countdown.vacation ? t(`timer.vacations.${countdown.vacation.id}`) : t('dashboard.nextBreak')}
          value={countdown.vacation ? t('common.dayShort', { count: countdown.days }) : '—'}
          detail={countdown.isActive ? t('dashboard.breakRunningNow') : countdown.vacation ? t('dashboard.startsRelative', { when: formatRelative(countdown.vacation.start, now, t) }) : t('dashboard.noBreaksScheduled')}
          to="/freedom-timer"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        {/* Announcement board */}
        <Card>
          <CardHeader
            icon={Megaphone}
            title={t('announcements.title')}
            description={t('announcements.onBoard', { count: board.length })}
            actions={
              <Link
                to="/dashboard"
                className="hidden items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink sm:inline-flex"
              >
                {t('common.refresh')} <ChevronRight size={12} />
              </Link>
            }
          />

          {announcementsLoading ? (
            <Loader label={t('dashboard.announcementsTitle')} />
          ) : board.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={Megaphone}
                title={t('dashboard.boardClear')}
                description={t('dashboard.boardClearDesc')}
              />
            </CardBody>
          ) : (
            <div>
              {board.map((item) => (
                <AnnouncementCard
                  key={item.id}
                  item={item}
                  author={userById.get(item.authorUid)}
                  canWrite={canWrite}
                  onEdit={(record) => setDialog({ open: true, record })}
                  onDelete={setPendingDelete}
                />
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {/* Countdown */}
          <Card>
            <CardHeader icon={Hourglass} title={t(countdown.isActive ? 'dashboard.breakInProgress' : 'dashboard.nextBreak')} />
            <CardBody>
              {countdown.vacation ? (
                <>
                  <p className="text-[13px] font-medium text-ink">{t(`timer.vacations.${countdown.vacation.id}`)}</p>
                  <p className="mt-0.5 font-mono tnum text-[10.5px] uppercase tracking-[0.1em] text-faint">
                    {t(countdown.isActive ? 'dashboard.ends' : 'dashboard.begins')} {toISODate(countdown.target)}
                  </p>
                  <p className="mt-3 font-mono tnum text-[26px] font-semibold leading-none tracking-[-0.01em] text-ink">
                    {formatCountdown(countdown.totalMs)}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Badge tone={countdown.isActive ? 'success' : 'accent'} dot>
                      {countdown.isActive ? t('dashboard.active') : t('dashboard.daysAway', { count: countdown.days })}
                    </Badge>
                    <Link
                      to="/freedom-timer"
                      className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted transition-colors hover:text-ink"
                    >
                      {t('common.details')} <ChevronRight size={12} />
                    </Link>
                  </div>
                </>
              ) : (
                <p className="text-[12.5px] text-muted">{t('dashboard.noUpcomingBreaks')}</p>
              )}
            </CardBody>
          </Card>

          {/* Duty */}
          <Card>
            <CardHeader
              icon={ClipboardCheck}
              title={t('dashboard.dutyToday')}
              actions={
                <Link to="/duty" className="text-[12px] text-muted transition-colors hover:text-ink">
                  {t('dashboard.roster')}
                </Link>
              }
            />
            <CardBody>
              {todayDuty ? (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    {todayDuty.cleanerUids.map((uid) => (
                      <span
                        key={uid}
                        className={cx(
                          'inline-flex items-center gap-2 rounded-md border px-2 py-1',
                          uid === profile?.uid ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface',
                        )}
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-sunken font-mono text-[9px] font-semibold text-ink-soft">
                          {initials(userById.get(uid)?.displayName)}
                        </span>
                        <span className="text-[12px] text-ink-soft">
                          {userById.get(uid)?.displayName ?? t('common.unassigned')}
                        </span>
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-[12px] text-muted">
                      {isOnDuty ? t('duty.todayShift') : t('duty.notYourTurn')}
                    </span>
                    <Badge tone={todayDuty.isCompleted ? 'success' : 'warn'} dot>
                      {todayDuty.isCompleted ? t('common.signedOff') : t('common.pending')}
                    </Badge>
                  </div>
                </>
              ) : (
                <p className="text-[12.5px] text-muted">{t('dashboard.noDutyToday')}</p>
              )}
            </CardBody>
          </Card>

          {/* Today's lessons */}
          <Card>
            <CardHeader
              icon={Clock}
              title={t('dashboard.todaysLessons')}
              actions={
                <Link to="/schedule" className="text-[12px] text-muted transition-colors hover:text-ink">
                  {t('dashboard.fullGrid')}
                </Link>
              }
            />
            {lessonsToday.length === 0 ? (
              <CardBody>
                <p className="text-[12.5px] text-muted">{t('dashboard.noLessonsScheduled', { day: weekdayLabel })}</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {lessonsToday.map((lesson) => {
                  const subject = subjectById.get(lesson.subjectId)

                  return (
                    <li
                      key={lesson.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-sunken font-mono tnum text-[11px] font-medium text-muted"
                      >
                        {lesson.lessonNumber}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium text-ink">
                          {lesson.subjectName || subject?.name || t('common.unassigned')}
                        </p>
                        <p className="font-mono tnum text-[11px] text-faint">
                          {lesson.replacementTeacher || lesson.teacherName || subject?.teacherName || ''}
                        </p>
                      </div>

                      {lesson.subgroup && <Badge tone="outline" mono className="shrink-0">{t('schedule.subgroupShort', { number: lesson.subgroup })}</Badge>}
                      {lesson.isChanged && (
                        <Badge tone="warn" mono className="shrink-0">
                          {t('dashboard.sub')}
                        </Badge>
                      )}
                      <MonoBadge tone="outline" className="shrink-0">
                        {lesson.room}
                      </MonoBadge>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {dialog.open && (
        <AnnouncementDialog
          open
          initial={dialog.record}
          onClose={() => setDialog({ open: false, record: null })}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('announcements.deleteTitle')}
        description={pendingDelete?.title}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}
