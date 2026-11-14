import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, CircleDot, Clock, Repeat } from 'lucide-react'

import { useCollection } from '../../hooks/useFirestore'
import { useAuth } from '../../hooks/useAuth'
import { useNow } from '../../hooks/useNow'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardBody, CardHeader, SectionLabel, EmptyState } from '../../components/ui/Card'
import Badge from '../../components/ui/Badge'
import { Loader } from '../../components/ui/Loader'
import { Select } from '../../components/ui/Input'
import { COLLECTIONS, ROLES, WEEKDAYS } from '../../utils/constants'
import {
  addDays,
  formatDayStamp,
  startOfWeekISO,
  toISODate,
} from '../../utils/dateHelpers'
import cx from '../../utils/cx'
import {
  DEFAULT_CLASS_NAME,
  DEFAULT_DAY_TIMES,
  SCHEDULE_CLASS_STORAGE_KEY,
  getClassSchedule,
  getScheduleClasses,
} from './defaultSchedule'

const LESSON_ROWS = Array.from({ length: 8 }, (_, index) => ({
  lessonNumber: index + 1,
}))

function LessonCell({ rows = [], subjectById, isToday, compact }) {
  const { t } = useTranslation()
  if (!rows.length) {
    return (
      <td
        className={cx(
          'border-b border-l border-line align-top',
          isToday && 'bg-accent-soft/20',
        )}
      >
        <span className={cx('flex items-center justify-center font-mono text-[12px] text-faint/50', compact ? 'h-10' : 'h-[54px]')}>
          ·
        </span>
      </td>
    )
  }

  return (
    <td
      className={cx('border-b border-l border-line align-top', compact ? 'p-1' : 'p-1.5', isToday && 'bg-accent-soft/20')}
    >
      <div className="flex flex-col gap-1">
        {rows.map((row) => {
          const subject = subjectById.get(row.subjectId)
          return (
            <div
              key={row.id}
              className={cx(
                'rounded-md border px-2 transition-colors',
                compact ? 'py-1' : 'py-1.5',
                row.isChanged ? 'border-warn-line bg-warn-soft' : 'border-line bg-surface',
              )}
            >
              <div className="flex items-center justify-between gap-1.5">
                <span className={cx('truncate font-medium text-ink', compact ? 'text-[11.5px] leading-4' : 'text-[12px] leading-5')}>
                  {row.subjectName || subject?.name || t('common.unassigned')}
                </span>
                {row.subgroup && <Badge tone="outline" mono className="h-[18px] px-1 text-[9px]">{t('schedule.subgroupShort', { number: row.subgroup })}</Badge>}
                {row.isChanged && <Repeat size={11} strokeWidth={2.1} className="shrink-0 text-warn" />}
              </div>

              <div className="mt-1 flex items-center gap-1.5">
                {row.room && (
                  <span className="rounded border border-line bg-sunken px-1 font-mono tnum text-[10.5px] leading-4 text-ink-soft">
                    {row.room}
                  </span>
                )}
                {(row.replacementTeacher || row.teacherName || subject?.teacherName) && (
                  <span className="truncate text-[10.5px] leading-4 text-faint">
                    {row.replacementTeacher || row.teacherName || subject?.teacherName}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </td>
  )
}

export default function SchedulePage() {
  const { t } = useTranslation()
  const now = useNow(30000)
  const { profile } = useAuth()
  const [selectedClass, setSelectedClass] = useState(
    () => profile?.className || window.localStorage.getItem(SCHEDULE_CLASS_STORAGE_KEY) || DEFAULT_CLASS_NAME,
  )
  const [mobileDay, setMobileDay] = useState(() => {
    const day = now.getDay()
    return day === 0 ? 1 : day
  })

  const { data: schedule, loading } = useCollection(COLLECTIONS.SCHEDULE)
  const { data: subjects } = useCollection(COLLECTIONS.SUBJECTS)

  const classes = useMemo(() => getScheduleClasses(schedule), [schedule])
  const mayViewAllClasses = profile?.role === ROLES.ADMIN || profile?.role === ROLES.TEACHER
  const availableClasses = mayViewAllClasses || !profile?.className
    ? classes
    : classes.filter((className) => className === profile.className)
  const activeClass = availableClasses.includes(selectedClass)
    ? selectedClass
    : availableClasses[0] ?? profile?.className ?? DEFAULT_CLASS_NAME
  const activeSubgroup = mayViewAllClasses ? '' : profile?.subgroup
  const classSchedule = useMemo(
    () => getClassSchedule(schedule, activeClass).filter(
      (row) => !row.subgroup || !activeSubgroup || row.subgroup === activeSubgroup,
    ),
    [schedule, activeClass, activeSubgroup],
  )
  const compact = Boolean(profile?.preferences?.compactSchedule)

  useEffect(() => {
    window.localStorage.setItem(SCHEDULE_CLASS_STORAGE_KEY, activeClass)
  }, [activeClass])

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const grid = useMemo(() => {
    const map = new Map()
    classSchedule.forEach((row) => {
      const key = `${row.dayOfWeek}-${row.lessonNumber}`
      const rows = map.get(key) ?? []
      rows.push(row)
      map.set(key, rows)
    })
    return map
  }, [classSchedule])

  const monday = startOfWeekISO(now)
  const days = useMemo(
    () =>
      WEEKDAYS.map((day) => {
        const date = addDays(monday, day.value - 1)
        return {
          ...day,
          stamp: formatDayStamp(date),
          dayTimes: activeClass === DEFAULT_CLASS_NAME ? DEFAULT_DAY_TIMES[day.value] : null,
          isToday: toISODate(date) === toISODate(now),
        }
      }),
    [activeClass, monday, now],
  )

  const todayWeekday = now.getDay() === 0 ? 7 : now.getDay()

  const todayLessons = useMemo(
    () =>
      classSchedule
        .filter((row) => row.dayOfWeek === todayWeekday)
        .sort((a, b) => a.lessonNumber - b.lessonNumber),
    [classSchedule, todayWeekday],
  )
  const todayLessonCount = new Set(todayLessons.map((row) => row.lessonNumber)).size

  const substitutions = useMemo(
    () =>
      classSchedule
        .filter((row) => row.isChanged)
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.lessonNumber - b.lessonNumber),
    [classSchedule],
  )

  return (
    <>
      <PageHeader
        eyebrow={t('schedule.weekRange', {
          start: toISODate(monday),
          end: toISODate(addDays(monday, 5)),
        })}
        icon={CalendarDays}
        title={t('schedule.title')}
        description={t('schedule.description')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="schedule-class-select">
              {t('schedule.class')}
            </label>
            {availableClasses.length > 1 && (
              <Select
                id="schedule-class-select"
                value={activeClass}
                onChange={(event) => setSelectedClass(event.target.value)}
                options={availableClasses.map((className) => ({ value: className, label: className }))}
                className="h-8 w-[104px] py-0 text-[12px]"
              />
            )}
            <Badge tone="warn" icon={Repeat} mono>
              {t('schedule.substitutions', { count: substitutions.length })}
            </Badge>
            <Badge tone="accent" icon={CircleDot} mono>
              {t('schedule.live')}
            </Badge>
          </div>
        }
      />

      {loading ? (
        <Card>
          <Loader label={t('schedule.loading', { defaultValue: t('schedule.title') })} />
        </Card>
      ) : (
        <>
          {/* Desktop grid */}
          <Card className="hidden overflow-hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 z-10 w-[96px] border-b border-line bg-surface px-3 py-2.5 text-left">
                      <SectionLabel>{t('schedule.lesson')}</SectionLabel>
                    </th>
                    {days.map((day) => (
                      <th
                        key={day.value}
                        className={cx(
                          'border-b border-l border-line px-3 py-2.5 text-left',
                          day.isToday && 'bg-accent-soft/40',
                        )}
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="text-[12.5px] font-semibold text-ink">
                            {t(`weekdays.${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][day.value - 1]}.short`)}
                          </span>
                          <span className="font-mono tnum text-[10.5px] text-faint">{day.stamp}</span>
                          {day.dayTimes && (
                            <span className="font-mono tnum text-[10px] text-faint">
                              {day.dayTimes.start}–{day.dayTimes.end}
                            </span>
                          )}
                          {day.isToday && (
                            <Badge tone="accent" mono className="ml-auto">
                              {t('schedule.today')}
                            </Badge>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {LESSON_ROWS.map((slot) => {
                    return (
                      <tr key={slot.lessonNumber}>
                        <th
                          className={cx(
                            'sticky left-0 z-10 border-b border-line bg-surface px-3 py-2 text-left align-top',
                          )}
                        >
                          <span className="font-mono tnum text-[13.5px] font-semibold text-ink">
                            {slot.lessonNumber}
                          </span>
                        </th>

                        {days.map((day) => (
                          <LessonCell
                            key={day.value}
                            rows={grid.get(`${day.value}-${slot.lessonNumber}`)}
                            subjectById={subjectById}
                            isToday={day.isToday}
                            compact={compact}
                          />
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile agenda */}
          <div className="md:hidden">
            <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
              {days.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  onClick={() => setMobileDay(day.value)}
                  className={cx(
                    'flex h-9 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] font-medium transition-colors',
                    mobileDay === day.value
                      ? 'border-solid bg-solid text-on-solid'
                      : 'border-line bg-surface text-muted',
                  )}
                >
                  {t(`weekdays.${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][day.value - 1]}.short`)}
                  <span
                    className={cx(
                      'font-mono tnum text-[10.5px]',
                      mobileDay === day.value ? 'text-on-solid/60' : 'text-faint',
                    )}
                  >
                    {day.stamp}
                  </span>
                </button>
              ))}
            </div>

            <Card className="divide-y divide-line">
              {LESSON_ROWS.map((slot) => {
                const rows = grid.get(`${mobileDay}-${slot.lessonNumber}`) ?? []

                return (
                  <div
                    key={slot.lessonNumber}
                    className={cx('flex items-start gap-3 px-4', compact ? 'py-2' : 'py-3')}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-line bg-sunken font-mono tnum text-[11px] font-medium text-muted">
                      {slot.lessonNumber}
                    </span>

                    {rows.length ? (
                      <div className="min-w-0 flex-1">
                        {rows.map((row) => {
                          const subject = subjectById.get(row.subjectId)
                          return (
                            <div key={row.id} className="mb-1 last:mb-0">
                              <div className="flex items-center gap-2">
                                <span className="truncate text-[13px] font-medium text-ink">
                                  {row.subjectName || subject?.name || t('common.unassigned')}
                                </span>
                                {row.isChanged && <Badge tone="warn" mono>{t('schedule.subShort')}</Badge>}
                                {row.subgroup && <Badge tone="outline" mono>{t('schedule.subgroupShort', { number: row.subgroup })}</Badge>}
                              </div>
                              <p className="mt-0.5 text-[11.5px] text-muted">
                                {row.room && <span className="font-mono tnum">{row.room}</span>}
                                {(row.room && (row.replacementTeacher || row.teacherName || subject?.teacherName)) ? ' · ' : ''}
                                {row.replacementTeacher || row.teacherName || subject?.teacherName}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <span className="flex-1 py-1 text-[12px] text-faint">{t('schedule.freePeriod')}</span>
                    )}
                  </div>
                )
              })}
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader icon={Clock} title={t('schedule.dayTimes')} description={t('schedule.dayTimesDesc')} />
              <CardBody className="flex flex-wrap items-center gap-3">
                <p className="font-mono tnum text-[20px] font-semibold text-ink">
                  {activeClass === DEFAULT_CLASS_NAME && DEFAULT_DAY_TIMES[todayWeekday]
                    ? `${DEFAULT_DAY_TIMES[todayWeekday].start} – ${DEFAULT_DAY_TIMES[todayWeekday].end}`
                    : t('schedule.noDayTimes')}
                </p>
                <Badge tone="accent" mono>
                  {t('schedule.lessonCount', { count: todayLessonCount })}
                </Badge>
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                icon={Repeat}
                title={t('schedule.substitutionsTitle')}
                description={t('schedule.substitutionsDesc')}
              />
              {substitutions.length === 0 ? (
                <CardBody>
                  <EmptyState
                    icon={Repeat}
                    title={t('schedule.noSubstitutions')}
                    description={t('schedule.noSubstitutionsDesc')}
                  />
                </CardBody>
              ) : (
                <ul className="divide-y divide-line">
                  {substitutions.map((row) => {
                    const day = WEEKDAYS.find((d) => d.value === row.dayOfWeek)
                    const subject = subjectById.get(row.subjectId)

                    return (
                      <li key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                        <span className="w-[92px] shrink-0 font-mono tnum text-[11px] uppercase tracking-tight text-faint">
                          {day && t(`weekdays.${['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][day.value - 1]}.short`)} · {t('schedule.lesson')} {row.lessonNumber}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">
                          {row.subjectName || subject?.name || t('common.unassigned')}
                        </span>
                        <span className="shrink-0 rounded border border-line bg-sunken px-1 font-mono tnum text-[10.5px] leading-4 text-ink-soft">
                          {row.room}
                        </span>
                        <span className="hidden shrink-0 text-[11.5px] text-muted sm:inline">
                          {row.replacementTeacher}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  )
}
