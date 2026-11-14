import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CircleCheck, ClipboardCheck, Clock, Inbox, Lock, Undo2, Users } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { useNow } from '../../hooks/useNow'
import { useToast } from '../../hooks/useToast'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardBody, CardHeader, EmptyState, SectionLabel } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Loader } from '../../components/ui/Loader'
import { COLLECTIONS, DUTY_SLOTS, WEEKDAYS } from '../../utils/constants'
import { formatDate, formatRelative, isoWeekday, toISODate } from '../../utils/dateHelpers'
import { initials } from '../../utils/format'
import cx from '../../utils/cx'

/* ------------------------------------------------------------------ */

function Stat({ icon: Icon, label, value, detail }) {
  return (
    <div className="surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-sunken text-muted">
          <Icon size={13} strokeWidth={1.9} />
        </span>
        <span className="font-mono tnum text-[10px] uppercase tracking-[0.11em] text-faint">{label}</span>
      </div>
      <p className="mt-2.5 font-mono tnum text-[20px] font-semibold leading-6 tracking-[-0.02em] text-ink">
        {value}
      </p>
      {detail && <p className="mt-0.5 truncate text-[11.5px] text-faint">{detail}</p>}
    </div>
  )
}

function DutyRow({ row, isToday, userById, canCheck, busy, onToggle, selfUid }) {
  const { t } = useTranslation()
  const weekday = WEEKDAYS.find((day) => day.value === isoWeekday(row.date))
  const weekdayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'][isoWeekday(row.date) - 1]

  return (
    <li className={cx('flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3', isToday && 'bg-accent-soft/40')}>
      <div className="w-[112px] shrink-0">
        <p className="font-mono tnum text-[12.5px] font-medium leading-5 text-ink">
          {formatDate(row.date, { withYear: false })}
        </p>
        <p className="font-mono tnum text-[10px] uppercase tracking-[0.1em] text-faint">
          {t(`weekdays.${weekdayKey}.short`, { defaultValue: weekday?.short ?? '—' })}
          {isToday && ` · ${t('common.today').toLowerCase()}`}
        </p>
      </div>

      <div className="flex min-w-[180px] flex-1 flex-wrap items-center gap-1.5">
        {row.cleanerUids.map((uid) => {
          const user = userById.get(uid)
          return (
            <span
              key={uid}
              className={cx(
                'inline-flex items-center gap-1.5 rounded-md border px-1.5 py-1',
                uid === selfUid ? 'border-accent-line bg-accent-soft' : 'border-line bg-surface',
              )}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full border border-line bg-sunken font-mono text-[9px] font-semibold text-ink-soft">
                {initials(user?.displayName)}
              </span>
              <span className="text-[12px] text-ink-soft">{user?.displayName ?? t('common.unassigned')}</span>
            </span>
          )
        })}
      </div>

      <span className="hidden shrink-0 font-mono tnum text-[10.5px] text-faint lg:inline">
        {DUTY_SLOTS[0].window} · {DUTY_SLOTS[1].window}
      </span>

      <Badge tone={row.isCompleted ? 'success' : 'warn'} dot className="shrink-0">
        {row.isCompleted ? t('duty.signedOff') : t('duty.pending')}
      </Badge>

      {canCheck ? (
        <Button
          size="sm"
          variant={row.isCompleted ? 'ghost' : 'secondary'}
          icon={row.isCompleted ? Undo2 : CircleCheck}
          loading={busy}
          onClick={() => onToggle(row)}
          className="shrink-0"
        >
          {row.isCompleted ? t('duty.reverse') : t('duty.signOff')}
        </Button>
      ) : (
        <span
          className="flex shrink-0 items-center gap-1 text-[11px] text-faint"
          title={t('duty.permissionHint')}
        >
          <Lock size={12} />
          {t('duty.readOnly')}
        </span>
      )}
    </li>
  )
}

/* ------------------------------------------------------------------ */

