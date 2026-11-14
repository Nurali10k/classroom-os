import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { BookOpen, Eraser, Inbox, PenLine, Plus, Trash } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { recordAudit, useCollection, useFirestore } from '../../hooks/useFirestore'
import { useToast } from '../../hooks/useToast'
import Modal, { ConfirmDialog } from '../../components/ui/Modal'
import Card, { CardBody, CardHeader, EmptyState, SectionLabel } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge, { MonoBadge } from '../../components/ui/Badge'
import { Field, Input } from '../../components/ui/Input'
import { Loader } from '../../components/ui/Loader'
import { AUDIT_ACTIONS, COLLECTIONS } from '../../utils/constants'
import { diffInDays, toISODate } from '../../utils/dateHelpers'
import { subjectCode } from '../../utils/format'
import cx from '../../utils/cx'

/** Anything this far past its deadline is treated as an outdated node. */
const STALE_DAYS = 14

const EMPTY_SUBJECT = { name: '', teacherName: '', roomDefault: '' }

/* ------------------------------- editor -------------------------------- */

function SubjectEditor({ subject, adminUid, onClose }) {
  const { t } = useTranslation()
  const { create, update } = useFirestore()
  const toast = useToast()

  const [form, setForm] = useState(() =>
    subject
      ? {
          name: subject.name ?? '',
          teacherName: subject.teacherName ?? '',
          roomDefault: subject.roomDefault ?? '',
        }
      : EMPTY_SUBJECT,
  )
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))

  const submit = async () => {
    if (!form.name.trim()) return setError(t('admin.subjectEditor.required'))

    setSaving(true)
    setError(null)

    const payload = {
      name: form.name.trim(),
      teacherName: form.teacherName.trim(),
      roomDefault: form.roomDefault.trim(),
    }

    try {
      if (subject?.id) {
        await update(COLLECTIONS.SUBJECTS, subject.id, payload)
        await recordAudit(adminUid, AUDIT_ACTIONS.SUBJECT_UPDATED, subject.id)
        toast.success(t('admin.subjectEditor.saved'), payload.name)
      } else {
        const id = await create(COLLECTIONS.SUBJECTS, payload)
        await recordAudit(adminUid, AUDIT_ACTIONS.SUBJECT_UPDATED, id)
        toast.success(t('admin.subjectEditor.created'), payload.name)
      }
      onClose?.()
    } catch (cause) {
      setError(cause?.message ?? t('admin.subjectEditor.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      icon={BookOpen}
      title={subject ? t('admin.subjectEditor.edit') : t('admin.subjectEditor.new')}
      description={t('admin.subjectEditor.description')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {subject ? t('common.save') : t('admin.addSubject')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label={t('admin.subjectEditor.name')} htmlFor="sub-name" required>
          <Input
            id="sub-name"
            value={form.name}
            onChange={set('name')}
            placeholder={t('admin.subjectEditor.placeholder')}
            maxLength={48}
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label={t('admin.subjectEditor.teacher')} htmlFor="sub-teacher">
            <Input
              id="sub-teacher"
              value={form.teacherName}
              onChange={set('teacherName')}
              placeholder={t('admin.subjectEditor.teacher')}
              maxLength={48}
            />
          </Field>
          <Field label={t('admin.subjectEditor.defaultRoom')} htmlFor="sub-room">
            <Input
              id="sub-room"
              value={form.roomDefault}
              onChange={set('roomDefault')}
              placeholder="204"
              maxLength={16}
            />
          </Field>
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

/* --------------------------------- panel -------------------------------- */

export default function HomeworkEditor() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const toast = useToast()
  const { remove } = useFirestore()

  const { data: subjects, loading: subjectsLoading } = useCollection(COLLECTIONS.SUBJECTS)
  const { data: homework, loading: homeworkLoading } = useCollection(COLLECTIONS.HOMEWORK)

  const [editing, setEditing] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingPurge, setPendingPurge] = useState(null)
  const [purging, setPurging] = useState(false)

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])

  const orderedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects],
  )

  // Outdated nodes — assignments sitting more than STALE_DAYS past the deadline.
  const stale = useMemo(
    () =>
      homework
        .filter((item) => item.deadlineDate && diffInDays(new Date(), item.deadlineDate) > STALE_DAYS)
        .sort((a, b) => (a.deadlineDate > b.deadlineDate ? 1 : -1)),
    [homework],
  )

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (subject) => {
    setEditing(subject)
    setDialogOpen(true)
  }

  const purgeOne = async (record) => {
    setPurging(true)
    try {
      await remove(COLLECTIONS.HOMEWORK, record.id)
      await recordAudit(profile?.uid, AUDIT_ACTIONS.RECORD_PURGED, record.id)
      toast.success(t('admin.recordDeleted'), subjectById.get(record.subjectId)?.name ?? record.id)
      setPendingPurge(null)
    } catch (cause) {
      toast.error(t('admin.recordDeleteFailed'), cause?.message)
    } finally {
      setPurging(false)
    }
  }

  const purgeAll = async () => {
    setPurging(true)
    try {
      await Promise.all(
        stale.map(async (record) => {
          await remove(COLLECTIONS.HOMEWORK, record.id)
          await recordAudit(profile?.uid, AUDIT_ACTIONS.RECORD_PURGED, record.id)
        }),
      )
      toast.success(t('admin.cleanupComplete'), t('admin.recordsRemoved', { count: stale.length }))
      setPendingPurge(null)
    } catch (cause) {
      toast.error(t('admin.cleanupFailed'), cause?.message)
    } finally {
      setPurging(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          icon={BookOpen}
          title={t('admin.subjectRegistry')}
          description={t('admin.subjectRegistryDescription', { count: subjects.length })}
          actions={
            <Button size="sm" variant="primary" icon={Plus} onClick={openCreate}>
              {t('admin.addSubject')}
            </Button>
          }
        />

        {subjectsLoading ? (
          <Loader label={t('admin.loadingSubjects')} />
        ) : orderedSubjects.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={Inbox}
              title={t('admin.noSubjects')}
              description={t('admin.noSubjectsDescription')}
              action={
                <Button variant="primary" icon={Plus} onClick={openCreate}>
                  {t('admin.addSubject')}
                </Button>
              }
            />
          </CardBody>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line">
                  <th className="px-4 py-2.5 font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                    {t('admin.code')}
                  </th>
                  <th className="px-3 py-2.5 font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                    {t('admin.subjectEditor.name')}
                  </th>
                  <th className="px-3 py-2.5 font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                    {t('admin.teacher')}
                  </th>
                  <th className="px-3 py-2.5 font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                    {t('admin.room')}
                  </th>
                  <th className="px-4 py-2.5 text-right font-mono tnum text-[10px] font-medium uppercase tracking-[0.11em] text-faint">
                    {t('admin.action')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {orderedSubjects.map((subject) => (
                  <motion.tr
                    key={subject.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="group transition-colors hover:bg-sunken/40"
                  >
                    <td className="px-4 py-2.5">
                      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-sunken font-mono text-[10px] font-semibold text-ink-soft">
                        {subjectCode(subject.name)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[13px] font-medium text-ink">{subject.name}</td>
                    <td className="px-3 py-2.5 text-[12.5px] text-muted">
                      {subject.teacherName || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <MonoBadge>{subject.roomDefault || '—'}</MonoBadge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        icon={PenLine}
                        aria-label={`Edit ${subject.name}`}
                        onClick={() => openEdit(subject)}
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

      <Card>
        <CardHeader
          icon={Eraser}
          title={t('admin.recordHygiene')}
          description={t('admin.oldAssignmentsDescription', { count: STALE_DAYS })}
          actions={
            stale.length > 0 && (
              <Button
                size="sm"
                variant="secondary"
                icon={Trash}
                onClick={() => setPendingPurge({ bulk: true })}
              >
                {t('admin.purgeAll', { count: stale.length })}
              </Button>
            )
          }
        />

        {homeworkLoading ? (
          <Loader label={t('admin.loadingAssignments')} />
        ) : stale.length === 0 ? (
          <CardBody className="flex items-center gap-2.5">
            <Badge tone="success" dot>
              {t('admin.clean')}
            </Badge>
            <p className="text-[12.5px] leading-5 text-muted">
              {t('admin.noOldAssignments')}
            </p>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {stale.map((record) => {
              const overdueDays = diffInDays(record.deadlineDate, new Date())
              return (
                <li key={record.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-line bg-sunken font-mono text-[10px] font-semibold text-ink-soft">
                    {subjectCode(subjectById.get(record.subjectId)?.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] leading-5 text-ink-soft">
                      {record.text}
                    </p>
                    <p className="mt-0.5 font-mono tnum text-[10.5px] text-faint">
                      {subjectById.get(record.subjectId)?.name ?? t('common.unassigned')} · {t('homework.due', { date: toISODate(record.deadlineDate) })}
                    </p>
                  </div>

                  <Badge tone="warn" mono className="shrink-0">
                    {t('admin.overdueDays', { count: overdueDays })}
                  </Badge>

                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash}
                    onClick={() => setPendingPurge({ record })}
                    className="shrink-0 text-danger hover:bg-danger-soft hover:text-danger"
                  >
                    {t('admin.delete')}
                  </Button>
                </li>
              )
            })}
          </ul>
        )}

        <div className="border-t border-line bg-sunken/40 px-4 py-2.5">
          <SectionLabel>{t('admin.housekeeping')}</SectionLabel>
          <p className="mt-1 text-[11.5px] leading-5 text-muted">
            {t('admin.housekeepingDescription')}
          </p>
        </div>
      </Card>

      <div className={cx('grid gap-3 sm:grid-cols-3')}>
        {[
          { label: t('admin.subjects'), value: subjects.length },
          { label: t('admin.assignments'), value: homework.length },
          { label: t('admin.outdated'), value: stale.length },
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

      {dialogOpen && (
        <SubjectEditor
          subject={editing}
          adminUid={profile?.uid}
          onClose={() => {
            setDialogOpen(false)
            setEditing(null)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingPurge)}
        onClose={() => setPendingPurge(null)}
        onConfirm={pendingPurge?.bulk ? purgeAll : () => purgeOne(pendingPurge.record)}
        loading={purging}
        title={pendingPurge?.bulk ? t('admin.deleteOldRecords', { count: stale.length }) : t('admin.deleteOldRecord')}
        description={
          pendingPurge?.bulk
            ? t('admin.deleteOldDescription')
            : undefined
        }
        confirmLabel={t('admin.delete')}
      />
    </div>
  )
}
