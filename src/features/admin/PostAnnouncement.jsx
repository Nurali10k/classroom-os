import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion } from 'framer-motion'
import { Inbox, Megaphone, Pencil, Pin, Plus, Trash } from 'lucide-react'

import { useCollection, useFirestore } from '../../hooks/useFirestore'
import { useToast } from '../../hooks/useToast'
import { ConfirmDialog } from '../../components/ui/Modal'
import Card, { CardBody, EmptyState } from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Badge from '../../components/ui/Badge'
import { Loader } from '../../components/ui/Loader'
import AnnouncementDialog from '../dashboard/AnnouncementDialog'
import {
  ANNOUNCEMENT_STATUS,
  ANNOUNCEMENT_STATUS_META,
  ANNOUNCEMENT_STATUS_ORDER,
  COLLECTIONS,
} from '../../utils/constants'
import { formatRelative, toDate } from '../../utils/dateHelpers'
import { initials, truncate } from '../../utils/format'
import cx from '../../utils/cx'

const FILTERS = [
  { id: 'all', key: 'allStatus' },
  { id: ANNOUNCEMENT_STATUS.URGENT, key: 'filterUrgent' },
  { id: ANNOUNCEMENT_STATUS.PINNED, key: 'filterPinned' },
  { id: ANNOUNCEMENT_STATUS.REGULAR, key: 'filterRegular' },
]

/**
 * Global announcement board. Teachers own this surface day to day; the admin
 * console exposes the same write path with the full list in one place.
 */
export default function PostAnnouncement() {
  const { t } = useTranslation()
  const toast = useToast()
  const { remove } = useFirestore()

  const { data: announcements, loading } = useCollection(COLLECTIONS.ANNOUNCEMENTS)
  const { data: users } = useCollection(COLLECTIONS.MEMBERS)

  const [filter, setFilter] = useState('all')
  const [dialog, setDialog] = useState({ open: false, record: null })
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const userById = useMemo(() => new Map(users.map((user) => [user.uid, user])), [users])

  const counts = useMemo(() => {
    const base = { all: announcements.length }
    ANNOUNCEMENT_STATUS_ORDER.forEach((status) => {
      base[status] = announcements.filter((item) => item.status === status).length
    })
    return base
  }, [announcements])

  const ordered = useMemo(() => {
    const statusRank = (value) => {
      const index = ANNOUNCEMENT_STATUS_ORDER.indexOf(value)
      return index === -1 ? ANNOUNCEMENT_STATUS_ORDER.length : index
    }
    return [...announcements]
      .filter((item) => filter === 'all' || item.status === filter)
      .sort(
        (a, b) =>
          statusRank(a.status) - statusRank(b.status) ||
          (toDate(b.createdAt) ?? 0) - (toDate(a.createdAt) ?? 0),
      )
  }, [announcements, filter])

  const handleDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await remove(COLLECTIONS.ANNOUNCEMENTS, pendingDelete.id)
      toast.success(t('announcements.removed'), truncate(pendingDelete.title, 60))
      setPendingDelete(null)
    } catch (cause) {
      toast.error(t('announcements.deleteFailed'), cause?.message)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md border border-line bg-sunken text-ink-soft">
              <Megaphone size={15} strokeWidth={1.9} />
            </span>
            <div>
              <h3 className="text-[13.5px] font-semibold leading-5 text-ink">{t('announcements.bannerAlerts')}</h3>
              <p className="text-[12px] leading-5 text-muted">
                {t('announcements.bannerDescription')}
              </p>
            </div>
          </div>

          <Button
            variant="primary"
            icon={Plus}
            onClick={() => setDialog({ open: true, record: null })}
          >
            {t('announcements.new')}
          </Button>
        </CardBody>
      </Card>

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
            {t(`admin.${entry.key}`)}
            <span
              className={cx(
                'font-mono tnum text-[10.5px]',
                filter === entry.id ? 'text-on-solid/60' : 'text-faint',
              )}
            >
              {counts[entry.id] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <Card>
          <Loader label={t('announcements.loading')} />
        </Card>
      ) : ordered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={filter === 'all' ? t('announcements.none') : t('announcements.noneCategory')}
          description={t('announcements.emptyDescription')}
          action={
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setDialog({ open: true, record: null })}
            >
              {t('announcements.new')}
            </Button>
          }
        />
      ) : (
        <Card className="divide-y divide-line">
          {ordered.map((item) => {
            const meta = ANNOUNCEMENT_STATUS_META[item.status] ?? {
              label: item.status,
              tone: 'neutral',
            }
            const author = userById.get(item.authorUid)

            return (
              <motion.article
                key={item.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="group flex items-start gap-3 px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[13.5px] font-semibold leading-5 text-ink">{item.title}</h3>
                    <Badge
                      tone={meta.tone}
                      icon={item.status === ANNOUNCEMENT_STATUS.PINNED ? Pin : undefined}
                      mono
                    >
                      {t(`announcements.status.${item.status}`, { defaultValue: meta.label })}
                    </Badge>
                  </div>

                  <p className="mt-1.5 text-[13px] leading-6 text-ink-soft">{item.content}</p>

                  <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-faint">
                    <span className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full border border-line bg-surface font-mono text-[8.5px] font-semibold text-ink-soft">
                        {initials(author?.displayName)}
                      </span>
                      {author?.displayName ?? t('announcements.classOffice')}
                    </span>
                    <span className="h-2.5 w-px bg-line" />
                    <span>{t('announcements.posted', { when: formatRelative(item.createdAt, new Date(), t) })}</span>
                    {item.expiresAt && (
                      <>
                        <span className="h-2.5 w-px bg-line" />
                        <span className="font-mono tnum">
                          {t('announcements.expires', { when: formatRelative(item.expiresAt, new Date(), t) })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    icon={Pencil}
                    aria-label={t('announcements.edit')}
                    onClick={() => setDialog({ open: true, record: item })}
                  />
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    icon={Trash}
                    aria-label={t('announcements.delete')}
                    onClick={() => setPendingDelete(item)}
                  />
                </div>
              </motion.article>
            )
          })}
        </Card>
      )}

      {dialog.open && (
        <AnnouncementDialog
          open
          initial={dialog.record}
          onClose={() => setDialog({ open: false, record: null })}
        />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title={t('announcements.deleteTitle')}
        description={pendingDelete ? truncate(pendingDelete.title, 80) : undefined}
        confirmLabel={t('common.delete')}
      />
    </div>
  )
}