export default function DutyPage() {
  const { t } = useTranslation()
  const now = useNow(60000)
  const { profile, can } = useAuth()
  const toast = useToast()
  const { updateDutyRoster } = useFirestore()

  const { data: roster, loading } = useCollection(COLLECTIONS.DUTY_ROSTER)
  const { data: users } = useCollection(COLLECTIONS.MEMBERS)

  const [busyId, setBusyId] = useState(null)

  const canCheck = can('duty:check')

  const userById = useMemo(() => new Map(users.map((user) => [user.uid, user])), [users])

  const today = toISODate(now)

  const ordered = useMemo(
    () => [...roster].sort((a, b) => (a.date > b.date ? 1 : -1)),
    [roster],
  )

  const todayRow = ordered.find((row) => row.date === today) ?? null
  const upcoming = ordered.filter((row) => row.date > today)
  const past = ordered.filter((row) => row.date < today).reverse()

  const pending = roster.filter((row) => !row.isCompleted).length
  const completed = roster.filter((row) => row.isCompleted).length
  const myUpcoming = ordered.find((row) => row.date >= today && row.cleanerUids.includes(profile?.uid)) ?? null

  const toggle = async (row) => {
    if (!canCheck || busyId) return
    setBusyId(row.id)

    const nextCompleted = !row.isCompleted

    try {
      await updateDutyRoster(row.id, nextCompleted, profile?.uid ?? '')

      toast.success(
        nextCompleted ? t('duty.shiftCompleted') : t('duty.completionReversed'),
        formatDate(row.date, { withWeekday: true }),
      )
    } catch (cause) {
      toast.error(t('duty.updateFailed'), cause?.message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('duty.eyebrow')}
        icon={ClipboardCheck}
        title={t('duty.title')}
        description={t('duty.description')}
        actions={
          <Badge tone={canCheck ? 'accent' : 'outline'} mono icon={canCheck ? CircleCheck : Lock}>
            {canCheck ? t('duty.signOffEnabled') : t('duty.readOnly')}
          </Badge>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={ClipboardCheck}
          label={t('duty.today')}
          value={todayRow ? (todayRow.isCompleted ? t('duty.signedOff') : t('duty.pending')) : t('duty.noDuty')}
          detail={todayRow ? t('duty.cleanersOnRotation', { count: todayRow.cleanerUids.length }) : t('duty.noSchoolSunday')}
        />
        <Stat icon={Clock} label={t('duty.pendingSignoffs')} value={pending} detail={t('duty.alreadyCompleted', { count: completed })} />
        <Stat
          icon={Users}
          label={t('duty.yourRotation')}
          value={myUpcoming ? formatRelative(myUpcoming.date, now, t) : '—'}
          detail={myUpcoming ? formatDate(myUpcoming.date, { withWeekday: true }) : t('duty.notAssigned')}
        />
        <Stat icon={CircleCheck} label={t('duty.dutyPoints')} value={profile?.dutyCount ?? 0} detail={t('duty.creditFromSignoffs')} />
      </div>

      {loading ? (
        <Card className="mt-4">
          <Loader label={t('duty.loading')} />
        </Card>
      ) : ordered.length === 0 ? (
        <Card className="mt-4">
          <CardBody>
            <EmptyState
              icon={Inbox}
              title={t('duty.emptyTitle')}
              description={t('duty.emptyDescription')}
            />
          </CardBody>
        </Card>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          {todayRow && (
            <Card className="border-accent-line">
              <CardHeader
                icon={ClipboardCheck}
                title={t('duty.todaysShift')}
                description={formatDate(todayRow.date, { withWeekday: true })}
                actions={
                  <Badge tone={todayRow.isCompleted ? 'success' : 'warn'} dot>
                    {todayRow.isCompleted ? t('duty.signedOff') : t('duty.awaiting')}
                  </Badge>
                }
              />
              <ul>
                <DutyRow
                  row={todayRow}
                  isToday
                  userById={userById}
                  canCheck={canCheck}
                  busy={busyId === todayRow.id}
                  onToggle={toggle}
                  selfUid={profile?.uid}
                />
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader
              icon={Clock}
              title={t('duty.upcoming')}
              description={t('duty.scheduledAhead', { count: upcoming.length })}
            />
            {upcoming.length === 0 ? (
              <CardBody>
                <p className="text-[12.5px] text-muted">{t('duty.nothingFurther')}</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {upcoming.map((row) => (
                  <DutyRow
                    key={row.id}
                    row={row}
                    userById={userById}
                    canCheck={canCheck}
                    busy={busyId === row.id}
                    onToggle={toggle}
                    selfUid={profile?.uid}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader
              icon={CircleCheck}
              title={t('duty.history')}
              description={t('duty.historyCount', { count: past.length })}
            />
            {past.length === 0 ? (
              <CardBody>
                <p className="text-[12.5px] text-muted">{t('duty.noHistory')}</p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line">
                {past.map((row) => (
                  <DutyRow
                    key={row.id}
                    row={row}
                    userById={userById}
                    canCheck={canCheck}
                    busy={busyId === row.id}
                    onToggle={toggle}
                    selfUid={profile?.uid}
                  />
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardBody className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div>
                <SectionLabel>{t('duty.shiftWindows')}</SectionLabel>
                <div className="mt-1.5 flex flex-wrap gap-4">
                  {DUTY_SLOTS.map((slot) => (
                    <span key={slot.id} className="text-[12px] text-ink-soft">
                      {t(`duty.slot${slot.id === 'morning' ? 'Morning' : 'Evening'}`)}{' '}
                      <span className="font-mono tnum text-[11px] text-faint">{slot.window}</span>
                    </span>
                  ))}
                </div>
              </div>
              <span className="hidden h-8 w-px bg-line sm:block" />
              <p className="max-w-md text-[11.5px] leading-5 text-muted">
                {t('duty.completionNote')}
              </p>
            </CardBody>
          </Card>
        </div>
      )}
    </>
  )
}
