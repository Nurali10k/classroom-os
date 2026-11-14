import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  Ban,
  CircleCheck,
  Inbox,
  PenLine,
  ScrollText,
  ShieldCheck,
  UserPen,
  Users,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { recordAudit, useCollection, useFirestore } from '../../hooks/useFirestore'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/ui/Modal'
import Card, { CardBody, EmptyState, SectionLabel } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge, { RoleBadge } from '../../components/ui/Badge'
import { Field, Input, SearchInput, Select } from '../../components/ui/Input'
import { Loader } from '../../components/ui/Loader'
import { AUDIT_ACTIONS, COLLECTIONS, ROLE_META, ROLE_ORDER, ROLES } from '../../utils/constants'
import { formatRelative } from '../../utils/dateHelpers'
import { fuzzyFilter } from '../../utils/fuzzy'
import { initials } from '../../utils/format'
import { getScheduleClasses } from '../schedule/defaultSchedule'
import cx from '../../utils/cx'

/* ------------------------------- vocabulary ----------------------------- */

const STATUS_FILTERS = [
  { id: 'all', key: 'allStatus' },
  { id: 'active', key: 'activeStatus' },
  { id: 'inactive', key: 'disabledStatus' },
]

const ACTION_META = {
  [AUDIT_ACTIONS.ROLE_CHANGED]: { key: 'actionRoleChanged', tone: 'accent', icon: ShieldCheck },
  [AUDIT_ACTIONS.NAME_RENAMED]: { key: 'actionNameEdited', tone: 'warn', icon: UserPen },
  [AUDIT_ACTIONS.USER_DEACTIVATED]: { key: 'actionDisabled', tone: 'danger', icon: Ban },
  [AUDIT_ACTIONS.USER_REACTIVATED]: { key: 'actionRestored', tone: 'success', icon: CircleCheck },
  [AUDIT_ACTIONS.ANNOUNCEMENT_PUBLISHED]: { key: 'actionAnnouncementPublished', tone: 'neutral', icon: ScrollText },
  [AUDIT_ACTIONS.ANNOUNCEMENT_UPDATED]: { key: 'actionAnnouncementUpdated', tone: 'neutral', icon: ScrollText },
  [AUDIT_ACTIONS.SUBJECT_UPDATED]: { key: 'actionSubjectUpdated', tone: 'accent', icon: ScrollText },
  [AUDIT_ACTIONS.RECORD_PURGED]: { key: 'actionRecordPurged', tone: 'danger', icon: Ban },
}

/* --------------------------------- editor ------------------------------- */

