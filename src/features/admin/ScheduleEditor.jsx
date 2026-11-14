import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Pencil, Plus, Trash } from 'lucide-react'

import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { useToast } from '../../hooks/useToast'
import Modal, { ConfirmDialog } from '../../components/ui/Modal'
import Card, { CardBody, CardHeader, EmptyState } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Field, Input, Select } from '../../components/ui/Input'
import { Loader } from '../../components/ui/Loader'
import { COLLECTIONS, WEEKDAYS } from '../../utils/constants'
import {
  DEFAULT_CLASS_NAME,
  DEFAULT_SCHEDULE_ROWS,
} from '../schedule/defaultSchedule'

const EMPTY_FORM = {
  className: DEFAULT_CLASS_NAME,
  dayOfWeek: '1',
  lessonNumber: '1',
  subjectName: '',
  room: '',
  teacherName: '',
  subgroup: '',
}

export default function ScheduleEditor() {
  const { t } = useTranslation()
  const { data: rows, loading, error } = useCollection(COLLECTIONS.SCHEDULE)
  const { data: subjects } = useCollection(COLLECTIONS.SUBJECTS)
  const { create, update, remove } = useFirestore()
  const toast = useToast()

  const [selectedClass, setSelectedClass] = useState(DEFAULT_CLASS_NAME)
  const [editing, setEditing] = useState(null)
  const [editorOpen, setEditorOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const classes = useMemo(
    () => [...new Set([DEFAULT_CLASS_NAME, ...rows.map((row) => row.className).filter(Boolean)])]
      .sort((a, b) => a.localeCompare(b, 'ru')),
    [rows],
  )
  const subjectById = useMemo(() => new Map(subjects.map((subject) => [subject.id, subject])), [subjects])

  const classRows = useMemo(
    () =>
      rows
        .filter((row) => (row.className || DEFAULT_CLASS_NAME) === selectedClass)
        .sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.lessonNumber - b.lessonNumber),
    [rows, selectedClass],
  )

  const presetRows = classRows.filter((row) => row.id?.startsWith('schedule-8v-'))
  const canImportPreset =
    selectedClass === DEFAULT_CLASS_NAME &&
    classRows.every((row) => row.id?.startsWith('schedule-8v-')) &&
    presetRows.length < DEFAULT_SCHEDULE_ROWS.length

  const setField = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }))
    setFormError('')
  }

  const openNew = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM, className: selectedClass })
    setFormError('')
    setEditorOpen(true)
  }

  const openEdit = (row) => {
    setEditing(row)
    setForm({
      className: row.className || DEFAULT_CLASS_NAME,
      dayOfWeek: String(row.dayOfWeek),
      lessonNumber: String(row.lessonNumber),
      subjectName: row.subjectName ?? subjectById.get(row.subjectId)?.name ?? '',
      room: row.room ?? '',
      teacherName: row.teacherName ?? '',
      subgroup: row.subgroup ?? '',
    })
    setFormError('')
    setEditorOpen(true)
  }

  const save = async (event) => {
    event.preventDefault()
    const className = form.className.trim()
    const subjectName = form.subjectName.trim()
    const dayOfWeek = Number(form.dayOfWeek)
    const lessonNumber = Number(form.lessonNumber)

    if (!className || !subjectName) {
      setFormError(t('admin.scheduleEditor.required'))
      return
    }

    const subgroup = form.subgroup
    const duplicate = rows.find((row) => {
      if (
        row.id === editing?.id
        || (row.className || DEFAULT_CLASS_NAME) !== className
        || row.dayOfWeek !== dayOfWeek
        || row.lessonNumber !== lessonNumber
      ) return false
      return !subgroup || !row.subgroup || row.subgroup === subgroup
    })
    if (duplicate) {
      setFormError(t('admin.scheduleEditor.duplicate'))
      return
    }

    const payload = {
      className,
      dayOfWeek,
      lessonNumber,
      subjectName,
      room: form.room.trim(),
      teacherName: form.teacherName.trim(),
      subgroup,
      isChanged: editing?.isChanged ?? false,
      replacementTeacher: editing?.replacementTeacher ?? '',
    }

    setSaving(true)
    try {
      if (editing) {
        await update(COLLECTIONS.SCHEDULE, editing.id, payload)
      } else {
        await create(COLLECTIONS.SCHEDULE, payload)
      }
      setSelectedClass(className)
      setEditing(null)
      setEditorOpen(false)
      toast.success(t('admin.scheduleEditor.saved'))
    } catch (cause) {
      setFormError(cause?.message ?? t('admin.scheduleEditor.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const importPreset = async () => {
    const existingIds = new Set(rows.map((row) => row.id))
    const missingRows = DEFAULT_SCHEDULE_ROWS.filter((row) => !existingIds.has(row.id))
    setImporting(true)
    try {
      for (const row of missingRows) {
        await create(COLLECTIONS.SCHEDULE, row)
      }
      toast.success(t('admin.scheduleEditor.imported'), t('admin.scheduleEditor.importedCount', { count: missingRows.length }))
    } catch (cause) {
      toast.error(t('admin.scheduleEditor.importFailed'), cause?.message)
    } finally {
      setImporting(false)
    }
  }

  const deleteRow = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(COLLECTIONS.SCHEDULE, pendingDelete.id)
      toast.success(t('admin.scheduleEditor.deleted'))
      setPendingDelete(null)
    } catch (cause) {
      toast.error(t('admin.scheduleEditor.deleteFailed'), cause?.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader
          icon={CalendarDays}
          title={t('admin.scheduleEditor.title')}
          description={t('admin.scheduleEditor.description')}
          actions={
            <Button size="sm" variant="primary" icon={Plus} onClick={openNew}>
              {t('admin.scheduleEditor.addLesson')}
            </Button>
          }
        />
        <CardBody className="flex flex-wrap items-end gap-3">
          <Field label={t('schedule.class')} htmlFor="schedule-class-filter" className="w-full sm:w-48">
            <Select
              id="schedule-class-filter"
              value={selectedClass}
              onChange={(event) => setSelectedClass(event.target.value)}
              options={classes.map((className) => ({ value: className, label: className }))}
            />
          </Field>
          {canImportPreset && (
            <Button
              size="sm"
              variant="secondary"
              loading={importing}
              onClick={importPreset}
            >
              {t('admin.scheduleEditor.importPreset')}
            </Button>
          )}
          {selectedClass === DEFAULT_CLASS_NAME && (
            <Badge tone={presetRows.length === DEFAULT_SCHEDULE_ROWS.length ? 'success' : 'neutral'} mono>
              {t('admin.scheduleEditor.presetCount', { count: presetRows.length, total: DEFAULT_SCHEDULE_ROWS.length })}
            </Badge>
          )}
        </CardBody>

        {error && (
          <p role="alert" className="mx-4 mb-4 rounded-md border border-danger-line bg-danger-soft px-2.5 py-2 text-[12px] text-danger">
            {t('admin.scheduleEditor.loadFailed')}: {error.message}
          </p>
        )}

        {loading ? (
          <Loader label={t('admin.scheduleEditor.loading')} />
        ) : classRows.length === 0 ? (
          <CardBody>
            <EmptyState
              icon={CalendarDays}
              title={t('admin.scheduleEditor.emptyTitle')}
              description={t('admin.scheduleEditor.emptyDescription')}
              action={
                selectedClass === DEFAULT_CLASS_NAME && (
                  <Button size="sm" variant="secondary" loading={importing} onClick={importPreset}>
                    {t('admin.scheduleEditor.importPreset')}
                  </Button>
                )
              }
            />
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {classRows.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <span className="w-16 shrink-0 font-mono tnum text-[11px] text-faint">
                  {t(`weekdays.${['mon', 'tue', 'wed', 'thu', 'fri', 'sat'][row.dayOfWeek - 1]}.short`)} · {row.lessonNumber}
                </span>
                <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-ink">
                  {row.subjectName || subjectById.get(row.subjectId)?.name || t('common.unassigned')}
                </span>
                {row.subgroup && <Badge tone="outline" mono>{t('schedule.subgroupShort', { number: row.subgroup })}</Badge>}
                <span className="font-mono tnum text-[10.5px] text-faint">{row.room || '—'}</span>
                <Button size="icon-sm" variant="ghost" icon={Pencil} aria-label={t('admin.scheduleEditor.edit')} onClick={() => openEdit(row)} />
                <Button size="icon-sm" variant="ghost" icon={Trash} aria-label={t('admin.scheduleEditor.delete')} onClick={() => setPendingDelete(row)} className="text-danger hover:bg-danger-soft hover:text-danger" />
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editorOpen && (
        <Modal
          open
          onClose={() => {
            if (!saving) setEditorOpen(false)
          }}
          title={t('admin.scheduleEditor.editTitle')}
          description={t('admin.scheduleEditor.formDescription')}
          icon={CalendarDays}
          closeOnBackdrop={!saving}
          footer={
            <>
              <Button variant="ghost" onClick={() => setEditorOpen(false)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="schedule-editor-form" variant="primary" loading={saving}>
                {t('common.save')}
              </Button>
            </>
          }
        >
          <form id="schedule-editor-form" onSubmit={save} className="flex flex-col gap-3.5">
            <Field label={t('admin.scheduleEditor.className')} htmlFor="schedule-class" required>
              <Input id="schedule-class" value={form.className} onChange={setField('className')} maxLength={24} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('admin.scheduleEditor.weekday')} htmlFor="schedule-weekday" required>
                <Select
                  id="schedule-weekday"
                  value={form.dayOfWeek}
                  onChange={setField('dayOfWeek')}
                  options={WEEKDAYS.map((day) => ({
                    value: String(day.value),
                    label: t(`weekdays.${['mon', 'tue', 'wed', 'thu', 'fri', 'sat'][day.value - 1]}.full`),
                  }))}
                />
              </Field>
              <Field label={t('schedule.lesson')} htmlFor="schedule-lesson" required>
                <Select
                  id="schedule-lesson"
                  value={form.lessonNumber}
                  onChange={setField('lessonNumber')}
                  options={Array.from({ length: 8 }, (_, index) => ({
                    value: String(index + 1),
                    label: t('schedule.lessonWithNumber', { number: index + 1 }),
                  }))}
                />
              </Field>
            </div>
            <Field label={t('admin.scheduleEditor.subgroup')} htmlFor="schedule-subgroup">
              <Select
                id="schedule-subgroup"
                value={form.subgroup}
                onChange={setField('subgroup')}
                options={[
                  { value: '', label: t('admin.scheduleEditor.allSubgroups') },
                  { value: '1', label: t('schedule.subgroupShort', { number: 1 }) },
                  { value: '2', label: t('schedule.subgroupShort', { number: 2 }) },
                ]}
              />
            </Field>
            <Field label={t('admin.scheduleEditor.subject')} htmlFor="schedule-subject" required>
              <Input id="schedule-subject" value={form.subjectName} onChange={setField('subjectName')} maxLength={64} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t('admin.scheduleEditor.room')} htmlFor="schedule-room">
                <Input id="schedule-room" value={form.room} onChange={setField('room')} maxLength={24} />
              </Field>
              <Field label={t('admin.scheduleEditor.teacher')} htmlFor="schedule-teacher">
                <Input id="schedule-teacher" value={form.teacherName} onChange={setField('teacherName')} maxLength={64} />
              </Field>
            </div>
            {formError && (
              <p role="alert" className="rounded-md border border-danger-line bg-danger-soft px-2.5 py-2 text-[12px] leading-5 text-danger">
                {formError}
              </p>
            )}
          </form>
        </Modal>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={deleteRow}
        loading={deleting}
        title={t('admin.scheduleEditor.deleteTitle')}
        description={pendingDelete ? `${pendingDelete.className || DEFAULT_CLASS_NAME} · ${pendingDelete.subjectName}` : undefined}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
