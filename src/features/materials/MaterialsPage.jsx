import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import {
  ArrowUpRight,
  Check,
  Download,
  FileArchive,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Inbox,
  Layers,
  Link2,
  Plus,
  Upload,
} from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/ui/Modal'
import PageHeader from '../../components/shared/PageHeader'
import Card, { CardBody, EmptyState, SectionLabel } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Field, Input, SearchInput, Select, Textarea } from '../../components/ui/Input'
import { Loader } from '../../components/ui/Loader'
import { COLLECTIONS, MATERIAL_KINDS } from '../../utils/constants'
import { formatRelative } from '../../utils/dateHelpers'
import { formatBytes, initials, subjectCode } from '../../utils/format'
import cx from '../../utils/cx'

const KIND_META = {
  [MATERIAL_KINDS.DOCUMENT]: { key: 'document', icon: FileText, tone: 'neutral' },
  [MATERIAL_KINDS.SLIDES]: { key: 'slides', icon: Layers, tone: 'accent' },
  [MATERIAL_KINDS.SHEET]: { key: 'sheet', icon: FileSpreadsheet, tone: 'success' },
  [MATERIAL_KINDS.ARCHIVE]: { key: 'archive', icon: FileArchive, tone: 'warn' },
  [MATERIAL_KINDS.LINK]: { key: 'link', icon: Link2, tone: 'ink' },
}

/* -------------------------------- dialog ------------------------------- */

const EMPTY = { title: '', subjectId: '', kind: MATERIAL_KINDS.DOCUMENT, description: '', url: '', file: null }

