import { createBrowserRouter, Navigate } from 'react-router-dom'

import AppLayout from '../components/shared/AppLayout'
import ErrorBoundary from '../components/shared/ErrorBoundary'
import NotFoundPage from '../components/shared/NotFoundPage'
import ProtectedRoute, { GuestRoute } from '../components/shared/ProtectedRoute'
import LoginPage from '../features/auth/LoginPage'
import DashboardPage from '../features/dashboard/DashboardPage'
import HomeworkPage from '../features/homework/HomeworkPage'
import SchedulePage from '../features/schedule/SchedulePage'
import FreedomTimerPage from '../features/freedom-timer/FreedomTimerPage'
import DutyPage from '../features/duty/DutyPage'
import MaterialsPage from '../features/materials/MaterialsPage'
import AdminPage from '../features/admin/AdminPage'
import ProfilePage from '../features/profile/ProfilePage'

/**
 * Route table.
 *
 * The shell itself is guarded (sign-in required); individual modules add their
 * own capability guard so deep links are safe even when typed by hand.
 */
export const router = createBrowserRouter([
  {
    path: '/sign-in',
    element: (
      <GuestRoute>
        <LoginPage />
      </GuestRoute>
    ),
  },
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'homework', element: <HomeworkPage /> },
      { path: 'schedule', element: <SchedulePage /> },
      { path: 'freedom-timer', element: <FreedomTimerPage /> },
      { path: 'duty', element: <DutyPage /> },
      { path: 'materials', element: <MaterialsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      {
        path: 'admin',
        element: (
          <ProtectedRoute capability="admin:access">
            <AdminPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])

export default router
