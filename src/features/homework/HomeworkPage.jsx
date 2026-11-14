import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  CircleCheck,
  Clock,
  FileArchive,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Inbox,
  Layers,
  NotebookPen,
  Paperclip,
  Pencil,
  Play,
  Plus,
  Trash,
  X,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { useNow } from '../../hooks/useNow'
import { useToast } from '../../hooks/useToast'
import Modal, { ConfirmDialog } from '../../components/ui/Modal'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardBody, EmptyState, SectionLabel } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Field, Input, SearchInput, Select, Textarea, Checkbox } from '../../components/ui/Input'
import { Loader } from '../../components/ui/Loader'
import { COLLECTIONS } from '../../utils/constants'
import { addDays, formatRelative, isDueSoon, isOverdue, toISODate } from '../../utils/dateHelpers'
import { fileKind, formatBytes, initials, subjectCode, truncate } from '../../utils/format'
import cx from '../../utils/cx'

/* ------------------------------- helpers ------------------------------- */

const FILE_ICONS = {
  document: FileText,
  slides: Layers,
  sheet: FileSpreadsheet,
  archive: FileArchive,
  image: ImageIcon,
  video: Play,
  file: Paperclip,
}

function FileChip({ file, onRemove }) {
  const { t } = useTranslation()
  const Icon = FILE_ICONS[fileKind(file.name)] ?? Paperclip

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-sunken px-2 py-1">
      <Icon size={12} className="shrink-0 text-muted" />
      <span className="max-w-[180px] truncate text-[11.5px] text-ink-soft">{file.name}</span>
      <span className="font-mono tnum text-[10.5px] text-faint">{formatBytes(file.size)}</span>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(file)}
          aria-label={t('homework.fileRemove', { name: file.name })}
          className="-mr-0.5 flex h-4 w-4 items-center justify-center rounded text-faint transition-colors hover:bg-line hover:text-ink"
        >
          <X size={11} strokeWidth={2.2} />
        </button>
      )}
    </span>
  )
}

function DeadlineBadge({ deadline, now }) {
  const { t } = useTranslation()
  const overdue = isOverdue(deadline, now)
  const soon = !overdue && isDueSoon(deadline, 2, now)

  return (
    <Badge tone={overdue ? 'danger' : soon ? 'warn' : 'neutral'} icon={Clock} mono>
      {overdue ? t('homework.overdue') : formatRelative(deadline, now, t)}
    </Badge>
  )
}

/* -------------------------------- dialog ------------------------------- */

const EMPTY = { subjectId: '', text: '', deadlineDate: '', isUrgent: false, taskFiles: [] }

function getInitialHomeworkForm(initial, subjects) {
  return initial
    ? {
        subjectId: initial.subjectId ?? '',
        text: initial.text ?? '',
        deadlineDate: initial.deadlineDate ?? '',
        isUrgent: Boolean(initial.isUrgent),
        taskFiles: initial.taskFiles ?? [],
      }
    : {
        ...EMPTY,
        subjectId: subjects[0]?.id ?? '',
        deadlineDate: toISODate(addDays(new Date(), 2)),
      }
}