function MaterialDialog({ open, onClose, subjects }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { create } = useFirestore()
  const toast = useToast()
  const fileInput = useRef(null)

  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const reset = () => {
    setForm({ ...EMPTY, subjectId: subjects[0]?.id ?? '' })
    setError(null)
  }

  const isLink = form.kind === MATERIAL_KINDS.LINK
  const kindOptions = Object.entries(KIND_META).map(([value, meta]) => ({
    value,
    label: t(`materials.${meta.key}`),
  }))

  const submit = async () => {
    if (!form.title.trim()) return setError(t('materials.needTitle'))
    if (!form.subjectId) return setError(t('materials.needSubject'))
    if (isLink && !form.url.trim()) return setError(t('materials.needUrl'))
    if (!isLink && !form.file) return setError(t('materials.needFile'))

    setSaving(true)
    setError(null)

    try {
      await create(COLLECTIONS.MATERIALS, {
        subjectId: form.subjectId,
        title: form.title.trim(),
        description: form.description.trim(),
        kind: form.kind,
        url: isLink ? form.url.trim() : '',
        fileName: isLink ? '' : form.file.name,
        size: isLink ? 0 : form.file.size,
        authorUid: profile?.uid ?? '',
        createdAt: new Date().toISOString(),
      })
      toast.success(t('materials.published'), form.title.trim())
      reset()
      onClose?.()
    } catch (cause) {
      setError(cause?.message ?? t('materials.publishFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset()
        onClose?.()
      }}
      icon={Upload}
      size="lg"
      title={t('materials.dialogTitle')}
      description={t('materials.dialogDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('materials.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={submit} icon={Check}>
            {t('materials.publish')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label={t('materials.titleLabel')} htmlFor="mat-title" required>
          <Input
            id="mat-title"
            value={form.title}
            onChange={(event) => set('title', event.target.value)}
            placeholder={t('materials.titleLabel')}
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label={t('materials.subject')} htmlFor="mat-subject" required>
            <Select
              id="mat-subject"
              value={form.subjectId}
              onChange={(event) => set('subjectId', event.target.value)}
              options={subjects.map((subject) => ({ value: subject.id, label: subject.name }))}
            />
          </Field>
          <Field label={t('materials.type')} htmlFor="mat-kind">
            <Select
              id="mat-kind"
              value={form.kind}
              onChange={(event) => set('kind', event.target.value)}
              options={kindOptions}
            />
          </Field>
        </div>

        <Field label={t('materials.descriptionLabel')} htmlFor="mat-description">
          <Textarea
            id="mat-description"
            rows={3}
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
            placeholder={t('materials.descriptionLabel')}
          />
        </Field>

        {isLink ? (
          <Field label={t('materials.url')} htmlFor="mat-url" required>
            <Input
              id="mat-url"
              value={form.url}
              onChange={(event) => set('url', event.target.value)}
              placeholder="https://…"
              icon={Link2}
            />
          </Field>
        ) : (
          <div className="rounded-md border border-line bg-sunken/40 p-3">
            <SectionLabel>{t('materials.file')}</SectionLabel>
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="secondary" icon={Upload} onClick={() => fileInput.current?.click()}>
                {t('materials.chooseFile')}
              </Button>
              {form.file ? (
                <span className="truncate font-mono text-[11.5px] text-ink-soft">
                  {form.file.name} · {formatBytes(form.file.size)}
                </span>
              ) : (
                <span className="text-[11.5px] text-faint">{t('materials.noFileSelected')}</span>
              )}
              <input
                ref={fileInput}
                type="file"
                hidden
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  if (file) set('file', file)
                  event.target.value = ''
                }}
              />
            </div>
          </div>
        )}

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

export default function MaterialsPage() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const toast = useToast()

  const { data: materials, loading } = useCollection(COLLECTIONS.MATERIALS)
  const { data: subjects } = useCollection(COLLECTIONS.SUBJECTS)
  const { data: users } = useCollection(COLLECTIONS.MEMBERS)

  const [kind, setKind] = useState('all')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const canUpload = can('materials:upload')

  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects])
  const userById = useMemo(() => new Map(users.map((u) => [u.uid, u])), [users])

  const sortedSubjects = useMemo(
    () => [...subjects].sort((a, b) => a.name.localeCompare(b.name)),
    [subjects],
  )

  const counts = useMemo(() => {
    const base = { all: materials.length }
    Object.keys(KIND_META).forEach((key) => {
      base[key] = materials.filter((item) => item.kind === key).length
    })
    return base
  }, [materials])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return materials
      .filter((item) => (kind === 'all' ? true : item.kind === kind))
      .filter((item) => {
        if (!needle) return true
        const subject = subjectById.get(item.subjectId)?.name ?? ''
        return `${item.title} ${item.description} ${subject} ${item.fileName}`
          .toLowerCase()
          .includes(needle)
      })
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1))
  }, [materials, kind, query, subjectById])

  const openResource = (item) => {
    if (item.url) {
      window.open(item.url, '_blank', 'noopener')
      return
    }
    toast.info(t('materials.storedInCloud'), t('materials.cloudOpen', { name: item.fileName || item.title }))
  }

  return (
    <>
      <PageHeader
        eyebrow={t('materials.eyebrow')}
        icon={FolderOpen}
        title={t('materials.title')}
        description={t('materials.description')}
        actions={
          canUpload && (
            <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
              {t('materials.add')}
            </Button>
          )
        }
      />

      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-surface p-0.5">
          {[{ id: 'all', key: 'all' }, ...Object.entries(KIND_META).map(([value, meta]) => ({
            value,
            key: meta.key,
          }))].map((entry) => (
            <button
              key={entry.value ?? entry.id}
              type="button"
              onClick={() => setKind(entry.value ?? entry.id)}
              className={cx(
                'inline-flex h-[30px] items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] font-medium transition-colors',
                kind === (entry.value ?? entry.id) ? 'bg-solid text-on-solid' : 'text-muted hover:text-ink',
              )}
            >
              {t(`materials.${entry.key}`)}
              <span
                className={cx(
                  'font-mono tnum text-[10.5px]',
                  kind === (entry.value ?? entry.id) ? 'text-on-solid/60' : 'text-faint',
                )}
              >
                {counts[entry.value ?? entry.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('materials.search')}
          className="w-full sm:w-[260px]"
        />
      </div>

      {loading ? (
        <Card>
          <Loader label={t('materials.loading')} />
        </Card>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={query ? t('materials.noMatch') : t('materials.emptyTitle')}
          description={
            query
              ? t('materials.searchHint')
              : canUpload
                ? t('materials.publishFirst')
                : t('materials.emptyShared')
          }
          action={
            canUpload && !query ? (
              <Button variant="primary" icon={Plus} onClick={() => setOpen(true)}>
                {t('materials.add')}
              </Button>
            ) : null
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => {
            const meta = KIND_META[item.kind] ?? KIND_META.document
            const Icon = meta.icon
            const subject = subjectById.get(item.subjectId)

            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              >
                <Card className="flex h-full flex-col">
                  <div className="flex items-start gap-3 border-b border-line px-4 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-line bg-sunken text-ink-soft">
                      <Icon size={15} strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-[13.5px] font-semibold leading-5 text-ink">{item.title}</h3>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge tone={meta.tone} mono>
                          {t(`materials.${meta.key}`)}
                        </Badge>
                        <span className="font-mono text-[10.5px] text-faint">
                          {subjectCode(subject?.name)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <CardBody className="flex flex-1 flex-col">
                    {item.description && (
                      <p className="text-[12.5px] leading-5 text-muted">{item.description}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-faint">
                      <span className="truncate">{subject?.name ?? t('materials.general')}</span>
                      {item.fileName && (
                        <>
                          <span className="h-2.5 w-px bg-line" />
                          <span className="truncate font-mono">{item.fileName}</span>
                        </>
                      )}
                      {item.size > 0 && (
                        <>
                          <span className="h-2.5 w-px bg-line" />
                          <span className="font-mono tnum">{formatBytes(item.size)}</span>
                        </>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
                      <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-faint">
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-line bg-surface font-mono text-[8.5px] font-semibold text-ink-soft">
                          {initials(userById.get(item.authorUid)?.displayName)}
                        </span>
                        <span className="truncate">{userById.get(item.authorUid)?.displayName ?? t('materials.classOffice')}</span>
                        <span className="shrink-0">· {formatRelative(item.createdAt, new Date(), t)}</span>
                      </span>

                      <Button
                        size="sm"
                        variant="secondary"
                        icon={item.url ? ArrowUpRight : Download}
                        onClick={() => openResource(item)}
                        className="shrink-0"
                      >
                        {item.url ? t('materials.open') : t('materials.download')}
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </motion.div>
            )
          })}
        </div>
      )}

      <MaterialDialog open={open} subjects={sortedSubjects} onClose={() => setOpen(false)} />
    </>
  )
}
