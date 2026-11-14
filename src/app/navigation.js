/**
 * navigation.js
 * The single source of truth for the app's information architecture. Both the
 * sidebar and the top bar read from here so labels can never drift apart.
 *
 * `capability` is enforced by <ProtectedRoute />: `null` means "any signed-in
 * member", otherwise the effective role must pass `can(role, capability)`.
 */

import {
  CalendarDays,
  ClipboardCheck,
  FolderOpen,
  LayoutDashboard,
  NotebookPen,
  ShieldCheck,
  Timer,
  UserCircle,
} from 'lucide-react'

export const NAV_ITEMS = [
  {
    to: '/dashboard',
    label: 'Dashboard',
    short: 'Overview',
    description: 'Announcements, duty counter and today at a glance',
    icon: LayoutDashboard,
    capability: null,
  },
  {
    to: '/homework',
    label: 'Homework',
    short: 'Assignments',
    description: 'Every set task, sorted by deadline',
    icon: NotebookPen,
    capability: null,
  },
  {
    to: '/schedule',
    label: 'Schedule',
    short: 'Timetable',
    description: 'The full weekly grid with live substitutions',
    icon: CalendarDays,
    capability: null,
  },
  {
    to: '/freedom-timer',
    label: 'Freedom Timer',
    short: 'Countdowns',
    description: 'Vacation countdown and a study sprint clock',
    icon: Timer,
    capability: null,
  },
  {
    to: '/duty',
    label: 'Duty Roster',
    short: 'Cleaning',
    description: 'Rotating cleaning assignments and sign-off',
    icon: ClipboardCheck,
    capability: null,
  },
  {
    to: '/materials',
    label: 'Materials',
    short: 'Files',
    description: 'Every shared worksheet, deck and handout',
    icon: FolderOpen,
    capability: null,
  },
  {
    to: '/profile',
    label: 'Profile',
    short: 'Profile',
    description: 'Personal information, progress and settings',
    icon: UserCircle,
    capability: null,
  },
  {
    to: '/admin',
    label: 'Admin Console',
    short: 'Console',
    description: 'Users, announcements and global infrastructure',
    icon: ShieldCheck,
    capability: 'admin:access',
    hidden: true,
  },
]

/** Longest-prefix match so nested routes keep their parent highlighted. */
export function findNavItem(pathname) {
  const matches = NAV_ITEMS.filter(
    (item) => pathname === item.to || pathname.startsWith(`${item.to}/`),
  )
  if (matches.length === 0) return null
  return matches.sort((a, b) => b.to.length - a.to.length)[0]
}