function MemberEditor({ member, adminUid, availableClasses, onClose }) {
  const { t } = useTranslation()
  const { update } = useFirestore()
  const toast = useToast()

  const [displayName, setDisplayName] = useState(() => member?.displayName ?? '')
  const [role, setRole] = useState(() => member?.role ?? ROLES.RESIDENT)
  const [isActive, setIsActive] = useState(() => Boolean(member?.isActive))
  const [className, setClassName] = useState(() => member?.className ?? '')
  const [subgroup, setSubgroup] = useState(() => member?.subgroup ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  if (!member) return null

  const isSelf = member.uid === adminUid

  const submit = async () => {
    const name = displayName.trim()
    if (name.length < 2) return setError(t('admin.nameRequired'))
    if (subgroup && !className) return setError(t('admin.classRequired'))

    const patch = {}
    if (name !== (member.displayName ?? '')) patch.displayName = name
    if (role !== member.role) patch.role = role
    if (isActive !== Boolean(member.isActive)) patch.isActive = isActive
    if (className !== (member.className ?? '')) patch.className = className
    if (subgroup !== (member.subgroup ?? '')) patch.subgroup = subgroup

    if (Object.keys(patch).length === 0) {
      toast.info(t('admin.nothingToSave'), t('admin.alreadyUpToDate'))
      onClose?.()
      return
    }

    setSaving(true)
    setError(null)

    try {
      await update(COLLECTIONS.USERS, member.id, patch)

      // One audit entry per changed dimension so the trail stays legible.
      if (patch.displayName !== undefined) {
        await recordAudit(adminUid, AUDIT_ACTIONS.NAME_RENAMED, member.uid)
      }
      if (patch.role !== undefined) {
        await recordAudit(adminUid, AUDIT_ACTIONS.ROLE_CHANGED, member.uid)
      }
      if (patch.isActive !== undefined) {
        await recordAudit(
          adminUid,
          patch.isActive ? AUDIT_ACTIONS.USER_REACTIVATED : AUDIT_ACTIONS.USER_DEACTIVATED,
          member.uid,
        )
      }

      toast.success(t('admin.memberUpdated'), `${name} · ${t(`roles.${role}.label`)}`)
      onClose?.()
    } catch (cause) {
      setError(cause?.message ?? t('admin.memberSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={UserPen}
      title={t('admin.editMember')}
      description={t('admin.editMemberDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('admin.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {t('admin.saveRecord')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="flex items-center gap-2.5 rounded-md border border-line bg-sunken/40 px-3 py-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-mono text-[11px] font-semibold text-ink-soft">
            {initials(member.displayName)}
          </span>
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] text-ink">{member.email}</p>
            <p className="mt-0.5 text-[11.5px] text-faint">
              uid <span className="font-mono tnum">{member.uid}</span>
            </p>
          </div>
          {isSelf && (
            <Badge tone="ink" mono className="ml-auto">
              {t('admin.you')}
            </Badge>
          )}
        </div>

        <Field
          label={t('admin.fullName')}
          htmlFor="um-name"
          required
          hint={t('admin.nameHint')}
        >
          <Input
            id="um-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={t('admin.fullName')}
            maxLength={64}
          />
        </Field>

        <Field label={t('admin.role')} htmlFor="um-role" required>
          <Select
            id="um-role"
            value={role}
            onChange={(event) => setRole(event.target.value)}
            options={ROLE_ORDER.map((value) => ({
              value,
              label: `${t(`roles.${value}.label`)} · ${ROLE_META[value].abbr}`,
            }))}
          />
        </Field>

        <p className="-mt-1.5 text-[11.5px] leading-5 text-muted">{t(`roles.${role}.summary`)}</p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t('admin.classAssignment')} htmlFor="um-class">
            <Select
              id="um-class"
              value={className}
              onChange={(event) => {
                setClassName(event.target.value)
                if (!event.target.value) setSubgroup('')
              }}
              options={[
                { value: '', label: t('admin.noClass') },
                ...availableClasses.map((value) => ({ value, label: value })),
              ]}
            />
          </Field>
          <Field label={t('admin.subgroupAssignment')} htmlFor="um-subgroup">
            <Select
              id="um-subgroup"
              value={subgroup}
              onChange={(event) => setSubgroup(event.target.value)}
              disabled={!className}
              options={[
                { value: '', label: t('admin.noSubgroup') },
                { value: '1', label: t('admin.subgroupNumber', { number: 1 }) },
                { value: '2', label: t('admin.subgroupNumber', { number: 2 }) },
              ]}
            />
          </Field>
        </div>

        <div className="rounded-md border border-line bg-sunken/40 p-3">
          <SectionLabel>{t('admin.accountStatus')}</SectionLabel>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={isActive ? 'primary' : 'secondary'}
              icon={CircleCheck}
              disabled={isSelf}
              onClick={() => setIsActive(true)}
            >
              {t('admin.activeStatus')}
            </Button>
            <Button
              size="sm"
              variant={!isActive ? 'primary' : 'secondary'}
              icon={Ban}
              disabled={isSelf}
              onClick={() => setIsActive(false)}
            >
              {t('admin.disabledStatus')}
            </Button>
            <span className="text-[11.5px] text-muted">
              {isSelf
                ? t('admin.cannotDisableSelf')
                : isActive
                  ? t('admin.memberCanUse')
                  : t('admin.signInBlocked')}
            </span>
          </div>
        </div>

        {error && (
          <p className="rounded-md border border-danger-line bg-danger-soft px-2.5 py-2 text-[12px] leading-5 text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

/* ------------------------------- audit trail ---------------------------- */

function AuditTrail({ logs, userById }) {
  const { t } = useTranslation()
  return (
    <Card className="xl:sticky xl:top-20">
      <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-line bg-sunken text-muted">
          <ScrollText size={13} strokeWidth={1.9} />
        </span>
        <div>
          <h3 className="text-[13px] font-semibold leading-5 text-ink">{t('admin.auditTrail')}</h3>
          <p className="text-[11.5px] leading-4 text-muted">{t('admin.auditDescription')}</p>
        </div>
      </div>

      {logs.length === 0 ? (
        <CardBody>
          <p className="text-[12.5px] text-muted">{t('admin.noAudit')}</p>
        </CardBody>
      ) : (
        <ul className="max-h-[420px] divide-y divide-line overflow-y-auto">
          {logs.slice(0, 24).map((log) => {
            const meta = ACTION_META[log.action] ?? {
              key: null,
              tone: 'neutral',
              icon: ScrollText,
            }
            const Icon = meta.icon
            const actor = userById.get(log.adminUid)
            const target = userById.get(log.targetUid)

            return (
              <li key={log.id} className="flex items-start gap-2.5 px-4 py-2.5">
                <span
                  className={cx(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border',
                    meta.tone === 'danger'
                      ? 'border-danger-line bg-danger-soft text-danger'
                      : meta.tone === 'warn'
                        ? 'border-warn-line bg-warn-soft text-warn'
                        : meta.tone === 'success'
                          ? 'border-success-line bg-success-soft text-success'
                          : meta.tone === 'accent'
                            ? 'border-accent-line bg-accent-soft text-accent-ink'
                            : 'border-line bg-sunken text-muted',
                  )}
                >
                  <Icon size={11} strokeWidth={2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] leading-4 text-ink-soft">
                    <span className="font-medium text-ink">{meta.key ? t(`admin.${meta.key}`) : log.action}</span>
                    {target && <span className="text-muted"> · {target.displayName}</span>}
                  </p>
                  <p className="mt-0.5 truncate font-mono tnum text-[10.5px] text-faint">
                    {actor?.displayName ?? t('admin.system')} · {formatRelative(log.timestamp, new Date(), t)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* --------------------------------- panel -------------------------------- */

export default function UserManagement() {
  const { t } = useTranslation()
  const { profile } = useAuth()

  const { data: users, loading } = useCollection(COLLECTIONS.USERS)
  const { data: schedules } = useCollection(COLLECTIONS.SCHEDULE)
  const { data: logs } = useCollection(COLLECTIONS.AUDIT_LOGS, {
    sort: { field: 'timestamp', dir: 'desc' },
  })

  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [editing, setEditing] = useState(null)

  const userById = useMemo(() => new Map(users.map((user) => [user.uid, user])), [users])
  const availableClasses = useMemo(() => getScheduleClasses(schedules), [schedules])

  const counts = useMemo(
    () => ({
      all: users.length,
      active: users.filter((user) => user.isActive).length,
      inactive: users.filter((user) => !user.isActive).length,
    }),
    [users],
  )

  const visible = useMemo(() => {
    const scoped = users.filter((user) => {
      if (status === 'active') return user.isActive
      if (status === 'inactive') return !user.isActive
      return true
    })
    return fuzzyFilter(scoped, query, ['displayName', 'email', 'role'])
  }, [users, status, query])

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: t('admin.statsTotal'), value: counts.all },
            { label: t('admin.active'), value: counts.active },
            { label: t('admin.disabled'), value: counts.inactive },
          ].map((stat) => (
            <div key={stat.label} className="surface p-3.5">
              <span className="font-mono tnum text-[10px] uppercase tracking-[0.11em] text-faint">
                {stat.label}
              </span>
              <p className="mt-1.5 font-mono tnum text-[20px] font-semibold leading-6 text-ink">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-md border border-line bg-surface p-0.5">
            {STATUS_FILTERS.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setStatus(entry.id)}
                className={cx(
                  'inline-flex h-[30px] items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors',
                  status === entry.id ? 'bg-solid text-on-solid' : 'text-muted hover:text-ink',
                )}
              >
                {t(`admin.${entry.key}`)}
                <span
                  className={cx(
                    'font-mono tnum text-[10.5px]',
                    status === entry.id ? 'text-on-solid/60' : 'text-faint',
                  )}
                >
                  {counts[entry.id]}
                </span>
              </button>
            ))}
          </div>

          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder={t('admin.search')}
            className="w-full sm:w-[280px]"
          />
        </div>

        <Card>
          {loading ? (
            <Loader label={t('admin.loading')} />
          ) : visible.length === 0 ? (
            <CardBody>
              <EmptyState
                icon={Inbox}
                title={query ? t('admin.noMatch') : t('admin.noMembers')}
                description={
                  query
                    ? t('admin.searchHint')
                    : t('admin.noMembersHint')
                }
              />
            </CardBody>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th className="px-4 py-2.5 font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                      {t('admin.member')}
                    </th>
                    <th className="px-3 py-2.5 font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                      {t('admin.authority')}
                    </th>
                    <th className="hidden px-3 py-2.5 text-right font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint md:table-cell">
                      {t('admin.duty')}
                    </th>
                    <th className="px-3 py-2.5 font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                      {t('admin.status')}
                    </th>
                    <th className="px-4 py-2.5 text-right font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                      {t('admin.action')}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {visible.map((user) => (
                    <motion.tr
                      key={user.id}
                      layout
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="group transition-colors hover:bg-sunken/40"
                    >
                      <td className="px-4 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cx(
                              'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] font-semibold',
                              user.isActive
                                ? 'border-line bg-sunken text-ink-soft'
                                : 'border-line bg-surface text-faint',
                            )}
                          >
                            {initials(user.displayName)}
                          </span>
                          <div className="min-w-0">
                            <p
                              className={cx(
                                'truncate text-[13px] font-medium leading-5',
                                user.isActive ? 'text-ink' : 'text-muted line-through',
                              )}
                            >
                              {user.displayName}
                            </p>
                            <p className="truncate font-mono text-[11px] leading-4 text-faint">
                              {user.email}
                              {user.className ? ` · ${user.className}` : ''}
                              {user.subgroup ? ` · ${t('admin.subgroupNumber', { number: user.subgroup })}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="hidden px-3 py-2.5 text-right font-mono tnum text-[12.5px] text-ink-soft md:table-cell">
                        {user.dutyCount ?? 0}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge tone={user.isActive ? 'success' : 'danger'} dot>
                          {user.isActive ? t('admin.activeStatus') : t('admin.disabledStatus')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          icon={PenLine}
                          aria-label={t('admin.manage', { name: user.displayName })}
                          onClick={() => setEditing(user)}
                          className="text-muted opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                        />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="flex items-center gap-2 px-1 text-[11.5px] text-faint">
          <Users size={13} />
          <span>
            {t('admin.showing', { visible: visible.length, total: users.length })}
          </span>
        </div>
      </div>

      <AuditTrail logs={logs} userById={userById} />

      {editing && (
        <MemberEditor
          key={editing.uid}
          member={editing}
          adminUid={profile?.uid}
          availableClasses={availableClasses}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}
