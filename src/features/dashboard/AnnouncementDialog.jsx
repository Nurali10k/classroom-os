import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Megaphone } from 'lucide-react'

import { useAuth } from '../../hooks/useAuth'
import { recordAudit, useFirestore } from '../../hooks/useFirestore'
import { useToast } from '../../hooks/useToast'
import Modal from '../../components/ui/Modal'
import Button from '../../components/ui/Button'
import { Field, Input, Select, Textarea } from '../../components/ui/Input'
import {
  ANNOUNCEMENT_STATUS,
  ANNOUNCEMENT_STATUS_META,
  ANNOUNCEMENT_STATUS_ORDER,
  AUDIT_ACTIONS,
  COLLECTIONS,
} from '../../utils/constants'
import { addDays, toISODate } from '../../utils/dateHelpers'

const EMPTY = { title: '', content: '', status: ANNOUNCEMENT_STATUS.REGULAR, expiresOn: '' }

function getInitialForm(initial) {
  return initial
    ? {
        title: initial.title ?? '',
        content: initial.content ?? '',
        status: initial.status ?? ANNOUNCEMENT_STATUS.REGULAR,
        expiresOn: initial.expiresAt ? toISODate(initial.expiresAt) : '',
      }
    : { ...EMPTY, expiresOn: toISODate(addDays(new Date(), 7)) }
}

/**
 * Create / edit dialog for a global banner alert.
 *
 * Shared by the dashboard board and the admin console, so both entry points
 * write the same payload shape and emit the same audit records.
 *
 * @param {{ open: boolean, onClose: Function, initial?: object|null, onSaved?: Function }} props
 */
export default function AnnouncementDialog({ open, onClose, initial = null, onSaved }) {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const { create, update } = useFirestore()
  const toast = useToast()

  const [form, setForm] = useState(() => getInitialForm(initial))
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }))
  const statusOptions = ANNOUNCEMENT_STATUS_ORDER.map((value) => ({
    value,
    label: t(`announcements.status.${value}`, { defaultValue: ANNOUNCEMENT_STATUS_META[value].label }),
  }))

  const submit = async () => {
    if (!form.title.trim()) return setError(t('announcements.headlineRequired'))
    if (!form.content.trim()) return setError(t('announcements.bodyRequired'))

    setSaving(true)
    setError(null)

    const payload = {
      title: form.title.trim(),
      content: form.content.trim(),
      status: form.status,
      authorUid: profile?.uid ?? '',
      expiresAt: form.expiresOn ? new Date(`${form.expiresOn}T23:59:59`).toISOString() : '',
    }

    try {
      if (initial?.id) {
        await update(COLLECTIONS.ANNOUNCEMENTS, initial.id, payload)
        await recordAudit(profile?.uid, AUDIT_ACTIONS.ANNOUNCEMENT_UPDATED, initial.id)
        toast.success(t('announcements.updated'), payload.title)
      } else {
        const id = await create(COLLECTIONS.ANNOUNCEMENTS, {
          ...payload,
          createdAt: new Date().toISOString(),
        })
        await recordAudit(profile?.uid, AUDIT_ACTIONS.ANNOUNCEMENT_PUBLISHED, id)
        toast.success(t('announcements.published'), payload.title)
      }
      onSaved?.()
      onClose?.()
    } catch (cause) {
      setError(cause?.message ?? t('announcements.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Megaphone}
      title={initial ? t('announcements.edit') : t('announcements.publish')}
      description={t('announcements.dialogDescription')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" loading={saving} onClick={submit}>
            {initial ? t('common.save') : t('announcements.publish')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3.5">
        <Field label={t('announcements.headline')} htmlFor="ann-title" required>
          <Input
            id="ann-title"
            value={form.title}
            onChange={set('title')}
            placeholder={t('announcements.headlinePlaceholder')}
            maxLength={90}
          />
        </Field>

        <Field label={t('announcements.message')} htmlFor="ann-content" required>
          <Textarea
            id="ann-content"
            rows={5}
            value={form.content}
            onChange={set('content')}
            placeholder={t('announcements.messagePlaceholder')}
          />
        </Field>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Field label={t('announcements.priority')} htmlFor="ann-status">
            <Select id="ann-status" value={form.status} onChange={set('status')} options={statusOptions} />
          </Field>
          <Field label={t('announcements.expiresOn')} htmlFor="ann-expiry" hint={t('announcements.expiryHint')}>
            <Input id="ann-expiry" type="date" value={form.expiresOn} onChange={set('expiresOn')} />
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
