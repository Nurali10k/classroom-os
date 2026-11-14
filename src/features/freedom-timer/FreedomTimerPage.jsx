import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Coffee, Hourglass, Pause, Play, RotateCcw, Target, Timer } from 'lucide-react'

import { useToast } from '../../hooks/useToast'
import { useNow } from '../../hooks/useNow'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardBody, CardHeader, DataRow, EmptyState } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { STUDY_WEEK_ANCHOR, TIMER_PRESETS, VACATIONS } from '../../utils/constants'
import {
  addDays,
  diffInDays,
  formatDate,
  getStudyWeek,
  getVacationCountdown,
  isWithinVacation,
  isoWeekday,
  splitDuration,
  toISODate,
} from '../../utils/dateHelpers'
import cx from '../../utils/cx'

const pad2 = (value) => String(value).padStart(2, '0')

function clockLabel(ms) {
  const total = Math.max(0, Math.round(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(seconds)}` : `${pad2(minutes)}:${pad2(seconds)}`
}

function Unit({ value, label }) {
  return (
    <div className="flex min-w-[62px] flex-col items-center rounded-md border border-line bg-sunken px-3 py-2">
      <span className="font-mono tnum text-[22px] font-semibold leading-7 tracking-[-0.02em] text-ink">
        {value}
      </span>
      <span className="mt-0.5 font-mono tnum text-[9.5px] uppercase tracking-[0.14em] text-faint">
        {label}
      </span>
    </div>
  )
}

/* ----------------------------- sprint timer ---------------------------- */

function SprintTimer() {
  const { t } = useTranslation()
  const toast = useToast()
  const completeRef = useRef(() => {})

  const [preset, setPreset] = useState(TIMER_PRESETS[0])
  const [durationMs, setDurationMs] = useState(TIMER_PRESETS[0].minutes * 60_000)
  const [remainingMs, setRemainingMs] = useState(TIMER_PRESETS[0].minutes * 60_000)
  const [running, setRunning] = useState(false)
  const [sessions, setSessions] = useState(0)
  const deadlineRef = useRef(0)

  useEffect(() => {
    completeRef.current = () => {
      setSessions((count) => count + 1)
      const presetKey = preset.label === 'Focus' ? 'focus' : preset.label === 'Deep work' ? 'deepWork' : 'break'
      const label = t(`timer.presets.${presetKey}`)
      toast.success(t('timer.sprintComplete'), t('timer.sprintFinished', { label }))
    }
  }, [preset, t, toast])

  useEffect(() => {
    if (!running) return undefined
    const timer = window.setInterval(() => {
      const left = deadlineRef.current - Date.now()
      if (left <= 0) {
        setRemainingMs(0)
        setRunning(false)
        completeRef.current()
      } else {
        setRemainingMs(left)
      }
    }, 250)
    return () => window.clearInterval(timer)
  }, [running])

  const start = () => {
    deadlineRef.current = Date.now() + remainingMs
    setRunning(true)
  }

  const applyPreset = (next) => {
    setPreset(next)
    setRunning(false)
    setDurationMs(next.minutes * 60_000)
    setRemainingMs(next.minutes * 60_000)
  }

  const reset = () => {
    setRunning(false)
    setRemainingMs(durationMs)
  }

  const fraction = durationMs > 0 ? remainingMs / durationMs : 0
  const radius = 52
  const circumference = 2 * Math.PI * radius

  return (
    <Card>
      <CardHeader
        icon={Timer}
        title={t('timer.studySprint')}
        description={t('timer.sprintDescription')}
        actions={
          sessions > 0 ? (
            <Badge tone="success" mono>
              {t('timer.sessionsDone', { count: sessions })}
            </Badge>
          ) : null
        }
      />

      <CardBody className="flex flex-col items-center">
        <div className="relative h-[176px] w-[176px]">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="#e4e4e7" strokeWidth="6" />
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              stroke="#2563eb"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - fraction)}
              style={{ transition: 'stroke-dashoffset 250ms linear' }}
            />
          </svg>

          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono tnum text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">
              {clockLabel(remainingMs)}
            </span>
            <span className="mt-1.5 font-mono tnum text-[10px] uppercase tracking-[0.16em] text-faint">
              {running ? t('timer.running') : remainingMs === 0 ? t('timer.complete') : t('timer.paused')}
            </span>
          </div>
        </div>

        <div className="mt-4 flex w-full max-w-[300px] gap-1.5">
          {TIMER_PRESETS.map((entry) => (
            <button
              key={entry.label}
              type="button"
              onClick={() => applyPreset(entry)}
              className={cx(
                'flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium transition-colors',
                preset.label === entry.label
                  ? 'border-solid bg-solid text-on-solid'
                  : 'border-line bg-surface text-muted hover:text-ink',
              )}
            >
              {entry.label === 'Break' && <Coffee size={12} />}
              {t(`timer.presets.${entry.label === 'Focus' ? 'focus' : entry.label === 'Deep work' ? 'deepWork' : 'break'}`)}
              <span
                className={cx(
                  'font-mono tnum text-[10.5px]',
                  preset.label === entry.label ? 'text-on-solid/60' : 'text-faint',
                )}
              >
                {entry.minutes}′
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3.5 flex items-center gap-2">
          <Button
            variant={running ? 'secondary' : 'primary'}
            icon={running ? Pause : Play}
            onClick={running ? () => setRunning(false) : start}
            disabled={remainingMs === 0 && !running}
          >
            {running ? t('timer.pause') : remainingMs === 0 ? t('timer.finished') : t('timer.start')}
          </Button>
          <Button variant="ghost" icon={RotateCcw} onClick={reset}>
            {t('timer.reset')}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

/* --------------------------------- page -------------------------------- */

export default function FreedomTimerPage() {
  const { t } = useTranslation()
  const now = useNow(1000)
  const countdown = getVacationCountdown(now)
  const week = getStudyWeek(now)

  const parts = splitDuration(countdown.totalMs)

  const breaks = useMemo(() => {
    return VACATIONS.map((vacation) => {
      const active = isWithinVacation(vacation, now)
      const past = !active && (addDays(vacation.end, 0) < now)
      return { ...vacation, active, past }
    })
  }, [now])

  const nextMonday = addDays(now, (8 - isoWeekday(now)) % 7 || 7)

  return (
    <>
      <PageHeader
        eyebrow={t('timer.eyebrow')}
        icon={Hourglass}
        title={t('timer.title')}
        description={t('timer.description')}
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent" mono icon={Target}>
              {t(week.parity === 'odd' ? 'topbar.oddWeek' : 'topbar.evenWeek', { number: week.number })}
            </Badge>
            <Badge tone="neutral" mono>
              {t('timer.anchor', { date: STUDY_WEEK_ANCHOR })}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            icon={Hourglass}
            title={countdown.vacation ? t(`timer.vacations.${countdown.vacation.id}`) : t('timer.noBreak')}
            description={
              countdown.vacation
                ? countdown.isActive
                  ? t('timer.breakActive')
                  : t('timer.begins', { date: formatDate(countdown.vacation.start, { withWeekday: true }) })
                : t('timer.noUpcoming')
            }
          />

          <CardBody>
            {countdown.vacation ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Unit value={pad2(parts.days)} label={t('timer.days')} />
                  <Unit value={pad2(parts.hours)} label={t('timer.hours')} />
                  <Unit value={pad2(parts.minutes)} label={t('timer.minutes')} />
                  <Unit value={pad2(parts.seconds)} label={t('timer.seconds')} />
                </div>

                <div className="mt-4 grid gap-1 sm:grid-cols-2">
                  <DataRow label={t('timer.window')} value={`${countdown.vacation.start} → ${countdown.vacation.end}`} mono />
                  <DataRow label={t('timer.duration')} value={t('common.days', { count: diffInDays(countdown.vacation.start, countdown.vacation.end) + 1 })} mono />
                  <DataRow
                    label={t('timer.status')}
                    value={countdown.isActive ? t('timer.activeNow') : t('timer.daysRemaining', { count: countdown.days })}
                  />
                  <DataRow label={t('timer.countdownTo')} value={toISODate(countdown.target)} mono />
                </div>
              </>
            ) : (
              <EmptyState
                icon={Coffee}
                title={t('timer.calendarExhausted')}
                description={t('timer.calendarExhaustedDescription')}
              />
            )}
          </CardBody>
        </Card>

        <SprintTimer />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader icon={Coffee} title={t('timer.academicBreaks')} description={t('timer.academicYear')} />
          <ul className="divide-y divide-line">
            {breaks.map((vacation) => (
              <li key={vacation.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cx(
                    'h-1.5 w-1.5 shrink-0 rounded-full',
                    vacation.active ? 'bg-accent' : vacation.past ? 'bg-line-strong' : 'bg-success',
                  )}
                />
                <span
                  className={cx(
                    'min-w-0 flex-1 truncate text-[13px] font-medium',
                    vacation.past ? 'text-faint' : 'text-ink',
                  )}
                >
                  {t(`timer.vacations.${vacation.id}`)}
                </span>
                <span className="hidden font-mono tnum text-[11px] text-muted sm:inline">
                  {vacation.start} → {vacation.end}
                </span>
                <Badge tone={vacation.active ? 'accent' : vacation.past ? 'outline' : 'success'} mono className="shrink-0">
                  {vacation.active ? t('timer.now') : vacation.past ? t('timer.past') : t('timer.upcoming')}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader icon={Target} title={t('timer.studyWeek')} description={t('timer.parityDescription')} />
          <CardBody>
            <div className="flex items-baseline gap-2">
              <span className="font-mono tnum text-[30px] font-semibold leading-none tracking-[-0.02em] text-ink">
                {week.number}
              </span>
              <span className="font-mono tnum text-[11px] uppercase tracking-[0.14em] text-faint">
                {t('timer.weekNumber')}
              </span>
            </div>

            <div className="mt-4 grid gap-1">
              <DataRow label={t('timer.parity')} value={t(week.parity === 'odd' ? 'topbar.oddWeek' : 'topbar.evenWeek', { number: week.number })} />
              <DataRow label={t('timer.weekStarts')} value={week.startsOn} mono />
              <DataRow label={t('timer.nextParity')} value={toISODate(nextMonday)} mono />
              <DataRow label={t('timer.daysToFlip')} value={t('common.days', { count: diffInDays(now, nextMonday) })} mono />
            </div>

            <p className="mt-3 rounded-md border border-line bg-sunken px-3 py-2 text-[11.5px] leading-5 text-muted">
              {t('timer.weekDetails', {
                number: week.number,
                parity: t(week.parity === 'odd' ? 'timer.oddWeek' : 'timer.evenWeek'),
              })}
            </p>
          </CardBody>
        </Card>
      </div>
    </>
  )
}
