import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { backend } from '../../app/backend'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { ANNOUNCEMENT_STATUS, COLLECTIONS, WEEKDAYS } from '../../utils/constants'

function scheduleSignature(row) {
  return [
    row.subjectName,
    row.subjectId,
    row.room,
    row.teacherName,
    row.replacementTeacher,
    row.className,
    row.subgroup,
    row.dayOfWeek,
    row.lessonNumber,
    row.isChanged,
  ].join('|')
}

export default function NotificationMonitor() {
  const { t } = useTranslation()
  const { profile } = useAuth()
  const toast = useToast()
  const preferences = profile?.preferences ?? {}
  const inAppEnabled = preferences.inAppNotifications !== false
  const browserEnabled = preferences.browserNotifications === true

  useEffect(() => {
    if (!profile?.uid || (!inAppEnabled && !browserEnabled)) return undefined

    const unsubscribe = []
    const notify = (title, body) => {
      if (inAppEnabled) toast.info(title, body)
      if (browserEnabled && 'Notification' in window && Notification.permission === 'granted') {
        try {
          new Notification(title, { body })
        } catch (cause) {
          toast.error(t('notifications.browserFailed'), cause?.message)
        }
      }
    }
    const reportError = (cause) => toast.error(t('notifications.liveFailed'), cause?.message)

    if (preferences.notifyUrgentAnnouncements !== false) {
      let initialized = false
      let previous = new Map()
      unsubscribe.push(backend.subscribe(
        COLLECTIONS.ANNOUNCEMENTS,
        {},
        (rows) => {
          const current = new Map(rows.map((row) => [row.id, row]))
          if (!initialized) {
            previous = current
            initialized = true
            return
          }
          current.forEach((row, id) => {
            const before = previous.get(id)
            const becameUrgent = row.status === ANNOUNCEMENT_STATUS.URGENT
              && (!before
                || before.status !== ANNOUNCEMENT_STATUS.URGENT
                || before.title !== row.title
                || before.content !== row.content)
            if (becameUrgent) {
              notify(t('notifications.urgentAnnouncementTitle'), t('notifications.urgentAnnouncementBody', { title: row.title }))
            }
          })
          previous = current
        },
        reportError,
      ))
    }

    if (preferences.notifyScheduleChanges !== false) {
      let initialized = false
      let previous = new Map()
      unsubscribe.push(backend.subscribe(
        COLLECTIONS.SCHEDULE,
        {},
        (rows) => {
          const current = new Map(rows.map((row) => [row.id, row]))
          if (!initialized) {
            previous = current
            initialized = true
            return
          }
          current.forEach((row, id) => {
            const before = previous.get(id)
            if (before && scheduleSignature(before) !== scheduleSignature(row)) {
              const day = WEEKDAYS.find((entry) => entry.value === row.dayOfWeek)
              const dayKey = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'][row.dayOfWeek - 1]
              const dayLabel = day ? t(`weekdays.${dayKey}.full`) : String(row.dayOfWeek)
              notify(
                t('notifications.scheduleChangeTitle'),
                t('notifications.scheduleChangeBody', { lesson: row.lessonNumber, day: dayLabel }),
              )
            }
          })
          previous = current
        },
        reportError,
      ))
    }

    if (preferences.notifyNewHomework !== false) {
      let initialized = false
      let previousIds = new Set()
      unsubscribe.push(backend.subscribe(
        COLLECTIONS.HOMEWORK,
        {},
        (rows) => {
          const currentIds = new Set(rows.map((row) => row.id))
          if (initialized) {
            rows.forEach((row) => {
              if (!previousIds.has(row.id)) {
                notify(t('notifications.newHomeworkTitle'), t('notifications.newHomeworkBody', { title: row.text }))
              }
            })
          }
          previousIds = currentIds
          initialized = true
        },
        reportError,
      ))
    }

    return () => unsubscribe.forEach((stop) => stop?.())
  }, [
    browserEnabled,
    inAppEnabled,
    preferences.notifyNewHomework,
    preferences.notifyScheduleChanges,
    preferences.notifyUrgentAnnouncements,
    profile?.uid,
    t,
    toast,
  ])

  return null
}
