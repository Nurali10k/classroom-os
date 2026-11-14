import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Bell,
  CalendarDays,
  Check,
  CircleCheck,
  LockKeyhole,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  UserCircle,
  Users,
} from 'lucide-react'

import { COLLECTIONS, DEFAULT_PROFILE_PREFERENCES, LANGUAGES, STUDENT_STATUSES, THEMES } from '../../utils/constants'
import { useAuth } from '../../hooks/useAuth'
import { useCollection } from '../../hooks/useFirestore'
import { useTheme } from '../../hooks/useTheme'
import { useToast } from '../../hooks/useToast'
import { setLanguage } from '../../i18n/config'
import { formatDate, toDate, toISODate } from '../../utils/dateHelpers'
import { initials } from '../../utils/format'
import { RoleBadge } from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import Card, { CardBody, CardHeader, DataRow, EmptyState } from '../../components/ui/Card'
import { Checkbox, Field, Input, Select } from '../../components/ui/Input'
import PageHeader from '../../components/shared/PageHeader'

function getTimestamp(value) {
  const date = toDate(value)
  return date ? date.getTime() : 0
}

function StatTile({ label, value, detail, icon: Icon }) {
  return (
    <Card padded className="min-w-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.09em] text-faint">{label}</p>
          <p className="mt-1.5 font-mono tnum text-[22px] font-semibold leading-7 text-ink">{value}</p>
          <p className="mt-1 text-[11.5px] text-muted">{detail}</p>
        </div>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-sunken text-muted">
          <Icon size={14} />
        </span>
      </div>
    </Card>
  )
}

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const {
    profile,
    isDemoMode,
    signOut,
    updateProfile,
    changePassword,
  } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast = useToast()

  const [telegramHandle, setTelegramHandle] = useState(() => profile?.telegramHandle ?? '')
  const [displayName, setDisplayName] = useState(() => profile?.displayName ?? '')
  const [status, setStatus] = useState(() => profile?.status ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [changingPassword, setChangingPassword] = useState(false)
  const [savingPreference, setSavingPreference] = useState('')

  const { data: homework, error: homeworkError } = useCollection(COLLECTIONS.HOMEWORK)
  const { data: progress, error: progressError } = useCollection(
    COLLECTIONS.HOMEWORK_PROGRESS,
    { filters: [{ field: 'uid', value: profile?.uid }] },
    { enabled: Boolean(profile?.uid) },
  )
  const { data: roster, error: rosterError } = useCollection(COLLECTIONS.DUTY_ROSTER)
  const { data: members, error: membersError } = useCollection(
    COLLECTIONS.CLASS_PROFILES,
    { filters: [{ field: 'className', value: profile?.className }] },
    { enabled: Boolean(profile?.className) },
  )

  const preferences = { ...DEFAULT_PROFILE_PREFERENCES, ...profile?.preferences }
  const profileUid = profile?.uid
  const profileClassName = profile?.className
  const completedHomework = useMemo(() => {
    const activeIds = new Set(homework.map((entry) => entry.id))
    return new Set(
      progress
        .filter((entry) => entry.completed && activeIds.has(entry.homeworkId))
        .map((entry) => entry.homeworkId),
    ).size
  }, [homework, progress])
  const completionPercent = homework.length
    ? Math.round((completedHomework / homework.length) * 100)
    : 0

  const myDuties = useMemo(
    () => roster
      .filter((entry) => entry.cleanerUids?.includes(profile?.uid))
      .sort((a, b) => getTimestamp(b.date) - getTimestamp(a.date)),
    [roster, profile?.uid],
  )
  const today = toISODate(new Date())
  const lastDuty = myDuties.find((entry) => entry.date < today && entry.isCompleted) ?? null
  const nextDuty = [...myDuties].reverse().find((entry) => entry.date >= today) ?? null
  const completedDutyCount = myDuties.filter((entry) => entry.date < today && entry.isCompleted).length

  const classmates = useMemo(
    () => members
      .filter((member) =>
        member.uid !== profileUid
        && member.isActive !== false
        && profileClassName
        && member.className === profileClassName,
      )
      .sort((a, b) => (a.displayName ?? '').localeCompare(b.displayName ?? '')),
    [members, profileClassName, profileUid],
  )

  const savePersonalInfo = async (event) => {
    event.preventDefault()
    setSavingProfile(true)
    setProfileError('')
    try {
      await updateProfile({ displayName, telegramHandle, status })
      toast.success(t('profile.saved'), t('profile.savedDescription'))
    } catch (cause) {
      setProfileError(cause?.message ?? t('profile.saveFailed'))
    } finally {
      setSavingProfile(false)
    }
  }

  const savePreference = async (key, value) => {
    setSavingPreference(key)
    try {
      await updateProfile({
        preferences: { ...preferences, [key]: value },
      })
    } catch (cause) {
      toast.error(t('profile.preferenceSaveFailed'), cause?.message)
    } finally {
      setSavingPreference('')
    }
  }

  const changeLanguage = (language) => {
    setLanguage(language)
    void savePreference('language', language)
  }

  const changeTheme = (nextTheme) => {
    setTheme(nextTheme)
    void savePreference('theme', nextTheme)
  }

  const enableBrowserNotifications = async (enabled) => {
    if (!enabled) {
      await savePreference('browserNotifications', false)
      return
    }
    if (!('Notification' in window)) {
      toast.error(t('profile.notificationsUnavailable'))
      return
    }

    let permission
    try {
      permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission
    } catch (cause) {
      toast.error(t('profile.notificationsPermissionDenied'), cause?.message)
      return
    }
    if (permission !== 'granted') {
      toast.warning(t('profile.notificationsPermissionDenied'))
      return
    }
    await savePreference('browserNotifications', true)
  }

  const submitPassword = async (event) => {
    event.preventDefault()
    setPasswordError('')
    if (nextPassword.length < 8) {
      setPasswordError(t('profile.passwordTooShort'))
      return
    }

    if (nextPassword !== confirmPassword) {
      setPasswordError(t('profile.passwordMismatch'))
      return
    }

    setChangingPassword(true)
    try {
      await changePassword(currentPassword, nextPassword)
      setCurrentPassword('')
      setNextPassword('')
      setConfirmPassword('')
      toast.success(t('profile.passwordChanged'))
    } catch (cause) {
      setPasswordError(cause?.message ?? t('profile.passwordChangeFailed'))
    } finally {
      setChangingPassword(false)
    }
  }

  const signOutCurrentDevice = async () => {
    try {
      await signOut()
    } catch (cause) {
      toast.error(t('profile.signOutFailed'), cause?.message)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('profile.eyebrow')}
        icon={UserCircle}
        title={t('profile.title')}
        description={t('profile.pageDescription')}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          icon={CircleCheck}
          label={t('profile.homeworkProgress')}
          value={`${completedHomework}/${homework.length}`}
          detail={t('profile.completedPercent', { percent: completionPercent })}
        />
        <StatTile
          icon={CalendarDays}
          label={t('profile.dutyCount')}
          value={myDuties.length}
          detail={t('profile.completedDuties', { count: completedDutyCount })}
        />
        <StatTile
          icon={Check}
          label={t('profile.lastDuty')}
          value={lastDuty ? formatDate(lastDuty.date) : '—'}
          detail={lastDuty ? t('profile.dutyCompleted') : t('profile.noCompletedDuty')}
        />
        <StatTile
          icon={Users}
          label={t('profile.nextDuty')}
          value={nextDuty ? formatDate(nextDuty.date) : '—'}
          detail={nextDuty ? t('profile.nextDutyDescription') : t('profile.noUpcomingDuty')}
        />
      </div>

      {(homeworkError || progressError || rosterError || membersError) && (
        <p role="alert" className="mt-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {t('profile.dataLoadFailed')}
        </p>
      )}

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader icon={UserCircle} title={t('profile.account')} description={t('profile.accountDescription')} />
            <CardBody>
              <div className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-line bg-sunken font-mono text-sm font-semibold text-ink-soft">
                  {initials(profile?.displayName)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-ink">{profile?.displayName}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{profile?.email}</p>
                </div>
                <RoleBadge role={profile?.role} />
              </div>
              <div className="mt-2 divide-y divide-line">
                <DataRow label={t('profile.class')} value={profile?.className || t('profile.notAssigned')} />
                <DataRow
                  label={t('profile.subgroup')}
                  value={profile?.subgroup ? t('profile.subgroupNumber', { number: profile.subgroup }) : t('profile.notAssigned')}
                />
                <DataRow
                  label={t('profile.joined')}
                  value={profile?.createdAt ? formatDate(profile.createdAt, { withYear: true }) : '—'}
                />
              </div>
              <p className="mt-3 text-[11.5px] leading-5 text-muted">{t('profile.classAssignmentNote')}</p>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Users} title={t('profile.classmates')} description={t('profile.classmatesDescription')} />
            {profile?.className ? (
              <div className="divide-y divide-line">
                {classmates.length ? classmates.map((member) => (
                  <div key={member.uid} className="flex items-center gap-3 px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-sunken font-mono text-[10px] font-semibold text-ink-soft">
                      {initials(member.displayName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-ink">{member.displayName}</p>
                      <p className="mt-0.5 truncate text-[11px] text-muted">
                        {member.status ? t(`profile.statusOptions.${member.status}`, { defaultValue: member.status }) : t('profile.noStatus')}
                      </p>
                    </div>
                    {member.telegramHandle && (
                      <a
                        href={`https://t.me/${encodeURIComponent(member.telegramHandle.replace(/^@/, ''))}`}
                        target="_blank"
                        rel="noreferrer"
                        className="shrink-0 rounded-md border border-line px-2 py-1 text-[11px] text-ink-soft transition-colors hover:bg-sunken"
                      >
                        @{member.telegramHandle.replace(/^@/, '')}
                      </a>
                    )}
                  </div>
                )) : (
                  <CardBody>
                    <EmptyState icon={Users} title={t('profile.noClassmates')} description={t('profile.noClassmatesDescription')} />
                  </CardBody>
                )}
              </div>
            ) : (
              <CardBody>
                <EmptyState icon={Users} title={t('profile.classNotAssigned')} description={t('profile.classmatesUnavailable')} />
              </CardBody>
            )}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader icon={UserCircle} title={t('profile.personalDetails')} description={t('profile.personalDetailsDescription')} />
            <CardBody>
              <form onSubmit={savePersonalInfo} className="flex flex-col gap-3.5">
                <Field label={t('profile.name')} htmlFor="profile-display-name" required>
                  <Input
                    id="profile-display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    maxLength={80}
                  />
                </Field>
                <Field
                  label={t('profile.telegram')}
                  htmlFor="profile-telegram"
                  hint={t('profile.telegramHint')}
                >
                  <Input
                    id="profile-telegram"
                    value={telegramHandle}
                    onChange={(event) => setTelegramHandle(event.target.value)}
                    placeholder="username"
                    maxLength={33}
                    autoComplete="off"
                  />
                </Field>
                <Field label={t('profile.studyStatus')} htmlFor="profile-status">
                  <Select
                    id="profile-status"
                    value={status}
                    onChange={(event) => setStatus(event.target.value)}
                    options={[
                      { value: '', label: t('profile.noStatus') },
                      ...STUDENT_STATUSES.map((value) => ({
                        value,
                        label: t(`profile.statusOptions.${value}`),
                      })),
                    ]}
                  />
                </Field>
                {profileError && <p role="alert" className="text-[11.5px] leading-5 text-danger">{profileError}</p>}
                <div className="flex justify-end">
                  <Button type="submit" variant="primary" loading={savingProfile}>{t('common.save')}</Button>
                </div>
              </form>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={Sun} title={t('profile.preferences')} description={t('profile.preferencesDescription')} />
            <CardBody className="flex flex-col gap-4">
              <Field label={t('profile.language')} htmlFor="profile-language">
                <Select
                  id="profile-language"
                  value={i18n.resolvedLanguage?.split('-')[0] ?? preferences.language}
                  onChange={(event) => changeLanguage(event.target.value)}
                  options={LANGUAGES.map(({ code, label }) => ({ value: code, label }))}
                />
              </Field>
              <div>
                <p className="mb-1.5 text-[12.5px] font-medium text-ink-soft">{t('profile.theme')}</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: THEMES.LIGHT, label: t('profile.lightTheme'), icon: Sun },
                    { value: THEMES.DARK, label: t('profile.darkTheme'), icon: Moon },
                  ].map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={theme === value ? 'primary' : 'secondary'}
                      icon={Icon}
                      onClick={() => changeTheme(value)}
                      disabled={savingPreference === 'theme'}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
              <Checkbox
                checked={preferences.compactSchedule}
                onChange={(value) => void savePreference('compactSchedule', value)}
                disabled={Boolean(savingPreference)}
                label={t('profile.compactSchedule')}
                description={t('profile.compactScheduleDescription')}
              />
              <div className="border-t border-line pt-3">
                <p className="mb-3 flex items-center gap-2 text-[12.5px] font-semibold text-ink-soft">
                  <Bell size={14} /> {t('profile.notifications')}
                </p>
                <div className="flex flex-col gap-3">
                  <Checkbox
                    checked={preferences.inAppNotifications}
                    onChange={(value) => void savePreference('inAppNotifications', value)}
                    disabled={Boolean(savingPreference)}
                    label={t('profile.inAppNotifications')}
                    description={t('profile.inAppNotificationsDescription')}
                  />
                  <Checkbox
                    checked={preferences.notifyUrgentAnnouncements}
                    onChange={(value) => void savePreference('notifyUrgentAnnouncements', value)}
                    disabled={Boolean(savingPreference)}
                    label={t('profile.urgentAnnouncements')}
                  />
                  <Checkbox
                    checked={preferences.notifyScheduleChanges}
                    onChange={(value) => void savePreference('notifyScheduleChanges', value)}
                    disabled={Boolean(savingPreference)}
                    label={t('profile.scheduleChanges')}
                  />
                  <Checkbox
                    checked={preferences.notifyNewHomework}
                    onChange={(value) => void savePreference('notifyNewHomework', value)}
                    disabled={Boolean(savingPreference)}
                    label={t('profile.newHomework')}
                  />
                  <Checkbox
                    checked={preferences.browserNotifications}
                    onChange={(value) => void enableBrowserNotifications(value)}
                    disabled={Boolean(savingPreference)}
                    label={t('profile.browserNotifications')}
                    description={t('profile.browserNotificationsDescription')}
                  />
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader icon={LockKeyhole} title={t('profile.security')} description={t('profile.securityDescription')} />
            <CardBody>
              {isDemoMode ? (
                <p className="rounded-md border border-warn-line bg-warn-soft px-3 py-2.5 text-[12px] leading-5 text-warn">
                  {t('profile.passwordUnavailableDemo')}
                </p>
              ) : (
                <form onSubmit={submitPassword} className="flex flex-col gap-3">
                  <Field label={t('profile.currentPassword')} htmlFor="profile-current-password">
                    <Input
                      id="profile-current-password"
                      type="password"
                      autoComplete="current-password"
                      value={currentPassword}
                      onChange={(event) => setCurrentPassword(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t('profile.newPassword')} htmlFor="profile-new-password" hint={t('profile.passwordHint')}>
                    <Input
                      id="profile-new-password"
                      type="password"
                      autoComplete="new-password"
                      value={nextPassword}
                      onChange={(event) => setNextPassword(event.target.value)}
                      required
                    />
                  </Field>
                  <Field label={t('profile.confirmPassword')} htmlFor="profile-confirm-password">
                    <Input
                      id="profile-confirm-password"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                    />
                  </Field>
                  {passwordError && <p role="alert" className="text-[11.5px] leading-5 text-danger">{passwordError}</p>}
                  <Button type="submit" variant="secondary" icon={ShieldCheck} loading={changingPassword}>
                    {t('profile.changePassword')}
                  </Button>
                </form>
              )}
              <div className="mt-4 rounded-md border border-line bg-sunken/40 p-3">
                <p className="text-[12px] font-medium text-ink-soft">{t('profile.sessionTitle')}</p>
                <p className="mt-1 text-[11.5px] leading-5 text-muted">{t('profile.sessionDescription')}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={LogOut}
                  className="mt-2 text-danger hover:text-danger"
                  onClick={() => void signOutCurrentDevice()}
                >
                  {t('profile.signOutThisDevice')}
                </Button>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
