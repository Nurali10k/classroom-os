export const DEFAULT_CLASS_NAME = '8В'
export const SCHEDULE_CLASS_STORAGE_KEY = 'classroom-os::schedule-class'

export const DEFAULT_DAY_TIMES = {
  1: { start: '13:15', end: '17:40', lessonCount: 6 },
  2: { start: '12:30', end: '17:40', lessonCount: 7 },
  3: { start: '13:15', end: '18:25', lessonCount: 7 },
  4: { start: '14:00', end: '18:25', lessonCount: 6 },
  5: { start: '13:15', end: '17:40', lessonCount: 6 },
}

const LESSONS = [
  [1, 2, 'Математика', '28'],
  [1, 3, 'История', '19'],
  [1, 4, 'Русский язык', '25'],
  [1, 5, 'Физкультура', ''],
  [1, 6, 'Химия', '22'],
  [1, 7, 'Адабият', '1а'],
  [2, 1, 'Предпроф. компонент', ''],
  [2, 2, 'ЧиО', '19'],
  [2, 3, 'История религий', '10'],
  [2, 4, 'Английский язык', '16'],
  [2, 5, 'Биология', '22'],
  [2, 6, 'Химия', '22'],
  [2, 7, 'Русская литература', '25'],
  [3, 2, 'Предпроф. компонент', '28'],
  [3, 3, 'Кыргызский язык', '31'],
  [3, 4, 'Информатика', '29'],
  [3, 5, 'ЧиО', '19'],
  [3, 6, 'Математика', '28'],
  [3, 7, 'Русский язык', '25'],
  [3, 8, 'Физика', '16'],
  [4, 3, 'Информатика', '29'],
  [4, 4, 'Русская литература', '25'],
  [4, 5, 'Физкультура', ''],
  [4, 6, 'География', '12'],
  [4, 7, 'Английский язык', '11а'],
  [4, 8, 'Математика', '28'],
  [5, 2, 'Математика', '28'],
  [5, 3, 'История', '19'],
  [5, 4, 'Биология', '22'],
  [5, 5, 'Физика', '16'],
  [5, 6, 'География', '27'],
  [5, 7, 'Кыргызский язык', '31'],
]

export const DEFAULT_SCHEDULE_ROWS = LESSONS.map(
  ([dayOfWeek, lessonNumber, subjectName, room]) => ({
    id: `schedule-8v-${dayOfWeek}-${lessonNumber}`,
    className: DEFAULT_CLASS_NAME,
    dayOfWeek,
    lessonNumber,
    subjectName,
    room,
    teacherName: '',
    isChanged: false,
  }),
)

export function getClassSchedule(rows, className) {
  const classRows = rows.filter(
    (row) => (row.className || DEFAULT_CLASS_NAME) === className,
  )

  if (classRows.length || className !== DEFAULT_CLASS_NAME) return classRows
  return DEFAULT_SCHEDULE_ROWS
}

export function getScheduleClasses(rows) {
  return [...new Set([
    DEFAULT_CLASS_NAME,
    ...rows.map((row) => row.className).filter(Boolean),
  ])].sort((a, b) => a.localeCompare(b, 'ru'))
}