function HomeworkDialog({ open, onClose, initial, subjects }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { create, update } = useFirestore()
  const toast = useToast()
  const fileInput = useRef(null)

  const [form, setForm] = useState(() => getInitialHomeworkForm(initial, subjects))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const attach = (event) => {
    const picked = Array.from(event.target.files ?? []).map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      url: '',
    }))
    if (picked.length) set('taskFiles', [...form.taskFiles, ...picked])
    event.target.value = ''
  }

  const submit = async () => {
    if (!form.subjectId) return setError(t('homework.pickSubject'))
    if (!form.text.trim()) return setError(t('homework.describeTask'))
    if (!form.deadlineDate) return setError(t('homework.setDeadline'))

    setSaving(true)
    setError(null)

    const payload = {
      subjectId: form.subjectId,
      text: form.text.trim(),
      taskFiles: form.taskFiles,
      deadlineDate: form.deadlineDate,
      isUrgent: Boolean(form.isUrgent),
      authorUid: profile?.uid ?? '',
    }

    try {
      if (initial?.id) {
        await update(COLLECTIONS.HOMEWORK, initial.id, payload)
        toast.success(t('homework.updatedToast'))
      } else {
        await create(COLLECTIONS.HOMEWORK, { ...payload, createdAt: new Date().toISOString() })
        toast.success(t('homework.publishedToast'))
      }
      onClose?.()
    } catch (cause) {
      setError(cause?.message ?? t('homework.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={NotebookPen}
      size="lg"
      title={initial ? t('homework.editTitle') : t('homework.newTitle')}
      description={t('homework.dialogDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('homework.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {initial ? t('homework.saveChanges') : t('homework.publish')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label={t('homework.subject')} htmlFor="hw-subject" required>
            <Select
              id="hw-subject"
              value={form.subjectId}
              onChange={(event) => set('subjectId', event.target.value)}
              placeholder={t('homework.selectSubject')}
              options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
            />
          </Field>
          <Field label={t('homework.deadline')} htmlFor="hw-deadline" required>
            <Input
              id="hw-deadline"
              type="date"
              value={form.deadlineDate}
              onChange={(event) => set('deadlineDate', event.target.value)}
            />
          </Field>
        </div>

        <Field label={t('homework.task')} htmlFor="hw-text" required>
          <Textarea
            id="hw-text"
            rows={4}
            value={form.text}
            onChange={(event) => set('text', event.target.value)}
            placeholder={t('homework.taskPlaceholder')}
          />
        </Field>

        <div className="rounded-md border border-line bg-sunken/40 p-3">
          <div className="flex items-center justify-between">
            <SectionLabel>{t('homework.attachments')}</SectionLabel>
            <Button size="sm" variant="secondary" icon={Paperclip} onClick={() => fileInput.current?.click()}>
              {t('homework.attachFiles')}
            </Button>
            <input ref={fileInput} type="file" multiple hidden onChange={attach} />
          </div>

          {form.taskFiles.length === 0 ? (
            <p className="mt-2 text-[11.5px] text-faint">
              {t('homework.noFiles')}
            </p>
          ) : (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {form.taskFiles.map((file, index) => (
                <FileChip
                  key={`${file.name}-${index}`}
                  file={file}
                  onRemove={() =>
                    set('taskFiles', form.taskFiles.filter((_, position) => position !== index))
                  }
                />
              ))}
            </div>
          )}
        </div>

        <Checkbox
          checked={form.isUrgent}
          onChange={(value) => set('isUrgent', value)}
          label={t('homework.flagUrgent')}
          description={t('homework.urgentDescription')}
        />

        {error && (
          <p className="rounded-md border border-danger-line bg-danger-soft px-2.5 py-2 text-[12px] leading-5 text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

/* --------------------------------- page -------------------------------- */

const FILTERS = [
  { id: 'all', key: 'all' },
  { id: 'urgent', key: 'urgent' },
  { id: 'soon', key: 'dueSoon' },
  { id: 'overdue', key: 'overdue' },
]

export default function HomeworkPage() {
  const { t } = useTranslation()
  const now = useNow(30000)
  const { profile, can } = useAuth()
  const toast = useToast()
  const { create, remove, update } = useFirestore()

  const { data: homework, loading } = useCollection(COLLECTIONS.HOMEWORK)
  const { data: subjects } = useCollection(COLLECTIONS.SUBJECTS)
  const { data: users } = useCollection(COLLECTIONS.MEMBERS)
  const { data: progress, error: progressError } = useCollection(
    COLLECTIONS.HOMEWORK_PROGRESS,
    { filters: [{ field: 'uid', value: profile?.uid }] },
    { enabled: Boolean(profile?.uid) },
  )

  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [dialog, setDialog] = useState({ open: false, record: null })
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [savingProgressId, setSavingProgressId] = useState(null)

  const canWrite = can('homework:write')

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const userById = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users])
  const progressByHomework = useMemo(
    () => new Map(progress.map((entry) => [entry.homeworkId, entry])),
    [progress],
  )

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects],
  )

  const counts = useMemo(
    () => ({
      all: homework.length,
      urgent: homework.filter((item) => item.isUrgent).length,
      soon: homework.filter((item) => !isOverdue(item.deadlineDate, now) && isDueSoon(item.deadlineDate, 2, now)).length,
      overdue: homework.filter((item) => isOverdue(item.deadlineDate, now)).length,
    }),
    [homework, now],
  )

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    return homework
      .filter((item) => {
        if (filter === 'urgent') return item.isUrgent
        if (filter === 'overdue') return isOverdue(item.deadlineDate, now)
        if (filter === 'soon') return !isOverdue(item.deadlineDate, now) && isDueSoon(item.deadlineDate, 2, now)
        return true
      })
      .filter((item) => {
        if (!needle) return true
        const subject = subjectById.get(item.subjectId)?.name ?? ''
        return `${item.text} ${subject}`.toLowerCase().includes(needle)
      })
      .sort((a, b) => Number(b.isUrgent) - Number(a.isUrgent) || (a.deadlineDate > b.deadlineDate ? 1 : -1))
  }, [homework, filter, query, now, subjectById])

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(COLLECTIONS.HOMEWORK, pendingDelete.id)
      toast.success(t('homework.removedToast'))
      setPendingDelete(null)
    } catch (cause) {
      toast.error(t('homework.deleteFailed'), cause?.message)
    } finally {
      setDeleting(false)
    }
  }

  const toggleCompleted = async (item) => {
    if (!profile?.uid || savingProgressId) return
    const existing = progressByHomework.get(item.id)
    setSavingProgressId(item.id)
    try {
      if (existing) {
        await update(COLLECTIONS.HOMEWORK_PROGRESS, existing.id, {
          completed: !existing.completed,
          updatedAt: new Date().toISOString(),
        })
      } else {
        await create(COLLECTIONS.HOMEWORK_PROGRESS, {
          uid: profile.uid,
          homeworkId: item.id,
          completed: true,
          updatedAt: new Date().toISOString(),
        })
      }
    } catch (cause) {
      toast.error(t('homework.progressSaveFailed'), cause?.message)
    } finally {
      setSavingProgressId(null)
    }
  }

  return (
    <>
      <PageHeader
        eyebrow={t('homework.eyebrow')}
        icon={NotebookPen}
        title={t('homework.title')}
        description={t('homework.description')}
        actions={
          canWrite && (
            <Button variant="primary" icon={Plus} onClick={() => setDialog({ open: true, record: null })}>
              {t('homework.new')}
            </Button>
          )
        }
      />

      {progressError && (
        <p role="alert" className="mb-3 rounded-md border border-danger-line bg-danger-soft px-3 py-2 text-[12px] text-danger">
          {t('homework.progressLoadFailed')}
        </p>
      )}

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-surface p-0.5">
          {FILTERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setFilter(entry.id)}
              className={cx(
                'inline-flex h-[30px] items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors',
                filter === entry.id ? 'bg-solid text-on-solid' : 'text-muted hover:text-ink',
              )}
            >
              {t(`homework.${entry.key}`)}
              <span
                className={cx(
                  'font-mono tnum text-[10.5px]',
                  filter === entry.id ? 'text-on-solid/60' : 'text-faint',
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
          placeholder={t('homework.search')}
          className="w-full sm:w-[260px]"
        />
      </div>

      {loading ? (
        <Card>
          <Loader label={t('homework.loading')} />
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={query ? t('homework.noMatch') : t('homework.emptyTitle')}
          description={
            query
              ? t('homework.searchHint')
              : canWrite
                ? t('homework.publishFirst')
                : t('homework.waitForTeacher')
          }
          action={
            canWrite && !query ? (
              <Button variant="primary" icon={Plus} onClick={() => setDialog({ open: true, record: null })}>
                {t('homework.new')}
              </Button>
            ) : null
          }
        />
      ) : (
        <Card className="divide-y divide-line">
          {visible.map((item) => {
            const subject = subjectById.get(item.subjectId)
            const author = userById.get(item.authorUid)
            const overdue = isOverdue(item.deadlineDate, now)

            return (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group px-4 py-4"
              >
                <div className="flex items-start gap-3">
                  <span
                    className={cx(
                      'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border font-mono text-[10.5px] font-semibold',
                      item.isUrgent
                        ? 'border-danger-line bg-danger-soft text-danger'
                        : 'border-line bg-sunken text-ink-soft',
                    )}
                    title={subject?.name}
                  >
                    {subjectCode(subject?.name)}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[13.5px] font-semibold leading-5 text-ink">
                        {subject?.name ?? t('homework.unassigned')}
                      </h3>
                      {item.isUrgent && (
                        <Badge tone="danger" mono>
                          {t('homework.urgent')}
                        </Badge>
                      )}
                      <DeadlineBadge deadline={item.deadlineDate} now={now} />
                      {overdue && (
                        <Badge tone="outline" mono>
                          {toISODate(item.deadlineDate)}
                        </Badge>
                      )}
                    </div>

                    <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">{item.text}</p>

                    {item.taskFiles?.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {item.taskFiles.map((file, index) => (
                          <FileChip key={`${file.name}-${index}`} file={file} />
                        ))}
                      </div>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-faint">
                      <span className="flex items-center gap-1.5">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full border border-line bg-surface font-mono text-[8.5px] font-semibold text-ink-soft">
                          {initials(author?.displayName)}
                        </span>
                        {author?.displayName ?? t('announcements.classOffice')}
                      </span>
                      <span className="h-2.5 w-px bg-line" />
                      <span>{t('homework.posted', { when: formatRelative(item.createdAt, now, t) })}</span>
                      <span className="h-2.5 w-px bg-line" />
                      <span className="font-mono tnum">{t('homework.due', { date: item.deadlineDate })}</span>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant={progressByHomework.get(item.id)?.completed ? 'primary' : 'secondary'}
                    icon={CircleCheck}
                    loading={savingProgressId === item.id}
                    disabled={Boolean(savingProgressId) && savingProgressId !== item.id}
                    aria-label={t(
                      progressByHomework.get(item.id)?.completed
                        ? 'homework.markIncomplete'
                        : 'homework.markComplete',
                    )}
                    onClick={() => toggleCompleted(item)}
                  >
                    {t(progressByHomework.get(item.id)?.completed ? 'homework.completed' : 'homework.markComplete')}
                  </Button>

                  {canWrite && (
                    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        icon={Pencil}
                        aria-label={t('homework.edit')}
                        onClick={() => setDialog({ open: true, record: item })}
                      />
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        icon={Trash}
                        aria-label={t('homework.delete')}
                        onClick={() => setPendingDelete(item)}
                      />
                    </div>
                  )}
                </div>
              </motion.article>
            )
          })}
        </Card>
      )}

      {canWrite && (
        <Card className="mt-4">
          <CardBody className="flex items-center gap-2.5">
            <CircleCheck size={15} className="shrink-0 text-success" />
            <p className="text-[12.5px] leading-5 text-muted">
              {t('homework.managerRights')}
            </p>
          </CardBody>
        </Card>
      )}

      {dialog.open && (
        <HomeworkDialog
          open
          initial={dialog.record}
          subjects={sortedSubjects}
          onClose={() => setDialog({ open: false, record: null })}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('homework.deleteTitle')}
        description={pendingDelete ? truncate(pendingDelete.text, 90) : undefined}
        confirmLabel={t('common.delete')}
      />
    </>
  )
}
